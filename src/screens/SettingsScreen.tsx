// Provider settings — ported from HarnessWindTunnel/src/screens/Settings.
// Tabs: LLM (13 chat cards) / 判定模型 (2 Jev decision cards). All 15 cards
// always rendered; provider configs persist via the server settings store
// (GET /api/settings, POST /api/settings/providers). Raw keys stay server-side.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, MessageSquareText, Loader2 } from "lucide-react";
import {
  PRESET_PROVIDERS,
  isDecisionProvider,
  trimBaseUrl,
  type ProviderConfig,
} from "../../shared/provider.ts";
import { providerApi, type PublicSettings } from "@/lib/providerApi.ts";
import { ProviderCard, type CardForm } from "./settings/ProviderCard.tsx";

const EXPANDED_KEY = "eap-provider-expanded";
const ORDER_KEY = "eap-provider-order";
const TAB_KEY = "eap-settings-tab";

function loadExpanded(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function loadOrder(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]");
    if (Array.isArray(v)) return v;
  } catch { /* ignore */ }
  return [];
}

export function SettingsScreen() {
  const { t, i18n } = useTranslation("settings");
  const [tab, setTab] = useState<"llm" | "decision">(() => {
    try {
      const s = localStorage.getItem(TAB_KEY);
      if (s === "decision" || s === "llm") return s;
    } catch { /* ignore */ }
    return "llm";
  });
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [forms, setForms] = useState<Record<string, CardForm>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded);
  const [providerOrder, setProviderOrder] = useState<string[]>(loadOrder);
  const [enableFallback, setEnableFallback] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [probe, setProbe] = useState<{ q: string; a: string; busy: boolean; recorded: boolean }>({ q: "", a: "", busy: false, recorded: false });
  // The hosted build is a static site: there is no /api backend to configure.
  // Say so plainly instead of surfacing a bare network error.
  const [bffMissing, setBffMissing] = useState(false);
  const dragProviderItem = useRef<{ index: number } | null>(null);
  const dragProviderOver = useRef<{ index: number } | null>(null);

  const notify = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2600);
  };

  const sortedPresets = [...PRESET_PROVIDERS].sort((a, b) => {
    const ai = providerOrder.indexOf(a.id);
    const bi = providerOrder.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const visiblePresets = sortedPresets.filter((p) =>
    tab === "decision" ? isDecisionProvider(p.id) : !isDecisionProvider(p.id),
  );

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
    } catch {
      // No /api backend (hosted static build) — or it is down. Either way the
      // provider forms cannot be loaded, so explain it in the page body.
      setBffMissing(true);
    }
  }, [t]);

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
      notify("error", t("saveFailed", { error: e instanceof Error ? e.message : String(e) }));
    }
  };

  const liveProbe = async () => {
    if (!probe.q.trim()) return;
    setProbe((p) => ({ ...p, busy: true, a: "", recorded: false }));
    try {
      const r = await providerApi.chat([{ role: "user", content: probe.q }]);
      setProbe((p) => ({ ...p, busy: false, recorded: r.recorded === true, a: r.ok ? r.content ?? "" : r.error ?? "error" }));
    } catch (e) {
      setProbe((p) => ({ ...p, busy: false, a: e instanceof Error ? e.message : String(e) }));
    }
  };

  const switchTab = (next: "llm" | "decision") => {
    setTab(next);
    try { localStorage.setItem(TAB_KEY, next); } catch { /* ignore */ }
  };

  // Provider drag-to-sort
  const handleProviderDragStart = (index: number) => { dragProviderItem.current = { index }; };
  const handleProviderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragProviderOver.current = { index };
  };
  const handleProviderDrop = () => {
    if (!dragProviderItem.current || !dragProviderOver.current) return;
    const from = dragProviderItem.current.index;
    const to = dragProviderOver.current.index;
    if (from === to) return;
    const newOrder = sortedPresets.map((p) => p.id);
    const [moved] = newOrder.splice(from, 1);
    if (moved !== undefined) newOrder.splice(to, 0, moved);
    setProviderOrder(newOrder);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(newOrder)); } catch { /* ignore */ }
    dragProviderItem.current = null;
    dragProviderOver.current = null;
  };
  const handleProviderDragEnd = () => {
    dragProviderItem.current = null;
    dragProviderOver.current = null;
  };

  const switchLang = i18n.language?.startsWith("zh") ? "zh" : "en";

  return (
    <div className="h-full overflow-y-auto" data-id="settings.screen">
      <div className="mx-auto max-w-3xl space-y-4 p-5">
        <div>
          <h1 className="text-[22px] font-semibold text-navy">{t("title")}</h1>
          <p className="text-[16px] text-faint">{t("desc")}</p>
        </div>

        {bffMissing && (
          <div
            data-id="settings.hosted-notice"
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[16px] text-amber-900"
          >
            <div className="font-semibold">{t("hostedTitle")}</div>
            <div className="mt-1 leading-relaxed">{t("hostedDesc")}</div>
          </div>
        )}

        {toast && (
          <div
            className={`rounded-md px-4 py-2 text-[17px] text-white ${
              toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-2">
          {(["llm", "decision"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => switchTab(k)}
              className={`rounded-md border px-4 py-1.5 text-[17px] ${
                tab === k
                  ? "border-navy-light bg-navy-soft font-semibold text-navy"
                  : "border-line bg-white text-soft hover:border-navy-light"
              }`}
            >
              {t(`tabs.${k}`)}
            </button>
          ))}
        </div>

        {/* Panel header + save */}
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-1 flex items-center gap-4">
            <h3 className="text-[18px] font-semibold text-navy">
              {tab === "decision" ? t("decisionTitle") : t("llmTitle")}
            </h3>
            <span className="flex-1" />
            <button
              data-id="settings.save"
              onClick={save}
              className="flex items-center gap-1.5 rounded bg-teal px-4 py-1.5 text-[17px] font-semibold text-white"
            >
              <Save size={14} /> {t("save")}
            </button>
          </div>
          <div className="mb-3 text-[16px] text-faint">
            {tab === "decision" ? t("decisionDesc") : t("llmDesc")}
          </div>

          {/* Fallback master toggle */}
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-gray-50 px-3 py-2 text-[17px]">
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

          {/* Live LLM probe (read-only easter egg) */}
          <div className="mb-3 rounded-lg border border-dashed border-navy-light/50 bg-navy-soft/50 p-3">
            <div className="flex items-center gap-1.5 text-[17px] font-semibold text-navy">
              <MessageSquareText size={15} /> {t("probeTitle")}
            </div>
            <p className="mt-0.5 text-[16px] text-faint">{t("probeDesc")}</p>
            <div className="mt-2 flex gap-2">
              <input
                data-id="settings.probe.input"
                value={probe.q}
                onChange={(e) => setProbe((p) => ({ ...p, q: e.target.value }))}
                placeholder={t("probePlaceholder")}
                className="flex-1 rounded border border-line px-2.5 py-1.5 text-[17px]"
              />
              <button
                data-id="settings.probe.send"
                onClick={liveProbe}
                disabled={probe.busy}
                className="flex items-center gap-1 rounded bg-navy px-3.5 py-1.5 text-[17px] text-white disabled:opacity-40"
              >
                {probe.busy && <Loader2 size={13} className="animate-spin" />}
                {t("probeSend")}
              </button>
            </div>
            {probe.a && (
              <div className="mt-2 rounded bg-white p-2">
                {probe.recorded && (
                  <span className="mb-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[14px] text-faint">
                    {t("probeRecorded")}
                  </span>
                )}
                <pre className="whitespace-pre-wrap text-[16px]">{probe.a}</pre>
              </div>
            )}
          </div>

          {/* Provider cards */}
          <div className="flex flex-col gap-3">
            {visiblePresets.map((preset, index) => {
              const form = forms[preset.id];
              if (!form || !settings) return null;
              return (
                <div
                  key={preset.id}
                  onDragOver={(e) => handleProviderDragOver(e, index)}
                  onDrop={handleProviderDrop}
                >
                  <ProviderCard
                    preset={preset}
                    form={form}
                    expanded={!!expanded[preset.id]}
                    dragHandle={
                      <span
                        draggable
                        onDragStart={() => handleProviderDragStart(index)}
                        onDragEnd={handleProviderDragEnd}
                        title={t("dragSort")}
                        className="cursor-grab select-none text-faint"
                      >
                        ⋮⋮
                      </span>
                    }
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
                    lang={switchLang}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed right-5 top-16 z-50 rounded px-4 py-2 text-[17px] text-white ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
