// Scenario Director (Dev Plan §9.2): the world-level driver. Non-cursor beats
// call the real runtime/store; cursor beats move the fake cursor and issue
// real DOM clicks (human checkpoints are never auto-approved).
import i18n from "@/i18n";
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

function visibleEl(dataId: string): Element | null {
  const all = Array.from(document.querySelectorAll(`[data-id="${CSS.escape(dataId)}"]`));
  for (const el of all) {
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none") {
      return el;
    }
  }
  return all[0] ?? null;
}

class DemoRunner {
  private cancelled = false;
  private pauseResolver: (() => void) | null = null;
  private script: DemoScript | null = null;
  /** The async run loop is alive (possibly gated on pause). */
  private loopAlive = false;

  private gate(): Promise<void> {
    if (useDemoStore.getState().status !== "paused") return Promise.resolve();
    return new Promise((resolve) => {
      this.pauseResolver = resolve;
    });
  }

  private async wait(ms: number): Promise<void> {
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
    const script = SCRIPT_BY_ID[scriptId];
    if (!script) return;
    this.stopVisual();
    this.cancelled = false;
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
      cursor: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    });
    useUIStore.getState().setDemoActive(true);
    // Reset = re-seed (Dev Plan §9.3).
    await useCaseStore.getState().reset();
    this.loopAlive = true;
    await this.runFrom(0);
  }

  private async runFrom(index: number): Promise<void> {
    if (!this.script) return;
    this.loopAlive = true;
    for (let i = index; i < this.script.beats.length; i++) {
      if (this.cancelled) return;
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
      useUIStore.getState().setDemoActive(false);
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
  }

  private stopVisual(): void {
    useDemoStore.getState().set({ status: "idle", visible: false, tooltip: "", clicking: false });
  }

  setSpeed(speed: number): void {
    useDemoStore.getState().set({ speed });
  }

  private async exec(beat: Beat): Promise<void> {
    const a = beat.action;
    switch (a.t) {
      case "goto":
        useUIStore.getState().setScreen(a.screen);
        await this.wait(700);
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
        const text = i18n.t(a.key, { ns: "demo", defaultValue: a.key });
        useDemoStore.getState().set({ tooltip: text });
        await this.wait(a.ms ?? 3000);
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
    let el: Element | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      el = visibleEl(dataId);
      if (el) {
        el.scrollIntoView({ block: "center", inline: "center", behavior: reducedMotion ? "auto" : "smooth" });
        if (el.getBoundingClientRect().width > 0) break;
      }
      await this.wait(300);
    }
    if (!el) {
      const msg = `data-id "${dataId}" not found`;
      if (opts.require) throw new Error(`__REQUIRE__ ${msg}`);
      throw new Error(msg);
    }
    const r = el.getBoundingClientRect();
    useDemoStore.getState().set({
      visible: true,
      cursor: { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 18) },
    });
    await this.wait(reducedMotion ? 150 : 650);
    if (opts.type !== undefined) {
      this.typeInto(el, opts.type);
      await this.wait(opts.waitAfter);
      return;
    }
    if (opts.click) {
      useDemoStore.getState().set({ clicking: true });
      await this.wait(180);
      (el as HTMLElement).click();
      useDemoStore.getState().set({ clicking: false });
    }
    await this.wait(opts.waitAfter);
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
