// Scenario Director (Dev Plan §9.2): the world-level driver. Non-cursor beats
// call the real runtime/store; cursor beats move the fake cursor and issue
// real DOM clicks (human checkpoints are never auto-approved). Tooltip beats
// may carry a `focus` data-id: the cursor glides onto that element first, so
// the pointer and the caption always talk about the same thing.
import i18n from "@/i18n";
import { narration } from "./narration.ts";
import { bgmPlayer } from "./bgm.ts";
import { useDemoStore } from "./demoStore.ts";
import { SCRIPT_BY_ID } from "./scripts.ts";
import type { DemoScript } from "./types.ts";
import type { Beat } from "./types.ts";
import { caseActions, useCaseStore } from "@/store/caseStore.ts";
import { useUIStore } from "@/store/uiStore.ts";
import { faultController } from "@/tools/faultController.ts";

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Resolve a focus target. `id@last` / `id@first` pick the last / first element
 * whose data-id STARTS WITH `id` — that is how "the newest trace line" is
 * addressed when the ids are dynamic (`s1.trace.entry.${seq}`).
 */
function resolveId(dataId: string): { prefix: string; pick: "first" | "last" } {
  const at = dataId.lastIndexOf("@");
  if (at > 0) {
    const mode = dataId.slice(at + 1);
    if (mode === "last" || mode === "first") {
      return { prefix: dataId.slice(0, at), pick: mode };
    }
  }
  return { prefix: dataId, pick: "first" };
}

function matchEl(prefix: string, pick: "first" | "last"): Element | null {
  const all = Array.from(
    document.querySelectorAll(`[data-id^="${CSS.escape(prefix)}"]`),
  );
  const ordered = pick === "last" ? [...all].reverse() : all;
  for (const el of ordered) {
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none") {
      return el;
    }
  }
  return ordered[0] ?? null;
}

/** Height of the nearest scrollable ancestor (the pane the element lives in). */
function scrollportHeight(el: Element): number {
  let node: Element | null = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.clientHeight > 0) return node.clientHeight;
    node = node.parentElement;
  }
  return window.innerHeight;
}

class DemoRunner {
  private cancelled = false;
  private pauseResolver: (() => void) | null = null;
  private script: DemoScript | null = null;
  /** The async run loop is alive (possibly gated on pause). */
  private loopAlive = false;
  /**
   * Fast-forward mode (seek): every wait is clamped and captions are put up
   * without their narration window, so reaching beat 12 costs seconds instead
   * of replaying 12 caption windows. The beats themselves still run — the
   * clicks, the injections, the clock are the real ones, because the point of
   * jumping to a beat is seeing the state that beat actually produces.
   */
  private fast = false;
  /** Incremented by begin(): an older loop that was mid-beat sees a changed
   *  id and stops instead of racing the new one over the same world. */
  private runId = 0;

  private gate(): Promise<void> {
    if (useDemoStore.getState().status !== "paused") return Promise.resolve();
    return new Promise((resolve) => {
      this.pauseResolver = resolve;
    });
  }

  private async wait(ms: number): Promise<void> {
    if (this.fast) {
      await new Promise((r) => setTimeout(r, Math.min(ms, 120)));
      return;
    }
    const speed = useDemoStore.getState().speed || 1;
    const scaled = Math.max(120, ms / speed);
    const steps = Math.ceil(scaled / 100);
    for (let i = 0; i < steps; i++) {
      if (this.cancelled) throw new Error("__CANCELLED__");
      await this.gate();
      await new Promise((r) => setTimeout(r, scaled / steps));
    }
  }

  async start(scriptId: string): Promise<void> {
    const script = await this.begin(scriptId);
    if (!script) return;
    await this.runFrom(0);
  }

  /** Retire whatever loop is running: cancel it, release its pause, and give
   *  its current wait slice (≤120ms) time to notice before a new run starts. */
  private async quiesce(): Promise<void> {
    this.cancelled = true;
    this.pauseResolver?.();
    this.pauseResolver = null;
    await new Promise((r) => setTimeout(r, 160));
  }

  /** Reset the world and arm the bar for `scriptId`, at beat 0. */
  private async begin(scriptId: string): Promise<DemoScript | null> {
    const script = SCRIPT_BY_ID[scriptId];
    if (!script) return null;
    await this.quiesce();
    this.stopVisual();
    this.cancelled = false;
    this.runId++;
    this.fast = false;
    this.script = script;
    const d = useDemoStore.getState();
    d.set({
      status: "playing",
      scriptId,
      beatIndex: 0,
      totalBeats: script.beats.length,
      chapter: script.beats[0]?.chapter ?? "",
      failures: [],
      blocker: null,
      visible: true,
      tooltip: "",
      highlight: null,
      cursor: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    });
    useUIStore.getState().setDemoActive(true);
    // The script owns the view state too: a run always starts on the customer
    // view, never on whatever toggle a previous run (or a manual click) left
    // behind, so the first beat frames the mail the way a customer sees it.
    useUIStore.getState().setAuditView(false);
    // Reset = re-seed (Dev Plan §9.3).
    await useCaseStore.getState().reset();
    bgmPlayer.start();
    this.loopAlive = true;
    return script;
  }

