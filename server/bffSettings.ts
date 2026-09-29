// Provider-bundle reads/writes for the Dev BFF. Browser reads get masked
// keys; writes preserve the stored raw key when the submitted key is empty
// or masked. Raw keys only ever live in server-data/settings.json.
import { getSetting, putProviderBundle } from "./settingsStore.ts";
import {
  PRESET_PROVIDERS,
  maskKey,
  presetOf,
  trimBaseUrl,
  type AppSettings,
  type ProviderConfig,
} from "../shared/provider.ts";

interface StoredProvider {
  providerId?: string;
  apiKeyRef?: string;
  apiKey?: string;
  baseUrl?: string;
  modelIds?: string[];
  defaultModelId?: string;
  modelFallbacks?: string[];
  enabled?: boolean;
  enableModelFallback?: boolean;
}

export function storedBundle(): {
  providers: StoredProvider[];
  enableProviderFallback: boolean;
} {
  const bundle = getSetting("provider_all") as AppSettings | null;
  return {
    providers: (bundle?.providers ?? []) as StoredProvider[],
    enableProviderFallback: bundle?.enableProviderFallback ?? true,
  };
}

export function rawKeyOf(p: StoredProvider): string {
  if (p.apiKeyRef) return p.apiKeyRef;
  if (p.apiKey) return p.apiKey;
  const legacy = getSetting(`provider_${p.providerId}`) as
    | StoredProvider
    | null;
  return legacy?.apiKeyRef ?? legacy?.apiKey ?? "";
}

/** Settings payload for the browser: every preset card, keys masked. */
export function publicSettings() {
  const { providers, enableProviderFallback } = storedBundle();
  return {
    enableProviderFallback,
    providers: PRESET_PROVIDERS.map((preset) => {
      const row = providers.find((p) => p.providerId === preset.id);
      const raw = row ? rawKeyOf(row) : "";
      return {
        providerId: preset.id,
        name: preset.name,
        nameEn: preset.nameEn ?? preset.name,
        desc: preset.desc,
        descEn: preset.descEn ?? preset.desc,
        kind: preset.kind ?? "chat",
        defaultBaseUrl: preset.defaultBaseUrl,
        keyPlaceholder: preset.keyPlaceholder,
        starterModels: preset.starterModels ?? [],
        baseUrl: row?.baseUrl ?? preset.defaultBaseUrl,
        enabled: row?.enabled ?? false,
        defaultModelId: row?.defaultModelId ?? "",
        modelIds: row?.modelIds ?? preset.starterModels ?? [],
        modelFallbacks: row?.modelFallbacks ?? [],
        enableModelFallback: row?.enableModelFallback ?? false,
        hasKey: !!raw,
        apiKeyMasked: maskKey(raw),
      };
    }),
  };
}

/** Persist provider bundle; empty/masked keys preserve the stored raw key. */
export function persistProviders(body: Record<string, unknown>): {
  status: number;
  error?: string;
} {
  const incoming = (body["providers"] ?? []) as Array<
    Partial<ProviderConfig> & { keepKey?: boolean }
  >;
  if (!Array.isArray(incoming))
    return { status: 400, error: "providers[] required" };
  const { providers: stored } = storedBundle();

  const merged: ProviderConfig[] = incoming.map((p) => {
    const id = String(p.providerId ?? "");
    const old = stored.find((s) => s.providerId === id);
    const newKey = typeof p.apiKey === "string" ? p.apiKey.trim() : "";
    const looksMasked = newKey.includes("…") || newKey.includes("...");
    const preserved =
      !newKey || looksMasked || p.keepKey ? rawKeyOf(old ?? {}) : newKey;
    const preset = presetOf(id);
    return {
      providerId: id,
      apiKeyRef: preserved,
      baseUrl: trimBaseUrl(
        String(p.baseUrl ?? old?.baseUrl ?? preset?.defaultBaseUrl ?? ""),
      ),
      defaultModelId: String(p.defaultModelId ?? old?.defaultModelId ?? ""),
      modelIds: Array.isArray(p.modelIds)
        ? (p.modelIds as string[])
        : (old?.modelIds ?? preset?.starterModels ?? []),
      modelFallbacks: Array.isArray(p.modelFallbacks)
        ? (p.modelFallbacks as string[])
        : (old?.modelFallbacks ?? []),
      enabled: p.enabled ?? old?.enabled ?? false,
      enableModelFallback:
        p.enableModelFallback ?? old?.enableModelFallback ?? false,
    };
  });

  putProviderBundle(merged as unknown as Array<Record<string, unknown>>, {
    enableProviderFallback:
      body["enableProviderFallback"] === undefined
        ? storedBundle().enableProviderFallback
        : body["enableProviderFallback"] === true,
  });
  return { status: 200 };
}
