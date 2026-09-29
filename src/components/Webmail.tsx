// Webmail — mock customer webmail (three panes). It deliberately shows ONLY
// the customer's inbound-side messages: the bank's replies carry account data
// and therefore arrive as secure messages in the app (PhoneApp), never as
// email links. This is the anti-phishing story (FR-2.2 default path).
import { useMemo, useState } from "react";
import { Inbox, Paperclip, Search } from "lucide-react";
import { INBOUND_EMAILS } from "@/mocks/fixtures/index.ts";
import type { ScenarioId } from "@/runtime/scenarios.ts";
import { useCaseStore } from "@/store/caseStore";
import { cn } from "@/lib/utils";

const FOLDERS = ["Inbox", "Sent", "Drafts", "Spam"];

export function Webmail({ scenarioId }: { scenarioId: ScenarioId }) {
  const caseState = useCaseStore((s) => s.caseState);
  const emails = useMemo(
    () => INBOUND_EMAILS.filter((e) => e.scenarioId === scenarioId),
    [scenarioId],
  );
  const threads = useMemo(() => {
    const map = new Map<string, typeof emails>();
    for (const e of emails) {
      const list = map.get(e.threadId) ?? [];
      list.push(e);
      map.set(e.threadId, list);
    }
    return [...map.entries()];
  }, [emails]);
  const [activeThread, setActiveThread] = useState(threads[0]?.[0] ?? "");
  const thread = threads.find(([id]) => id === activeThread)?.[1] ?? emails;

  // Only show emails the simulated clock has reached (atDayN <= current day).
  const dayN = useCaseStore((s) => s.clock.dayN);
  const visible = thread.filter((e) => e.atDayN <= dayN);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-line bg-white shadow-sm">
      {/* mock mail chrome */}
      <div className="flex items-center gap-2 border-b border-line bg-gray-50 px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-red-500 text-[10px] font-bold text-white">
          M
        </div>
        <span className="text-[11px] font-semibold text-gray-600">Jane's webmail</span>
        <div className="ml-3 flex flex-1 items-center gap-1 rounded bg-white px-2 py-1 text-[10px] text-faint ring-1 ring-line">
          <Search size={11} /> search mail
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* folders */}
        <div className="hidden w-32 shrink-0 border-r border-line bg-gray-50 p-2 sm:block">
          {FOLDERS.map((f) => (
            <div
              key={f}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-[11px]",
                f === "Sent" ? "bg-white font-medium text-navy ring-1 ring-line" : "text-gray-500",
              )}
            >
              <Inbox size={12} /> {f}
            </div>
          ))}
        </div>
        {/* thread list */}
        <div className="w-44 shrink-0 overflow-y-auto border-r border-line">
          {threads.map(([id, list]) => {
            const first = list[0];
            return (
              <button
                key={id}
                onClick={() => setActiveThread(id)}
                className={cn(
                  "block w-full border-b border-line px-2.5 py-2 text-left",
                  activeThread === id && "bg-navy-soft",
                )}
              >
                <div className="truncate text-[11px] font-semibold text-ink">
                  {first.to.includes("disputes") ? "Larkspur Disputes" : "Larkspur Support"}
                </div>
                <div className="truncate text-[10.5px] text-gray-600">{first.subject.en}</div>
                <div className="text-[9.5px] text-faint">{list.length} message(s) · sent by Jane</div>
              </button>
            );
          })}
        </div>
        {/* open thread */}
        <div className="min-w-0 flex-1 overflow-y-auto p-3">
          <div className="mb-2 rounded bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
            Account answers never arrive by email and contain no links — check
            secure messages in the Larkspur app.
          </div>
          {visible.length === 0 && (
            <div className="mt-10 text-center text-[11px] text-faint">
              no mail at the current simulated time
            </div>
          )}
          {visible.map((e) => (
            <article key={e.id} className="mb-3 border-b border-line pb-3">
              <div className="text-[12px] font-semibold text-ink">{e.subject.en}</div>
              <div className="mt-0.5 text-[10px] text-faint">
                {e.from} → {e.to} · Day {e.atDayN} {e.atTime}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-800">
                {e.body.en}
              </p>
              {e.attachments?.map((a) => (
                <div
                  key={a.id}
                  className="mt-1.5 inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[10px] text-gray-600"
                >
                  <Paperclip size={11} /> {a.name}
                </div>
              ))}
              <div className="mt-1 text-[9.5px] text-faint">
                identity at intake: {caseState?.identity?.level ?? "—"} ·{" "}
                {caseState?.identity?.reasonCodes.join(", ")}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
