import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TopBar } from "@/components/TopBar";
import { ScenarioBar } from "@/components/ScenarioBar";
import { bindHashSync, useUIStore } from "@/store/uiStore";
import { CustomerScreen } from "@/screens/CustomerScreen";
import { AgentScreen } from "@/screens/AgentScreen";
import { SupervisorScreen } from "@/screens/SupervisorScreen";
import { BuilderScreen } from "@/screens/BuilderScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";

export default function App() {
  const screen = useUIStore((s) => s.screen);
  const { t } = useTranslation("common");

  useEffect(() => bindHashSync(), []);

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <ScenarioBar />
      <main className="min-h-0 flex-1 overflow-hidden bg-paper">
        {screen === "customer" && <CustomerScreen />}
        {screen === "agent" && <AgentScreen />}
        {screen === "supervisor" && <SupervisorScreen />}
        {screen === "builder" && <BuilderScreen />}
        {screen === "settings" && <SettingsScreen />}
      </main>
      <footer className="shrink-0 border-t border-line bg-paper px-4 py-1.5 text-center text-[10px] text-faint">
        {t("footer.fictional")}
      </footer>
    </div>
  );
}
