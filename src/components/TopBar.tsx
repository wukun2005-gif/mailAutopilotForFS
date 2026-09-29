import { useTranslation } from "react-i18next";
import { Mailbox, UserCheck, ShieldCheck, SlidersHorizontal, Settings2, Play, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCREENS, useUIStore, type ScreenId } from "@/store/uiStore";

const ICONS: Record<ScreenId, typeof Mailbox> = {
  customer: Mailbox,
  agent: UserCheck,
  supervisor: ShieldCheck,
  builder: SlidersHorizontal,
  settings: Settings2,
};

export function TopBar() {
  const { t, i18n } = useTranslation("common");
  const screen = useUIStore((s) => s.screen);
  const setScreen = useUIStore((s) => s.setScreen);
  const demoActive = useUIStore((s) => s.demoActive);

  const toggleLang = () =>
    i18n.changeLanguage(i18n.language?.startsWith("zh") ? "en" : "zh");

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
          {/* Sim clock chip — wired to simClock in M1 */}
          <div
            data-testid="sim-clock-chip"
            className="hidden items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/70 md:flex"
            title={t("mode.simClock")}
          >
            <Clock size={12} />
            <span className="font-mono">--:--</span>
          </div>

          {/* Mock / live badge — live toggle lands in M3 */}
          <div
            data-testid="data-mode-badge"
            className="rounded-full bg-teal/20 px-2.5 py-1 text-[11px] font-medium text-teal-soft"
          >
            {t("mode.mock")}
          </div>

          <button
            onClick={toggleLang}
            data-testid="lang-toggle"
            className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-white/80 transition-colors hover:bg-white/10"
          >
            {t("language")}
          </button>

          <button
            disabled
            data-testid="demo-button"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium",
              demoActive
                ? "bg-amber text-white"
                : "cursor-not-allowed bg-white/10 text-white/40",
            )}
            title="M7"
          >
            <Play size={12} />
            {demoActive ? t("demo.stop") : t("demo.start")}
          </button>
        </div>
      </div>
    </header>
  );
}
