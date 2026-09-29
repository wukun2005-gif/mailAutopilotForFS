import { useTranslation } from "react-i18next";
import { UserCheck } from "lucide-react";

export function AgentScreen() {
  const { t } = useTranslation("common");
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-dashed border-navy-light/40 bg-paper p-8 text-center shadow-card">
        <UserCheck className="mx-auto mb-3 text-navy-light" size={32} />
        <p className="text-sm text-soft">{t("comingSoon.agent")}</p>
      </div>
    </div>
  );
}
