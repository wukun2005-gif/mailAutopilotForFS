// Scenario Director (Dev Plan §9.2): the world-level driver. Non-cursor beats
// call the real runtime/store; cursor beats move the fake cursor and issue
// real DOM clicks (human checkpoints are never auto-approved). Tooltip beats
// may carry a `focus` data-id: the cursor glides onto that element first, so
// the pointer and the caption always talk about the same thing.
import i18n from "@/i18n";
import { narration } from "./narration.ts";
import { bgmPlayer } from "./bgm.ts";
import { useDemoStore } from "./demoStore.ts";
import { SCRIPT_BY_ID, SCRIPTS } from "./scripts.ts";
import { AGENDA_MS } from "./agenda.ts";
import type { DemoScript } from "./types.ts";
import type { Beat } from "./types.ts";
import { caseActions, useCaseStore } from "@/store/caseStore.ts";
import { useUIStore } from "@/store/uiStore.ts";
import { graduationOverrides } from "@/runtime/graduationOverrides.ts";
import { designTimeStore } from "@/runtime/designTime/store.ts";
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

/** Floor for the card at high speed: 6.5s ÷ 4 would be 1.6s, too fast to read. */
const AGENDA_MIN_MS = 3200;

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
  /**
   * Script ids still to play in a one-click run, or null when a single script
   * was started. Kept on the instance (not in the store) because it is the
   * loop's own bookkeeping: the store only ever reports what is on screen now.
   */
  private queue: string[] | null = null;
  /** Index into `queue` of the script currently playing. */
  private queueIndex = -1;

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
    // A single-script start cancels any chain still queued behind it.
    this.queue = null;
    this.queueIndex = -1;
    const script = await this.begin(scriptId);
    if (!script) return;
    // Opening card: the whole agenda with this run's row lit. BGM is already
    // running from begin(); there is deliberately no narration here — the card
    // is read, not voiced.
    await this.showAgenda(scriptId);
    if (this.cancelled) return;
    await this.runFrom(0);
  }

  /**
   * One click, the whole show: every script in menu order, each one reset and
   * played to its end before the next begins. Same beats, same clicks, same
   * captions as running them by hand — the only difference is that nobody has
   * to reach for the menu five times, which is what a live demo actually needs.
   *
   * A chapter still opens on its agenda card, so the audience is told which
   * section is coming before each one rather than once at the very start.
   */
  async startAll(): Promise<void> {
    this.queue = SCRIPTS.map((s) => s.id);
    this.queueIndex = 0;
    this.syncQueue();
    await this.runQueue();
  }

  /**
   * Mirror the chain into the store. The queue itself stays on the instance —
   * it is the loop's bookkeeping — but the bar has to be able to say
   * "第 2/5 章", and that is screen state, not loop state.
   */
  private syncQueue(): void {
    useDemoStore.getState().set({
      queued: this.queue ? { index: this.queueIndex + 1, total: this.queue.length } : null,
    });
  }

  private async runQueue(fromBeat = 0): Promise<void> {
    while (this.queue && this.queueIndex < this.queue.length) {
      const scriptId = this.queue[this.queueIndex];
      // `fromBeat` is non-zero only when resume() re-entered after a blocker,
      // and then begin() must NOT run: it re-seeds the world, which would wipe
      // the very state the earlier beats of this chapter built up.
      if (fromBeat === 0) {
        const script = await this.begin(scriptId);
        if (!script) return;
        await this.showAgenda(scriptId);
        // begin() bumps runId and re-seeds, so a run replaced while we were
        // resetting (a stray click on another script) has cancelled this one;
        // runFrom re-checks the id against its own stamp anyway.
        if (this.cancelled) return;
      }
      const finished = await this.runFrom(fromBeat);
      fromBeat = 0;
      // A required-click blocker parks the run; resume() picks the chain back
      // up at the same beat rather than restarting the show.
      if (!finished) return;
      this.queueIndex++;
      if (this.queueIndex < this.queue.length && !this.cancelled) {
        await this.chapterBreak();
      }
    }
    this.finish();
  }

  /**
   * Black screen between two chapters. Without it the last caption of one
   * script and the first frame of the next share a single instant, and the
   * world reset in begin() is visible as a half-built screen.
   *
   * The status deliberately stays `playing`: it is a hold inside the run, not
   * a user pause, and gate() would block on it forever.
   */
  private async chapterBreak(): Promise<void> {
    useDemoStore.getState().set({
      visible: false,
      tooltip: "",
      cursor: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    });
    this.clearHighlight();
    try {
      await this.wait(900);
    } catch (err) {
      if ((err as Error).message === "__CANCELLED__") return;
      throw err;
    }
  }

  /** The show is over: drop the chain and put the app back the way it was. */
  private finish(): void {
    this.queue = null;
    this.queueIndex = -1;
    useDemoStore.getState().set({ status: "done", tooltip: "", visible: false });
    // The last caption's mark must not stay on the finished screen.
    this.clearHighlight();
    useUIStore.getState().setDemoActive(false);
    bgmPlayer.stop();
  }

  /**
   * Hold the agenda card on screen for AGENDA_MS, then clear it. Deliberately
   * not a beat: it is the same five rows every run, the highlight is already
   * carried by the store, and a seek to a mid-script frame should land on the
   * demo rather than on this card. Clicking it (or pressing Esc→stop) ends it
   * early, which is what a presenter does when the room is ready.
   */
  private async showAgenda(scriptId: string): Promise<void> {
    useDemoStore.getState().set({ agendaScriptId: scriptId });
    const runId = this.runId;
    try {
      await this.waitAgenda(AGENDA_MS);
    } catch (err) {
      if ((err as Error).message !== "__CANCELLED__") throw err;
    }
    if (runId === this.runId) useDemoStore.getState().set({ agendaScriptId: null });
  }

  /** The card may be dismissed before its time is up (a click, or →/Space). */
  dismissAgenda(): void {
    if (useDemoStore.getState().agendaScriptId) {
      useDemoStore.getState().set({ agendaScriptId: null });
    }
  }

  /**
   * Hold the card, in short slices: a click dismisses it within a frame rather
   * than at the end of a 6-second window, and an Esc cancels it the way it
   * cancels any other beat. The speed multiplier compresses the card like it
   * compresses a caption, down to a floor that is still readable — 6.5s ÷ 4
   * would be 1.6s, too fast to find the lit row.
   */
  private async waitAgenda(ms: number): Promise<void> {
    const speed = useDemoStore.getState().speed || 1;
    const until = Date.now() + Math.max(AGENDA_MIN_MS, ms / speed);
    while (useDemoStore.getState().agendaScriptId) {
      if (this.cancelled) throw new Error("__CANCELLED__");
      if (Date.now() >= until) break;
      await this.wait(120);
    }
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
      agendaScriptId: null,
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
    // Reset = re-seed (Dev Plan §9.3). resetWorld, not reset(): a chained run
    // must not inherit the previous chapter's case, checkpoints, sim clock or
    // fault flags — and the builder chapter loads no scenario of its own, so
    // the conditional reset() would have been a no-op there.
    await useCaseStore.getState().resetWorld();
    // Graduation overrides are policy config and deliberately survive a
    // scenario reset (see CaseRunner.reset) — which is right for a manual
    // session and wrong here: the builder chapter promotes an intent and
    // degrades another, and the next chapter must meet the fixture table.
    graduationOverrides.reset();
    // M12 design-time state (nominations, waves, compilations, candidates)
    // re-seeds the same way the builder overrides do.
    designTimeStore.reset();
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
    // A seek is a rehearsal jump into one script; it is not a step of the show.
    this.queue = null;
    this.queueIndex = -1;
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

  /**
   * Play beats from `index` to the end of the current script. Resolves true
   * when the script ran to its last beat, false when it stopped early (a
   * required-click blocker) — the queue needs that distinction, because a
   * blocked script must not be mistaken for a finished one.
   */
  private async runFrom(index: number): Promise<boolean> {
    if (!this.script) return false;
    const runId = this.runId;
    this.loopAlive = true;
    for (let i = index; i < this.script.beats.length; i++) {
      if (this.cancelled || runId !== this.runId) return false;
      useDemoStore.getState().set({ beatIndex: i, chapter: this.script.beats[i].chapter });
      const beat = this.script.beats[i];
      try {
        await this.exec(beat);
      } catch (err) {
        if ((err as Error).message === "__CANCELLED__") return false;
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
          return false;
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
    if (this.cancelled) return false;
    this.loopAlive = false;
    // A single script owns its own ending; a queued one hands over to the next
    // chapter instead, so the bar, the cursor and the BGM stay up.
    if (!this.queue) this.finish();
    return true;
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
    if (this.loopAlive || d.status === "done") return;
    // The run loop ended (required-click blocker, single-step, or finished) —
    // restart it from the current beat; otherwise the live loop is just gated.
    // In a chained run the current chapter is unfinished, so the queue picks
    // up from where it stopped instead of replaying the whole show.
    if (this.queue) void this.runQueue(d.beatIndex);
    else void this.runFrom(d.beatIndex);
  }

  stop(): void {
    this.cancelled = true;
    this.pauseResolver?.();
    // Esc ends the whole show, not just the chapter on screen: leaving the
    // queue armed would let a stray resume() carry on with the next script.
    this.queue = null;
    this.queueIndex = -1;
    this.stopVisual();
    useUIStore.getState().setDemoActive(false);
    bgmPlayer.stop();
  }

  private stopVisual(): void {
    useDemoStore
      .getState()
      .set({
        status: "idle",
        visible: false,
        tooltip: "",
        clicking: false,
        agendaScriptId: null,
      });
    this.clearHighlight();
  }

  setSpeed(speed: number): void {
    useDemoStore.getState().set({ speed });
  }

  private async exec(beat: Beat): Promise<void> {
    const a = beat.action;
    console.warn(`[demo] ▶ beat ${beat.id} (${a.t}):`, JSON.stringify(a));
    // A caption belongs to its own beat: every beat drops the previous one
    // first, so the audience never reads yesterday's line over the new screen
    // or the new pointer position. The highlight goes with it — a marked row
    // from the previous beat is a lie on a screen that has since changed.
    //
    // This includes the NEXT caption beat, not just non-caption ones. The
    // caption is positioned against whatever is highlighted at the moment it
    // renders, and framing the next beat's element clears the old highlight
    // first: leaving the old line up through that window re-renders it with no
    // highlight, so it jumps to the bottom band, then jumps back up when the
    // new caption lands. Same words, two positions — a visible wobble.
    useDemoStore.getState().set({ tooltip: "" });
    this.clearHighlight();
    switch (a.t) {
      case "goto":
        console.warn(`[demo] goto → ${a.screen}`);
        useUIStore.getState().setScreen(a.screen);
        await this.wait(700);
        // The new screen has its own layout: glide the cursor back into the
        // middle of the content area instead of leaving it pointing at pixels
        // that no longer mean anything.
        this.reanchor();
        await this.wait(320);
        break;
      case "load":
        console.warn(`[demo] load scenario ${a.scenario}`);
        await caseActions.loadScenario(a.scenario);
        await this.wait(900);
        break;
      case "inject":
        console.warn(`[demo] inject ${a.emailId}`);
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
        if (a.focus) await this.frameFor(a.focus, a.point);
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
        const he = found.el as HTMLButtonElement;
        console.warn(
          `[demo] locate ✓ ${dataId} → <${found.el.tagName.toLowerCase()}> disabled=${he.disabled ?? false}` +
            ` rect=[${Math.round(found.rect.left)},${Math.round(found.rect.top)} ${Math.round(found.rect.width)}x${Math.round(found.rect.height)}]`,
        );
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
          console.warn(`[demo] ⟵ .click() dispatched on ${dataId} (disabled=${he.disabled ?? false})`);
          (found.el as HTMLElement).click();
          useDemoStore.getState().set({ clicking: false });
          console.warn(`[demo] click returned for ${dataId}`);
        }
        await this.wait(opts.waitAfter);
        return;
      }
      console.warn(`[demo] locate ✗ ${dataId} — attempt ${i + 1}/${attempts}`);
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
  private async frameFor(
    dataId: string,
    point?: "tl" | "tr" | "bl" | "br",
  ): Promise<void> {
    this.clearHighlight();
    const found = await this.locate(dataId);
    if (!found) {
      console.warn(`[demo] frame ✗ ${dataId} — target not found (caption plays without pointer)`);
      return;
    }
    console.warn(`[demo] frame ✓ ${dataId}`);
    const el = found.el as HTMLElement;
    el.dataset.hl = dataId;
    const r = found.rect;
    useDemoStore.getState().set({
      visible: true,
      cursor: this.poseFor(r, point),
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
   *
   * A corner pose (`point`) puts the TIP on that corner from the outside: the
   * default centre pose lands exactly on a matrix cell's own header — the I0–I3
   * label the caption is reading — so beats that name the label point in from
   * the top-right corner instead and leave the whole cell unobstructed.
   * (The SVG's tip sits at (x−7, y−11) of the stored pose — margins −11/−13
   * plus the path's (4,2) tip — hence the +7/+11 here.)
   */
  private poseFor(rect: DOMRect, point?: "tl" | "tr" | "bl" | "br"): { x: number; y: number } {
    if (point) {
      const corners = {
        tl: { x: rect.left, y: rect.top },
        tr: { x: rect.right, y: rect.top },
        bl: { x: rect.left, y: rect.bottom },
        br: { x: rect.right, y: rect.bottom },
      } as const;
      const tip = corners[point];
      return {
        x: Math.round(Math.min(Math.max(tip.x + 7, 14), window.innerWidth - 14)),
        y: Math.round(Math.min(Math.max(tip.y + 11, 14), window.innerHeight - 14)),
      };
    }
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