  /**
   * Jump straight to a beat: replay everything before it with waits clamped
   * (fast mode), run that beat normally, then stay paused on it with the
   * caption up. Always restarts from beat 0 so the landing state is exactly
   * what a real run would have produced — a seek that skipped a click would
   * put a beat on screen with the world behind it half-built.
   */
  async seek(scriptId: string, index: number): Promise<void> {
    const script = await this.begin(scriptId);
    if (!script) return;
    const n = Math.max(0, Math.min(Math.trunc(index), script.beats.length - 1));
    const runId = this.runId;
    this.fast = true;
    try {
      for (let i = 0; i < n; i++) {
        if (this.cancelled || runId !== this.runId) return;
        const beat = script.beats[i];
        useDemoStore.getState().set({ beatIndex: i, chapter: beat.chapter });
        try {
          await this.exec(beat);
        } catch (err) {
          if ((err as Error).message === "__CANCELLED__") return;
          useDemoStore.getState().set({
            failures: [
              ...useDemoStore.getState().failures,
              { beatId: beat.id, reason: String((err as Error).message) },
            ],
          });
          console.warn(`[demo] seek: beat ${beat.id} failed:`, err);
        }
      }
    } finally {
      if (runId === this.runId) this.fast = false;
    }
    if (this.cancelled || runId !== this.runId) return;
    // Give the beats that just ran (inject, clock, restart) their async tail
    // before framing the target, so the target is shot on settled state.
    useDemoStore.getState().set({ beatIndex: n, chapter: script.beats[n].chapter });
    await this.wait(700);
    try {
      await this.exec(script.beats[n]);
    } catch (err) {
      if ((err as Error).message !== "__CANCELLED__") console.warn("[demo] seek target failed:", err);
    }
    this.loopAlive = false;
    useDemoStore.getState().set({ status: "paused" });
  }

  private async runFrom(index: number): Promise<void> {
    if (!this.script) return;
    const runId = this.runId;
    this.loopAlive = true;
    for (let i = index; i < this.script.beats.length; i++) {
      if (this.cancelled || runId !== this.runId) return;
      useDemoStore.getState().set({ beatIndex: i, chapter: this.script.beats[i].chapter });
      const beat = this.script.beats[i];
      try {
        await this.exec(beat);
      } catch (err) {
        if ((err as Error).message === "__CANCELLED__") return;
        if ((err as Error).message.startsWith("__REQUIRE__")) {
          useDemoStore.getState().set({
            status: "paused",
            blocker: beat.id,
            failures: [
              ...useDemoStore.getState().failures,
              { beatId: beat.id, reason: (err as Error).message },
            ],
          });
          this.loopAlive = false;
          return;
        }
        useDemoStore.getState().set({
          failures: [
            ...useDemoStore.getState().failures,
            { beatId: beat.id, reason: String((err as Error).message) },
          ],
        });
        console.warn(`[demo] beat ${beat.id} failed, skipping:`, err);
      }
    }
    if (!this.cancelled) {
      this.loopAlive = false;
      useDemoStore.getState().set({ status: "done", tooltip: "", visible: false });
      // The last caption's mark must not stay on the finished screen.
      this.clearHighlight();
      useUIStore.getState().setDemoActive(false);
      bgmPlayer.stop();
    }
  }

  /** Execute exactly one beat then stay paused (single-step). */
  async stepOnce(): Promise<void> {
    const d = useDemoStore.getState();
    if (!this.script || d.status === "done" || d.beatIndex >= d.totalBeats) return;
    if (this.loopAlive) {
      // Live loop is gated on pause: release one beat, re-gate at next wait.
      d.set({ status: "playing", blocker: null });
      this.pauseResolver?.();
      this.pauseResolver = null;
      d.set({ status: "paused" });
      return;
    }
    d.set({ status: "playing", blocker: null });
    const beat = this.script.beats[d.beatIndex];
    try {
      await this.exec(beat);
      d.set({ beatIndex: d.beatIndex + 1 });
    } catch (err) {
      if ((err as Error).message !== "__CANCELLED__") console.warn("[demo] step failed:", err);
    }
    d.set({ status: "paused" });
  }

  pause(): void {
    if (useDemoStore.getState().status === "playing") {
      useDemoStore.getState().set({ status: "paused" });
    }
  }

