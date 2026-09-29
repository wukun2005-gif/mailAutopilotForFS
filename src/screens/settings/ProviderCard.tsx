// One expandable provider card — ported from HarnessWindTunnel Settings
// (LLM tab), trimmed to chat providers and restyled. Model default +
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
  onToggleExpanded,
  onChange,
  onSaved,
  notify,
}: {
  preset: PresetProvider;
  form: CardForm;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (patch: Partial<CardForm>) => void;
  onSaved: () => Promise<void>;
  notify: (type: "success" | "error", msg: string) => void;
}) {
  const { t, i18n } = useTranslation("settings");
  const [busy, setBusy] = useState<"" | "models" | "verify">("");
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const name = i18n.language?.startsWith("zh") ? preset.name : preset.nameEn;
  const desc = i18n.language?.startsWith("zh") ? preset.desc : preset.descEn;
  const fallbacks = form.modelFallbacks.length ? form.modelFallbacks : form.modelIds;

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
      className={cn("rounded-lg border border-line bg-white", !form.enabled && "opacity-60")}
      data-id={`settings.card.${preset.id}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={onToggleExpanded} className="flex flex-1 items-center gap-2 text-left">
          <span className="text-[10px] text-faint">{expanded ? "▼" : "▶"}</span>
          <span className={cn("h-2 w-2 rounded-full", form.enabled ? "bg-emerald-500" : "bg-gray-300")} />
          <b className="text-[13px] text-navy">{name}</b>
          <span className="hidden truncate text-[11px] text-faint md:inline">{desc}</span>
        </button>
        <label className="flex items-center gap-1 text-[10.5px] text-faint" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={form.enableModelFallback}
            onChange={(e) => onChange({ enableModelFallback: e.target.checked })}
          />
          {t("modelFallback")}
        </label>
        <label className="flex items-center gap-1 text-[10.5px]" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          {t("enabled")}
        </label>
        <span className={cn("rounded px-1.5 py-0.5 text-[10px]",
          form.hasKey || form.apiKey ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500")}>
          {form.hasKey || form.apiKey ? t("configured") : t("needKey")}
        </span>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-line px-3 py-2.5">
          <label className="grid gap-1 text-[11px] text-faint">
            API Key
            <input
              type="password"
              autoComplete="off"
              data-id={`settings.key.${preset.id}`}
              value={form.apiKey}
              placeholder={form.hasKey ? `stored (${form.apiKey ? "" : "••••"})` : preset.keyPlaceholder}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              className="rounded border border-line px-2 py-1 font-mono text-[12px] text-ink"
            />
          </label>
          <label className="grid gap-1 text-[11px] text-faint">
            Base URL
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => onChange({ baseUrl: e.target.value })}
              className="rounded border border-line px-2 py-1 font-mono text-[12px] text-ink"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={queryModels}
              disabled={busy !== "" || (!form.apiKey && !form.hasKey)}
              className="flex items-center gap-1 rounded bg-navy px-2.5 py-1 text-[11px] text-white disabled:opacity-40"
            >
              {busy !== "" && <Loader2 size={11} className="animate-spin" />}
              {t("queryModels")}
            </button>
            <button
              onClick={() => void onSaved()}
              className="rounded bg-teal px-2.5 py-1 text-[11px] text-white"
            >
              {t("save")}
            </button>
          </div>

          {fallbacks.length > 0 && (
            <table className="w-full text-[11px]">
              <thead className="text-faint">
                <tr>
                  <th className="w-6" />
                  <th className="text-left">model</th>
                  <th className="w-24 text-left">{t("verify")}</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {fallbacks.map((m, i) => {
                  const isDefault = m === form.defaultModelId;
                  return (
                    <tr
                      key={m}
                      className={isDefault ? "bg-navy-soft" : undefined}
                      draggable
                      onDragStart={() => setDragFrom(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragFrom !== null) reorder(dragFrom, i);
                        setDragFrom(null);
                      }}
                    >
                      <td className="cursor-grab text-faint"><GripVertical size={11} /></td>
                      <td className="font-mono">
                        {m}
                        {isDefault && <span className="ml-2 rounded bg-teal px-1 text-[9px] text-white">default</span>}
                      </td>
                      <td>
                        {verified[m] === true && <Check size={12} className="text-emerald-600" />}
                        {verified[m] === false && <AlertTriangle size={12} className="text-amber-600" />}
                      </td>
                      <td>
                        {!isDefault && (
                          <button onClick={() => setDefault(m)} className="text-[10px] text-navy underline">
                            {t("setDefault")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
