// Opening card (Dev Plan §8.2 stage 0): every script starts by putting the
// whole agenda in the middle of the screen with this run's row lit, so the
// audience knows which section they are about to see before the first beat
// lands. BGM plays under it and nothing is voiced — the card is read.
//
// Purely visual. The runner owns the window (see DemoRunner.showAgenda) and
// the store owns which row is lit (agendaScriptId), so clicking here only
// asks the runner to cut the card short.
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { AGENDA } from "@/demo/agenda.ts";
import { useDemoStore } from "@/demo/demoStore.ts";
import { demoRunner } from "@/demo/runner.ts";

export function AgendaCard() {
  const agendaScriptId = useDemoStore((s) => s.agendaScriptId);
  const { t } = useTranslation("demo");

  return (
    <AnimatePresence>
      {agendaScriptId && (
        <motion.div
          key="agenda"
          data-id="demo.agenda"
          data-script={agendaScriptId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => demoRunner.dismissAgenda()}
          className="fixed inset-0 z-[10001] flex cursor-pointer items-center justify-center bg-navy/55 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ scale: 0.97, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: -4 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="w-[min(1200px,94vw)] rounded-2xl bg-paper px-8 py-7 shadow-2xl ring-1 ring-black/10"
          >
            <ul className="space-y-1.5">
              {AGENDA.map((row) => {
                const active = row.scriptId === agendaScriptId;
                return (
                  <li
                    key={row.scriptId}
                    data-id={`demo.agenda.${row.key}`}
                    data-active={active ? "true" : "false"}
                    className={cn(
                      "flex items-baseline gap-4 rounded-lg px-4 py-2.5 transition-colors",
                      active
                        ? "bg-teal text-white shadow-md ring-1 ring-teal-dark"
                        : "text-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "w-[270px] shrink-0 whitespace-nowrap text-[17px] font-semibold",
                        active ? "text-white" : "text-navy",
                      )}
                    >
                      {t(`agenda.items.${row.key}.title`)}
                    </span>
                    <span className={cn("text-[16px] leading-snug", active ? "text-white/95" : "")}>
                      {t(`agenda.items.${row.key}.desc`)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}