  resume(): void {
    const d = useDemoStore.getState();
    d.set({ status: "playing", blocker: null });
    this.pauseResolver?.();
    this.pauseResolver = null;
    // The run loop ended (required-click blocker, single-step, or finished) —
    // restart it from the current beat; otherwise the live loop is just gated.
    if (!this.loopAlive && d.status !== "done") {
      void this.runFrom(d.beatIndex);
    }
  }

  stop(): void {
    this.cancelled = true;
    this.pauseResolver?.();
    this.stopVisual();
    useUIStore.getState().setDemoActive(false);
    bgmPlayer.stop();
  }

  private stopVisual(): void {
    useDemoStore
      .getState()
      .set({ status: "idle", visible: false, tooltip: "", clicking: false });
    this.clearHighlight();
  }

  setSpeed(speed: number): void {
    useDemoStore.getState().set({ speed });
  }

  private async exec(beat: Beat): Promise<void> {
    const a = beat.action;
    // A caption belongs to its own beat: any other beat drops it first, so the
    // audience never reads yesterday's line over the new screen or the new
    // pointer position. The highlight goes with it — a marked row from the
    // previous beat is a lie on a screen that has since changed.
    if (a.t !== "tooltip") {
      useDemoStore.getState().set({ tooltip: "" });
      this.clearHighlight();
    }
    switch (a.t) {
      case "goto":
        useUIStore.getState().setScreen(a.screen);
        await this.wait(700);
        // The new screen has its own layout: glide the cursor back into the
        // middle of the content area instead of leaving it pointing at pixels
        // that no longer mean anything.
        this.reanchor();
        await this.wait(320);
        break;
      case "load":
        await caseActions.loadScenario(a.scenario);
        await this.wait(900);
        break;
      case "inject":
        await caseActions.inject(a.emailId);
        await this.wait(1100);
        break;
      case "clock":
        await caseActions.advance(a.to);
        await this.wait(1100);
        break;
      case "fault":
        faultController.set(a.flag, a.on ?? true);
        await this.wait(400);
        break;
      case "restart":
        await useCaseStore.getState().simulateRestart();
        await this.wait(1200);
        break;
      case "wait":
        await this.wait(a.ms);
        break;
      case "tooltip": {
        // Mark whatever this caption is talking about, then say it: the pointer
        // and the ring sit on the same element, so a caption that names a
        // detail on a dense screen is actually findable.
        if (a.focus) await this.frameFor(a.focus);
        const text = i18n.t(a.key, { ns: "demo", defaultValue: a.key });
        useDemoStore.getState().set({ tooltip: text });
        // Seeking puts the caption up without waiting it out (or starting a
        // clip): the caller is looking at the frame, not listening to it.
        if (this.fast) {
          await this.wait(300);
          break;
        }
        // Narration drives the beat window: the caption stays up exactly until
        // the voice stops (wait() slices and playbackRate both scale with
        // speed, so caption, voice and script stay in lockstep at 1×/2×/4×).
        // No clip (missing file or blocked autoplay) → scripted caption window.
        const clipMs = await narration.start(a.key);
        if (clipMs === null) {
          await this.wait(a.ms ?? 3000);
          break;
        }
        // Poll in gated slices: a pause blocks inside gate() (so a long pause
        // never counts against the bound), and while the demo is paused the
        // voice is paused too — the clip's clock only runs while playing, so
        // only a playing clip whose currentTime stops advancing trips the
        // stuck detector after ~30 slices (~3.5s).
        let last = Number.POSITIVE_INFINITY;
        let stuck = 0;
        while (!narration.finished()) {
          const rem = narration.remainingMs();
          if (rem === null) break; // clip dropped (stop / error)
          const playing = useDemoStore.getState().status === "playing";
          if (playing) {
            if (rem >= last) {
              if (++stuck > 30) break;
            } else {
              stuck = 0;
              last = rem;
            }
          }
          await this.wait(100);
        }
        break;
      }
      case "cursor":
        await this.cursorBeat(a.target, {
          click: a.click,
          type: a.type,
          waitAfter: a.wait ?? 900,
          require: a.require,
        });
        break;
    }
  }

  private async cursorBeat(
    dataId: string,
    opts: { click?: boolean; type?: string; waitAfter: number; require?: boolean },
  ): Promise<void> {
    // Required beats (real human checkpoints) retry until the element is
    // actually there; a missing one is a blocker, never a silent skip.
    const attempts = opts.require ? 8 : 3;
    for (let i = 0; i < attempts; i++) {
      const found = await this.locate(dataId);
      if (found) {
        useDemoStore.getState().set({ visible: true, cursor: this.poseFor(found.rect) });
        await this.wait(reducedMotion ? 150 : 650);
        if (opts.type !== undefined) {
          this.typeInto(found.el, opts.type);
          await this.wait(opts.waitAfter);
          return;
        }
        if (opts.click) {
          useDemoStore.getState().set({ clicking: true });
          await this.wait(180);
          (found.el as HTMLElement).click();
          useDemoStore.getState().set({ clicking: false });
        }
        await this.wait(opts.waitAfter);
        return;
      }
      await this.wait(opts.require ? 500 : 250);
    }
    const msg = `data-id "${dataId}" not found`;
    if (opts.require) throw new Error(`__REQUIRE__ ${msg}`);
    throw new Error(msg);
  }

