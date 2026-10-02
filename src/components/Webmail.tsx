// Webmail — mock customer webmail (three panes). Shows the customer's inbound
// messages plus the bank's in-thread email replies (procedural notices only).
// Replies carrying account data stay in the app (PhoneApp) — that split is
// the anti-phishing story (FR-2.2 default path).
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Inbox, Paperclip, Search } from "lucide-react";
import { INBOUND_EMAILS } from "@/mocks/fixtures/index.ts";
import type { ScenarioId } from "@/runtime/scenarios.ts";
import { useCaseStore } from "@/store/caseStore";
import { DAY0_EPOCH, diffCalendarDays } from "@/runtime/simClock.ts";
import { TricolorLetter } from "./TricolorLetter";
import { cn } from "@/lib/utils";


export function Webmail({ scenarioId }: { scenarioId: ScenarioId }) {
  const { t } = useTranslation("customer");
  const FOLDERS = [
    { key: "inbox", label: t("webmail.folders.inbox") },
    { key: "sent", label: t("webmail.folders.sent") },
    { key: "drafts", label: t("webmail.folders.drafts") },
    { key: "spam", label: t("webmail.folders.spam") },
  ];
  const caseState = useCaseStore((s) => s.caseState);
  const emails = useMemo(
    () => INBOUND_EMAILS.filter((e) => e.scenarioId === scenarioId),
    [scenarioId],
  );
  // Bank replies that go by email join the original thread, so the customer
  // keeps one conversation history (sensitive replies stay in the app).
  const replies = useMemo(() => {
    const drafts = new Map((caseState?.drafts ?? []).map((d) => [d.id, d]));
    return (caseState?.outbound ?? [])
      .filter((o) => o.channel === "email" && !o.blockedReason && o.draftId)
      .map((o) => ({ record: o, draft: drafts.get(o.draftId!) }))
      .filter((x): x is { record: (typeof x.record); draft: NonNullable<typeof x.draft> } => !!x.draft);
  }, [caseState]);
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
  // Scenario switch remounts the thread list: drop the stale selection so
  // in-thread bank replies match again.
  useEffect(() => {
    setActiveThread(threads[0]?.[0] ?? "");
  }, [scenarioId]);
  const thread = threads.find(([id]) => id === activeThread)?.[1] ?? emails;

  // Only show emails the simulated clock has reached (atDayN <= current day).
  const dayN = useCaseStore((s) => s.clock.dayN);
  const visible = thread.filter((e) => e.atDayN <= dayN);
  const threadReplies = replies
    .filter(({ record }) => (record.threadId ?? threads[0]?.[0]) === activeThread)
    .filter(({ record }) => diffCalendarDays(DAY0_EPOCH, record.atSimTime) <= dayN)
    .sort((a, b) => a.record.atSimTime - b.record.atSimTime);

  // Newest first (email convention): inbound and replies interleaved by time.
  // Inbound stamps reuse the sim-clock formula so both sides share a baseline.
  const inboundEpoch = (atDayN: number, atTime?: string) => {
    const [h, m] = (atTime ?? "08:14").split(":").map(Number);
    return Date.UTC(2026, 8, 22 + atDayN, h ?? 8, m ?? 0, 0, 0);
  };
  const items = [
    ...visible.map((e, i) => ({ key: e.id, mins: (inboundEpoch(e.atDayN, e.atTime) - DAY0_EPOCH) / 60000, pos: i, kind: "in" as const, e })),
    ...threadReplies.map(({ record, draft }, i) => ({
      key: record.id,
      mins: (record.atSimTime - DAY0_EPOCH) / 60000,
      pos: i,
      kind: "out" as const,
      record,
      draft,
    })),
    // Newest first; same instant → replies before requests, later reply first.
  ].sort((a, b) => b.mins - a.mins || (a.kind === b.kind ? b.pos - a.pos : a.kind === "out" ? -1 : 1));

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-line bg-white shadow-sm">
      {/* mock mail chrome */}
      <div className="flex items-center gap-2 border-b border-line bg-gray-50 px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-red-500 text-[13px] font-bold text-white">
          M
        </div>
        <span className="text-[14px] font-semibold text-gray-600">{t("webmail.title")}</span>
        <div className="ml-3 flex flex-1 items-center gap-1 rounded bg-white px-2 py-1 text-[13px] text-faint ring-1 ring-line">
          <Search size={11} /> {t("webmail.search")}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* folders */}
        <div className="hidden w-32 shrink-0 border-r border-line bg-gray-50 p-2 sm:block">
          {FOLDERS.map((f) => (
            <div
              key={f.key}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-[14px]",
                f.key === "sent" ? "bg-white font-medium text-navy ring-1 ring-line" : "text-gray-500",
              )}
            >
              <Inbox size={12} /> {f.label}
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
                <div className="truncate text-[14px] font-semibold text-ink">
                  {first.to.includes("disputes") ? t("webmail.disputes") : t("webmail.support")}
                </div>
                <div className="truncate text-[13.5px] text-gray-600">{first.subject.en}</div>
                <div className="text-[12.5px] text-faint">{t("webmail.msgCount", { count: list.length })}</div>
              </button>
            );
          })}
        </div>
        {/* open thread. The bottom padding is scroll room, not layout: the last
            line of a message is its intake-identity line, and the demo
            playback bar floats over the bottom of the pane — without the room
            the demo cannot scroll that line clear of the bar. */}
        <div className="min-w-0 flex-1 overflow-y-auto p-3 pb-16" data-id="s1.thread">
          <div className="mb-2 rounded bg-amber-50 px-2 py-1.5 text-[13px] text-amber-800">
            {t("webmail.banner")}
          </div>
          {items.length === 0 && (
            <div className="mt-10 text-center text-[14px] text-faint">
              {t("webmail.noMail")}
            </div>
          )}
          {items.map((item) =>
            item.kind === "in" ? (
              <article
                key={item.key}
                className="mb-3 border-b border-line pb-3"
                // Newest first, so the first match is the customer's latest
                // message: the demo points at a thread item by direction.
                data-id="s1.thread.in"
              >
                <div className="text-[15px] font-semibold text-ink">{item.e.subject.en}</div>
                <div className="mt-0.5 text-[13px] text-faint">
                  {item.e.from} → {item.e.to} · Day {item.e.atDayN} {item.e.atTime}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">
                  {item.e.body.en}
                </p>
                {item.e.attachments?.map((a) => (
                  <div
                    key={a.id}
                    className="mt-1.5 inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[13px] text-gray-600"
                  >
                    <Paperclip size={11} /> {a.name}
                  </div>
                ))}
                <div
                  className="mt-1 text-[12.5px] text-faint"
                  // The identity the arrival was filed at, printed under the
                  // message: the same verdict the audit view opens on.
                  data-id="s1.thread.in.identity"
                >
                  {t("webmail.identityAtIntake", {
                    level: caseState?.identity?.level
                      ? t(`identity.levels.${caseState.identity.level}`, {
                          defaultValue: caseState.identity.level,
                        })
                      : "—",
                  })}
                </div>
              </article>
            ) : (
              <article
                key={item.key}
                className="mb-3 rounded-lg border border-teal/30 bg-teal-soft/40 p-2.5"
                data-id="s1.thread.out"
              >
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-teal px-1.5 py-px text-[12px] font-medium text-white">
                    {t("webmail.bankReply")}
                  </span>
                  <span className="text-[15px] font-semibold text-ink">
                    {item.draft.subject ?? t("webmail.disputes")}
                  </span>
                </div>
                <div className="mt-0.5 text-[13px] text-faint">
                  Larkspur Bank → Jane · Day {diffCalendarDays(DAY0_EPOCH, item.record.atSimTime)}
                </div>
                <div className="mt-1.5">
                  <TricolorLetter draft={item.draft} />
                </div>
              </article>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
