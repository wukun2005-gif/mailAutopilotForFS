// Bottom playback control bar (Dev Plan §9.3): play/pause (Space),
// single-step (→), speed, restart, stop (Esc), chapter progress.
import { useEffect } from "react";
import { Pause, Play, StepForward, RotateCcw, X, Gauge } from "lucide-react";
import { useDemoStore } from "@/demo/demoStore.ts";
import { demoRunner } from "@/demo/runner.ts";
import { SCRIPT_BY_ID } from "@/demo/scripts.ts";
import { useTranslation } from "react-i18next";

const SPEEDS = [1, 2, 4];

/** Beat jump is a rehearsal/iteration aid, not part of the show: the control
 *  bar only grows the field when the page was opened with `?dbg`. */
const dbg = typeof window !== "undefined" && /[?&]dbg/.test(window.location.search);

export function DemoControlBar() {
  const { t } = useTranslation("demo");
  const status = useDemoStore((s) => s.status);
  const scriptId = useDemoStore((s) => s.scriptId);
  const beatIndex = useDemoStore((s) => s.beatIndex);
  const totalBeats = useDemoStore((s) => s.totalBeats);
  const chapter = useDemoStore((s) => s.chapter);
  const speed = useDemoStore((s) => s.speed);
  const blocker = useDemoStore((s) => s.blocker);
  const agendaScriptId = useDemoStore((s) => s.agendaScriptId);
  const queued = useDemoStore((s) => s.queued);
  const set = useDemoStore((s) => s.set);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") demoRunner.stop();
      // While the opening card is up, Space / → means "get on with it" — the
      // card is not a beat, so there is nothing to pause or single-step yet.
      if (agendaScriptId && (e.key === " " || e.key === "ArrowRight")) {
        e.preventDefault();
        demoRunner.dismissAgenda();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (status === "playing") demoRunner.pause();
        else if (status === "paused") demoRunner.resume();
      }
      if (e.key === "ArrowRight" && status === "paused") void demoRunner.stepOnce();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, agendaScriptId]);

  // The opening card is a full-screen takeover, so the transport bar goes with
  // it: the card has no beat to scrub and its own countdown owns the window.
  // The key handler above is registered regardless, so Esc/Space still work.
  if (status === "idle" || agendaScriptId) return null;
  const script = scriptId ? SCRIPT_BY_ID[scriptId] : null;
  const progress = totalBeats ? Math.round((beatIndex / totalBeats) * 100) : 0;
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    demoRunner.setSpeed(next);
    set({ speed: next });
  };

  return (
    <div
      className="fixed bottom-3 left-1/2 z-[9997] w-[640px] max-w-[94vw] -translate-x-1/2 rounded-xl border border-line bg-white/95 px-3 py-2 shadow-2xl backdrop-blur"
      data-id="demo.bar"
      data-status={status}
      data-script={scriptId ?? ""}
      data-beat={beatIndex}
      data-total={totalBeats}
    >
      {blocker && (
        <div data-id="demo.blocker" className="mb-1 rounded bg-red-50 px-2 py-1 text-[13.5px] text-red-800">
          {t("blocker")} · beat {blocker} — {t("blockerHint")}
        </div>
      )}
      <div className="flex items-center gap-2">
        {status === "playing" ? (
          <button data-id="demo.pause" onClick={() => demoRunner.pause()} className="rounded p-1.5 text-navy hover:bg-paper" title="Space">
            <Pause size={15} />
          </button>
        ) : (
          <button data-id="demo.play" onClick={() => demoRunner.resume()} className="rounded p-1.5 text-teal hover:bg-paper" title="Space">
            <Play size={15} />
          </button>
        )}
        <button
          data-id="demo.step"
          onClick={() => void demoRunner.stepOnce()}
          disabled={status !== "paused"}
          className="rounded p-1.5 text-navy hover:bg-paper disabled:opacity-30"
          title="→"
        >
          <StepForward size={15} />
        </button>
        {dbg && scriptId && (
          <input
            data-id="demo.beatjump"
            type="number"
            min={0}
            max={Math.max(totalBeats - 1, 0)}
            defaultValue={beatIndex}
            key={beatIndex}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const v = Number((e.target as HTMLInputElement).value);
              if (Number.isFinite(v)) void demoRunner.seek(scriptId, v);
            }}
            className="w-[54px] rounded px-1 py-0.5 font-mono text-[13px] text-navy ring-1 ring-line"
            title={t("jump")}
          />
        )}
        <button
          data-id="demo.speed"
          onClick={cycleSpeed}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 font-mono text-[13.5px] text-navy ring-1 ring-line"
          title={t("speed")}
        >
          <Gauge size={12} /> {speed}×
        </button>
        <button
          data-id="demo.restart"
          onClick={() => scriptId && void demoRunner.start(scriptId)}
          className="rounded p-1.5 text-navy hover:bg-paper"
          title={t("restart")}
        >
          <RotateCcw size={14} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[13px]">
            <span className="truncate font-semibold text-navy">
              {/* A chained run says which chapter of the show this is; a single
                  script has no chapter number to show. */}
              {queued && (
                <span className="mr-1.5 rounded bg-teal/15 px-1.5 py-0.5 font-mono text-[12px] text-teal">
                  {queued.index}/{queued.total}
                </span>
              )}
              {script ? t(script.nameKey) : ""} · <span className="text-faint">{chapter}</span>
            </span>
            <span className="ml-2 font-mono text-faint">
              {beatIndex}/{totalBeats}
            </span>
          </div>
          {/* In a chained run the bar tracks the WHOLE show, not the current
              chapter: once the demo runs unattended, "how much is left" is the
              question the audience is actually asking. The lighter segment
              behind the fill is the part already played. */}
          <div className="mt-0.5 h-1 overflow-hidden rounded bg-gray-100">
            <div
              className="h-full rounded bg-teal transition-all"
              style={{
                width: queued
                  ? `${((queued.index - 1 + progress / 100) / queued.total) * 100}%`
                  : `${progress}%`,
              }}
            />
          </div>
        </div>
        <button data-id="demo.stop" onClick={() => demoRunner.stop()} className="rounded p-1.5 text-red-700 hover:bg-red-50" title="Esc">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
