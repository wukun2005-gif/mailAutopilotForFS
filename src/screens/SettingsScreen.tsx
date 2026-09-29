// Settings — LLM provider configuration ported from HarnessWindTunnel
// (Dev Plan §11). Seven preset OpenAI-compatible cards; raw keys live only
// in the local Dev BFF store, never in the browser bundle. Live calls power
// only the read-only "general inquiry" easter-egg node; the recorded demo
// runs fully offline.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, MessageSquareText, Loader2 } from "lucide-react";
import {
  PRESET_PROVIDERS,
  trimBaseUrl,
  type ProviderConfig,
} from "../../shared/provider.ts";
import { providerApi, type PublicSettings } from "@/lib/providerApi.ts";
import { ProviderCard, type CardForm } from "./settings/ProviderCard.tsx";

const EXPANDED_KEY = "eap-provider-expanded";

function loadExpanded(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function SettingsScreen() {
  const { t } = useTranslation("settings");
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [forms, setForms] = useState<Record<string, CardForm>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded);
  const [enableFallback, setEnableFallback] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [probe, setProbe] = useState<{ q: string; a: string; busy: boolean }>({ q: "", a: "", busy: false });

  const notify = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    try {
      const s = await providerApi.getSettings();
      setSettings(s);
      setEnableFallback(s.enableProviderFallback);
      const map: Record<string, CardForm> = {};
      for (const p of s.providers) {
        map[p.providerId] = {
          enabled: p.enabled,
          apiKey: p.hasKey ? p.apiKeyMasked : "",
          baseUrl: p.baseUrl,
          modelIds: p.modelIds,
          defaultModelId: p.defaultModelId,
          modelFallbacks: p.modelFallbacks,
          enableModelFallback: p.enableModelFallback,
          hasKey: p.hasKey,
        };
      }
      setForms(map);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (id: string, p: Partial<CardForm>) =>
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));

  const buildSaveList = (): ProviderConfig[] =>
    PRESET_PROVIDERS.map((preset) => {
      const c = forms[preset.id];
      if (!c) return null;
      return {
        providerId: preset.id,
        enabled: c.enabled,
        apiKey: c.apiKey.trim(),
        baseUrl: trimBaseUrl(c.baseUrl),
        modelIds: c.modelIds,
        defaultModelId: c.defaultModelId,
        modelFallbacks: c.modelFallbacks,
        enableModelFallback: c.enableModelFallback,
      } as ProviderConfig;
    }).filter((x): x is ProviderConfig => x !== null);

  const save = async () => {
    try {
      await providerApi.saveProviders(buildSaveList(), enableFallback);
      notify("success", t("saved"));
      await load();
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    }
  };

  const liveProbe = async () => {
    if (!probe.q.trim()) return;
    setProbe((p) => ({ ...p, busy: true, a: "" }));
    try {
      const r = await providerApi.chat([{ role: "user", content: probe.q }]);
      setProbe((p) => ({ ...p, busy: false, a: r.ok ? r.content ?? "" : r.error ?? "error" }));
    } catch (e) {
      setProbe((p) => ({ ...p, busy: false, a: e instanceof Error ? e.message : String(e) }));
    }
  };

  const orderedPresets = useMemo(() => PRESET_PROVIDERS, []);

  return (
    <div className="h-full overflow-y-auto" data-id="settings.screen">
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <div>
          <h1 className="text-[16px] font-semibold text-navy">{t("title")}</h1>
          <p className="text-[11.5px] text-faint">{t("desc")}</p>
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-[12px]">
          <input
            type="checkbox"
            checked={enableFallback}
            onChange={(e) => {
              setEnableFallback(e.target.checked);
              void providerApi
                .saveProviders(buildSaveList(), e.target.checked)
                .catch(() => setEnableFallback(!e.target.checked));
            }}
          />
          <b className="text-navy">{t("enableFallback")}</b>
          <span className="text-faint">{t("fallbackDesc")}</span>
        </label>

        {/* live LLM easter-egg: read-only general inquiry */}
        <div className="rounded-lg border border-dashed border-navy-light/50 bg-navy-soft/50 p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-navy">
            <MessageSquareText size={13} /> {t("probeTitle")}
          </div>
          <p className="mt-0.5 text-[10.5px] text-faint">{t("probeDesc")}</p>
          <div className="mt-2 flex gap-2">
            <input
              data-id="settings.probe.input"
              value={probe.q}
              onChange={(e) => setProbe((p) => ({ ...p, q: e.target.value }))}
              placeholder={t("probePlaceholder")}
              className="flex-1 rounded border border-line px-2 py-1 text-[12px]"
            />
            <button
              data-id="settings.probe.send"
              onClick={liveProbe}
              disabled={probe.busy}
              className="flex items-center gap-1 rounded bg-navy px-3 py-1 text-[11px] text-white disabled:opacity-40"
            >
              {probe.busy && <Loader2 size={11} className="animate-spin" />}
              {t("probeSend")}
            </button>
          </div>
          {probe.a && <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-2 text-[11px]">{probe.a}</pre>}
        </div>

        <div className="flex justify-end">
          <button
            data-id="settings.save"
            onClick={save}
            className="flex items-center gap-1.5 rounded bg-teal px-4 py-1.5 text-[12px] font-semibold text-white"
          >
            <Save size={13} /> {t("saveAll")}
          </button>
        </div>

        <div className="space-y-2">
          {orderedPresets.map((preset) => {
            const form = forms[preset.id];
            if (!form || !settings) return null;
            return (
              <ProviderCard
                key={preset.id}
                preset={preset}
                form={form}
                expanded={!!expanded[preset.id]}
                onToggleExpanded={() =>
                  setExpanded((prev) => {
                    const next = { ...prev, [preset.id]: !prev[preset.id] };
                    localStorage.setItem(EXPANDED_KEY, JSON.stringify(next));
                    return next;
                  })
                }
                onChange={(p) => patch(preset.id, p)}
                onSaved={save}
                notify={notify}
              />
            );
          })}
        </div>
      </div>

      {toast && (
        <div
          className={`fixed right-5 top-16 z-50 rounded px-4 py-2 text-[12px] text-white ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
