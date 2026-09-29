import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Mailbox, UserCheck, ShieldCheck, SlidersHorizontal, Settings2, Play, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCREENS, useUIStore, type ScreenId } from "@/store/uiStore";
import { simClock } from "@/runtime/simClock";
import { SCRIPTS } from "@/demo/scripts.ts";
import { demoRunner } from "@/demo/runner.ts";

const ICONS: Record<ScreenId, typeof Mailbox> = {
  customer: Mailbox,
  agent: UserCheck,
  supervisor: ShieldCheck,
  builder: SlidersHorizontal,
  settings: Settings2,
};

export function TopBar() {
  const { t, i18n } = useTranslation(["common", "demo"]);
  const screen = useUIStore((s) => s.screen);
  const setScreen = useUIStore((s) => s.setScreen);
  const demoActive = useUIStore((s) => s.demoActive);
  const [, setTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleLang = () =>
    i18n.changeLanguage(i18n.language?.startsWith("zh") ? "en" : "zh");

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 500);
    return () => window.clearInterval(id);
  }, []);
  const clockLabel = format(new Date(simClock.now()), "MM/dd HH:mm");

  return (
    <header className="bg-navy text-white shadow-card">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4">
        {/* Brand */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal text-white">
            <Mailbox size={18} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-wide">
              {t("app.title")}
            </div>
            <div className="text-[10px] text-white/60">{t("app.bank")}</div>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="ml-2 flex h-full items-stretch gap-0.5">
          {SCREENS.map((id) => {
            const Icon = ICONS[id];
            const active = screen === id;
            return (
              <button
                key={id}
                data-nav={id}
                onClick={() => setScreen(id)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 text-[13px] transition-colors",
                  active
                    ? "font-semibold text-white"
                    : "text-white/65 hover:text-white",
                )}
              >
                <Icon size={15} />
                <span>{t(`nav.${id}`)}</span>
                <span
                  className={cn(
                    "rounded px-1 text-[9px]",
                    active ? "bg-teal text-white" : "bg-white/10 text-white/50",
                  )}
                >
                  {t(`navHint.${id}`)}
                </span>
                {active && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-teal" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Sim clock chip */}
          <div
            data-testid="sim-clock-chip"
            className="hidden items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/70 md:flex"
            title={t("mode.simClock")}
          >
            <Clock size={12} />
            <span className="font-mono">{clockLabel}</span>
          </div>

          {/* Mock / live badge */}
          <div className="rounded-full bg-teal/20 px-2.5 py-1 text-[11px] font-medium text-teal-soft">
            {t("mode.mock")}
          </div>

          <button
            onClick={toggleLang}
            data-id="top.lang"
            data-testid="lang-toggle"
            className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-white/80 transition-colors hover:bg-white/10"
          >
            {t("language")}
          </button>

          {/* Demo script picker */}
          <div className="relative">
            <button
              data-id="top.demo"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium",
                demoActive ? "bg-amber-500 text-white" : "bg-teal text-white hover:bg-teal/90",
              )}
            >
              <Play size={12} />
              {demoActive ? t("demo:playing") : t("demo:start")}
              <ChevronDown size={12} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-white py-1 text-navy shadow-xl">
                {SCRIPTS.map((s) => (
                  <button
                    key={s.id}
                    data-id={`demo.script.${s.id}`}
                    onMouseDown={() => {
                      setMenuOpen(false);
                      void demoRunner.start(s.id);
                    }}
                    className="block w-full px-3 py-2 text-left text-[11.5px] hover:bg-paper"
                  >
                    {t(`demo:${s.nameKey}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
