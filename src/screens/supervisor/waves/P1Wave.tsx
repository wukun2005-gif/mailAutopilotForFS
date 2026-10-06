// P1 positive wave — proactive remediation. The math (same tape, same fee,
// bank error) is AI's job; granting it is gated three ways: compliance/legal
// confirm the bank error, then dual sign on the sample and on the total.
// Rollout stages 1% → 10% → 100%, each payment idempotent and reversible.
import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle, Play, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { designTimeStore } from "@/runtime/designTime/store.ts";
import { remediationComplete, remediationMissing } from "@/runtime/designTime/logic.ts";
import type { Wave } from "@/runtime/designTime/types.ts";
import { Field, SeverityBadge, Sparkline } from "./waveUi";

function Gate({ done, label, btn, onAct, id }: {
  done: boolean;
  label: string;
  btn: string;
  onAct: () => void;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-white px-2 py-1.5">
      <span className="flex items-center gap-1.5 text-[12.5px] text-navy">
        {done ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Circle size={14} className="text-faint" />}
        {label}
      </span>
      {!done && (
        <button
          data-id={id}
          onClick={onAct}
          className="rounded-md border border-emerald-600 px-2 py-1 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          {btn}
        </button>
      )}
    </div>
  );
}

export function P1Wave({ wave }: { wave: Wave }) {
  const { t, i18n } = useTranslation("supervisor");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const r = wave.remediation!;
  const missing = remediationMissing(r);
  const gatesDone = missing.length === 0;
  const done = remediationComplete(r);
  const running = r.batches.find((b) => b.status === "running");
  const next = r.batches.find((b) => b.status === "pending");
  const cumulative = (idx: number) =>
    r.batches.slice(0, idx + 1).reduce((s, b) => s + b.accounts, 0);

  return (
    <div
      className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3"
      data-id={`s3.wave.${wave.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity="P1" />
            <h4 className="text-[14px] font-semibold text-navy">{wave.title[lang]}</h4>
          </div>
          <p className="mt-0.5 text-[12.5px] text-gray-700">{wave.signature[lang]}</p>
        </div>
        <Sparkline values={wave.volumeSeries} />
      </div>

      <div className="mt-1.5 grid gap-2 md:grid-cols-2">
        <div className="rounded-md border border-line bg-white p-2">
          <Field label={t("waves.p1.signature")}>{r.signature[lang]}</Field>
          <div className="mt-1 grid grid-cols-2 gap-1.5 text-[12.5px]">
            <div className="rounded bg-paper px-2 py-1">
              <span className="text-faint">{t("waves.p1.scan")}</span>{" "}
              <span className="font-mono font-bold text-navy">{r.scanTotal.toLocaleString()}</span>
            </div>
            <div className="rounded bg-paper px-2 py-1">
              <span className="text-faint">{t("waves.p1.writers")}</span>{" "}
              <span className="font-mono font-bold text-navy">{r.affectedWriters}</span>
            </div>
            <div className="rounded bg-paper px-2 py-1">
              <span className="text-faint">{t("waves.p1.silent")}</span>{" "}
              <span className="font-mono font-bold text-emerald-700">
                {r.silentVictims.toLocaleString()}
              </span>
            </div>
            <div className="rounded bg-paper px-2 py-1">
              <span className="text-faint">{t("waves.p1.amount")}</span>{" "}
              <span className="font-mono font-bold text-navy">
                ${r.amountTotalUsd.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5" data-id={`s3.waves.gates.${wave.id}`}>
          <Gate
            id={`s3.waves.confirm.${wave.id}`}
            done={r.bankErrorConfirmed}
            label={t("waves.p1.gateError")}
            btn={t("waves.p1.confirmBtn")}
            onAct={() => designTimeStore.confirmBankError(wave.id)}
          />
          <Gate
            id={`s3.waves.signSample.${wave.id}`}
            done={r.signedSample}
            label={t("waves.p1.gateSample")}
            btn={t("waves.p1.signBtn")}
            onAct={() => designTimeStore.signRemediation(wave.id, "sample")}
          />
          <Gate
            id={`s3.waves.signTotal.${wave.id}`}
            done={r.signedTotal}
            label={t("waves.p1.gateTotal", { total: r.amountTotalUsd.toLocaleString() })}
            btn={t("waves.p1.signBtn")}
            onAct={() => designTimeStore.signRemediation(wave.id, "total")}
          />
        </div>
      </div>

      <div className="mt-2 rounded-md border border-line bg-white p-2" data-id={`s3.waves.batches.${wave.id}`}>
        <div className="flex items-center justify-between">
          <div className="text-[12.5px] font-semibold text-navy">{t("waves.p1.stages")}</div>
          <div className="flex items-center gap-1 text-[12px] text-faint">
            <Undo2 size={12} /> {t("waves.p1.reversible")}
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          {r.batches.map((b, i) => (
            <div key={b.pct} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-center text-[12.5px]",
                  b.status === "done" && "border-emerald-400 bg-emerald-50 text-emerald-800",
                  b.status === "running" && "border-sky-400 bg-sky-50 text-sky-800",
                  b.status === "pending" && "border-line bg-paper text-faint",
                )}
              >
                <div className="font-mono font-bold">{b.pct}%</div>
                <div>
                  {b.accounts.toLocaleString()} · {cumulative(i).toLocaleString()} {t("waves.p1.cumulative")}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2">
          {done ? (
            <div className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700">
              <CheckCircle2 size={14} /> {t("waves.p1.complete")}
            </div>
          ) : (
            <button
              data-id={`s3.waves.batch.${wave.id}`}
              disabled={!gatesDone}
              onClick={() => designTimeStore.advanceRemediation(wave.id)}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play size={13} />
              {running
                ? t("waves.p1.finishBatch", { pct: running.pct })
                : next
                  ? t("waves.p1.startBatch", { pct: next.pct })
                  : t("waves.p1.waitGates")}
            </button>
          )}
          <span className="ml-2 text-[12px] text-faint">{t("waves.p1.idempotent", { prefix: r.idempotencyKeyPrefix })}</span>
        </div>
      </div>
    </div>
  );
}
