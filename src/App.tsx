import { useEffect } from "react";
import { TopBar } from "@/components/TopBar";
import { ScenarioBar } from "@/components/ScenarioBar";
import { FakeCursor } from "@/components/demo/FakeCursor";
import { DemoControlBar } from "@/components/demo/DemoControlBar";
import { bindHashSync, useUIStore } from "@/store/uiStore";
import { CustomerScreen } from "@/screens/CustomerScreen";
import { AgentScreen } from "@/screens/AgentScreen";
import { SupervisorScreen } from "@/screens/SupervisorScreen";
import { BuilderScreen } from "@/screens/BuilderScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";

export default function App() {
  const screen = useUIStore((s) => s.screen);

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
      <FakeCursor />
      <DemoControlBar />
    </div>
  );
}
