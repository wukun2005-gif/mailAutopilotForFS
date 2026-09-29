// One expandable provider card — ported from HarnessWindTunnel Settings
// (LLM tab), restyled to match the reference layout. Model default +
// fallback ordering is drag-and-drop; verification pings the real API.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, AlertTriangle, GripVertical, Loader2 } from "lucide-react";
import type { PresetProvider } from "../../../shared/provider.ts";
import { providerApi } from "@/lib/providerApi.ts";
import { cn } from "@/lib/utils";

export interface CardForm {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  modelIds: string[];
  defaultModelId: string;
  modelFallbacks: string[];
  enableModelFallback: boolean;
  hasKey: boolean;
}

export function ProviderCard({
  preset,
  form,
  expanded,
  dragHandle,
  onToggleExpanded,
  onChange,
  onSaved,
  notify,
  lang,
}: {
  preset: PresetProvider;
  form: CardForm;
  expanded: boolean;
  dragHandle?: React.ReactNode;
  onToggleExpanded: () => void;
  onChange: (patch: Partial<CardForm>) => void;
  onSaved: () => Promise<void>;
  notify: (type: "success" | "error", msg: string) => void;
  lang: string;
}) {
  const { t } = useTranslation("settings");
  const [busy, setBusy] = useState<"" | "models" | "verify">("");
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const name = lang === "zh" ? preset.name : preset.nameEn ?? preset.name;
  const desc = lang === "zh" ? preset.desc : preset.descEn ?? preset.desc;
  const isDecision = preset.kind === "decision";
  const fallbacks = form.modelFallbacks.length ? form.modelFallbacks : form.modelIds;
  const isConfigured = form.hasKey || !!form.apiKey;

  const queryModels = async () => {
    setBusy("models");
    try {
      const r = await providerApi.queryModels(preset.id, form.apiKey, form.baseUrl);
      const models = r.models;
      const keep = fallbacks.filter((m) => models.includes(m));
      const merged = [...keep, ...models.filter((m) => !keep.includes(m))];
      onChange({
        modelIds: models,
        modelFallbacks: merged,
        defaultModelId: form.defaultModelId || models[0] || "",
      });
      setBusy("verify");
      const marks: Record<string, boolean> = {};
      for (const m of models.slice(0, 8)) {
        const v = await providerApi.verifyModel(preset.id, m);
        marks[m] = v.ok;
      }
      setVerified(marks);
      notify("success", t("queried", { count: models.length }));
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const setDefault = (model: string) => {
    onChange({
      defaultModelId: model,
      modelFallbacks: [model, ...fallbacks.filter((m) => m !== model)],
    });
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const list = [...fallbacks];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    onChange({ modelFallbacks: list });
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-white",
        !form.enabled && "opacity-60",
      )}
      data-id={`settings.card.${preset.id}`}
    >
      {/* Card header row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {dragHandle}
        <button onClick={onToggleExpanded} className="flex flex-1 items-center gap-2 text-left">
          <span className="text-[15px] text-faint">{expanded ? "▼" : "▶"}</span>
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-full",
              form.enabled ? "bg-emerald-500" : "bg-gray-300",
            )}
          />
          <b className="text-[18px] text-navy">{name}</b>
          {isDecision && (
            <span className="rounded-full border border-amber/40 bg-amber-soft px-2 py-0.5 text-[15px] text-amber">
              {t("decisionBadge")}
            </span>
          )}
          <span className="hidden truncate text-[16px] text-faint md:inline">{desc}</span>
        </button>
        <label
          className="flex items-center gap-1.5 text-[16px] text-faint"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={form.enableModelFallback}
            onChange={(e) => onChange({ enableModelFallback: e.target.checked })}
          />
          {t("modelFallback")}
        </label>
        <label
          className="flex items-center gap-1.5 text-[16px]"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          {t("enabled")}
        </label>
        <span
          className={cn(
            "whitespace-nowrap rounded-full border px-2 py-0.5 text-[15px]",
            isConfigured
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-gray-200 bg-gray-100 text-gray-500",
          )}
        >
          {isConfigured ? t("configured") : t("needKey")}
        </span>
        {form.modelIds.length > 0 && (
          <span className="whitespace-nowrap text-[16px] text-faint">
            {t("models", { count: form.modelIds.length })}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-3 border-t border-line px-3 py-3">
          <label className="grid gap-1 text-[16px] text-faint">
            API Key
            <input
              type="password"
              autoComplete="off"
              data-id={`settings.key.${preset.id}`}
              value={form.apiKey}
              placeholder={form.hasKey ? `stored (${form.apiKey ? "" : "••••"})` : preset.keyPlaceholder}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              className="rounded border border-line px-2.5 py-1.5 font-mono text-[17px] text-ink"
            />
          </label>
          <label className="grid gap-1 text-[16px] text-faint">
            Base URL
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => onChange({ baseUrl: e.target.value })}
              placeholder={preset.defaultBaseUrl || "https://api.example.com/v1"}
              className="rounded border border-line px-2.5 py-1.5 font-mono text-[17px] text-ink"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={queryModels}
              disabled={busy !== "" || (!form.apiKey && !form.hasKey)}
              className="flex items-center gap-1 rounded bg-navy px-3 py-1.5 text-[17px] text-white disabled:opacity-40"
            >
              {busy !== "" && <Loader2 size={13} className="animate-spin" />}
              {busy === "models" ? t("querying") : t("queryModels")}
            </button>
            <button
              onClick={() => void onSaved()}
              className="rounded bg-teal px-3 py-1.5 text-[17px] text-white"
            >
              {t("save")}
            </button>
          </div>

          {fallbacks.length > 0 && (
            <div>
              <div className="mb-1.5 text-[16px] text-faint">{t("defaultModel")}</div>
              <table className="w-full text-[16px]">
                <thead className="text-faint">
                  <tr>
                    <th className="w-7 text-left">#</th>
                    <th className="text-left">model</th>
                    <th className="w-20 text-left">{t("recommended")}</th>
                    <th className="w-24 text-left">{t("quota")}</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {fallbacks.map((m, i) => {
                    const isDefault = m === form.defaultModelId;
                    return (
                      <tr
                        key={m}
                        className={cn(
                          "border-b border-line/50",
                          isDefault && "bg-navy-soft",
                        )}
                        draggable
                        onDragStart={() => setDragFrom(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragFrom !== null) reorder(dragFrom, i);
                          setDragFrom(null);
                        }}
                      >
                        <td className="cursor-grab text-faint">
                          <GripVertical size={13} />
                        </td>
                        <td className="font-mono text-[16px]">
                          {m}
                          {isDefault && (
                            <span className="ml-2 rounded bg-teal px-1.5 py-0.5 text-[14px] text-white">
                              {t("currentDefault")}
                            </span>
                          )}
                          {verified[m] === true && (
                            <Check size={14} className="ml-1 inline text-emerald-600" />
                          )}
                          {verified[m] === false && (
                            <AlertTriangle size={14} className="ml-1 inline text-amber-600" />
                          )}
                        </td>
                        <td className="text-[16px] text-soft">—</td>
                        <td className="text-[16px] text-soft">—</td>
                        <td>
                          {!isDefault && (
                            <button
                              onClick={() => setDefault(m)}
                              className="rounded border border-line px-2 py-0.5 text-[16px] text-navy hover:border-navy-light"
                            >
                              {t("setDefault")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