  /**
   * Point at `dataId` for a caption and mark the element itself
   * (`data-hl`, styled in index.css). Missing target is not fatal: the caption
   * still plays, it just has no pointer.
   */
  private async frameFor(dataId: string): Promise<void> {
    this.clearHighlight();
    const found = await this.locate(dataId);
    if (!found) return;
    const el = found.el as HTMLElement;
    el.dataset.hl = dataId;
    const r = found.rect;
    useDemoStore.getState().set({
      visible: true,
      cursor: this.poseFor(r),
      highlight: { id: dataId, rect: { x: r.x, y: r.y, w: r.width, h: r.height } },
    });
    await this.wait(reducedMotion ? 120 : 520);
  }

  /** Drop the mark wherever it is — including on nodes React has replaced. */
  private clearHighlight(): void {
    const marked = document.querySelectorAll<HTMLElement>("[data-hl]");
    for (const el of marked) delete el.dataset.hl;
    if (useDemoStore.getState().highlight) {
      useDemoStore.getState().set({ highlight: null });
    }
  }

  /** Default pose after a screen switch: upper-middle of the content area. */
  private reanchor(): void {
    useDemoStore.getState().set({
      visible: true,
      cursor: {
        x: Math.round(window.innerWidth * 0.42),
        y: Math.round(Math.min(window.innerHeight * 0.4, window.innerHeight - 240)),
      },
    });
  }

  /**
   * Bring `el` fully into view and wait until scrolling has settled. Smooth
   * scrolling animates for a few hundred ms — sampling the rect right after
   * scrollIntoView() would place the pointer where the element USED to be.
   * An element taller than its scrollport is aligned to the TOP: centring it
   * would cut off the very first line (a mail subject, a card heading) the
   * caption is about.
   */
  private async scrollTo(el: Element): Promise<DOMRect> {
    const before = el.getBoundingClientRect();
    const port = scrollportHeight(el);
    const align = before.height > port * 0.8 ? "start" : "center";
    el.scrollIntoView({ block: align, inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    let rect = el.getBoundingClientRect();
    const deadline = Date.now() + 900;
    while (Date.now() < deadline) {
      await this.wait(80);
      const next = el.getBoundingClientRect();
      const settled = Math.abs(next.top - rect.top) < 1 && Math.abs(next.left - rect.left) < 1;
      rect = next;
      if (settled) break;
    }
    return rect;
  }

  /** Visible element by data-id, scrolled into view; null when absent. */
  private async locate(dataId: string): Promise<{ el: Element; rect: DOMRect } | null> {
    const { prefix, pick } = resolveId(dataId);
    for (let attempt = 0; attempt < 3; attempt++) {
      const el = matchEl(prefix, pick);
      if (el) {
        const rect = await this.scrollTo(el);
        if (rect.width > 0 && rect.height > 0) return { el, rect };
      }
      await this.wait(250);
    }
    const el = matchEl(prefix, pick);
    return el ? { el, rect: el.getBoundingClientRect() } : null;
  }

  /**
   * Where the pointer tip goes for a box: horizontally centred, vertically in
   * the top third (buttons, rows, tabs), clamped inside the viewport so wide
   * tables and scrolled panes never push it off-screen.
   */
  private poseFor(rect: DOMRect): { x: number; y: number } {
    const x = rect.left + rect.width / 2;
    const y = rect.top + Math.min(rect.height / 2, 18);
    return {
      x: Math.round(Math.min(Math.max(x, 14), window.innerWidth - 14)),
      y: Math.round(Math.min(Math.max(y, 14), window.innerHeight - 14)),
    };
  }

  private typeInto(el: Element, value: string): void {
    const target = el as HTMLInputElement | HTMLTextAreaElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      const proto =
        target.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter?.call(target, value);
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      (el as HTMLElement).click();
    }
  }
}

export const demoRunner = new DemoRunner();

// Debug affordance: `__demoSeek("email1", 12)` in the console (or from the
// playwright shots spec) jumps to beat 12 instead of replaying the script.
if (typeof window !== "undefined") {
  (window as unknown as { __demoSeek?: (id: string, i: number) => Promise<void> }).__demoSeek =
    (id, i) => demoRunner.seek(id, i);
}
