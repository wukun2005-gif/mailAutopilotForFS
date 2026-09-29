// Server-side settings store — local JSON file, atomic tmp+rename writes.
// Ported from HarnessWindTunnel/server/settingsStore.ts.
// Keys: 'provider_all' = JSON(AppSettings); legacy 'provider_{id}' rows are
// also written and read as fallback. Raw apiKeys live here ONLY — this file is
// gitignored and the browser only ever sees masked keys.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function settingsFile(): string {
  const override = process.env["EAP_SETTINGS_FILE"];
  if (override) return resolve(override);
  return resolve(process.cwd(), "server-data", "settings.json");
}

function readAll(file = settingsFile()): Record<string, unknown> {
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Missing/corrupt file reads as empty.
  }
  return {};
}

function writeAll(settings: Record<string, unknown>, file = settingsFile()): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(settings, null, 2));
  renameSync(tmp, file);
}

export function getSettings(): Record<string, unknown> {
  return readAll();
}

export function getSetting(key: string): unknown {
  return readAll()[key] ?? null;
}

export function putSetting(key: string, value: unknown): void {
  const all = readAll();
  all[key] = value;
  writeAll(all);
}

/** Bulk upsert: provider_all + legacy provider_{id} rows. */
export function putProviderBundle(
  providers: Array<Record<string, unknown>>,
  extra: { enableProviderFallback?: boolean } = {},
): Record<string, unknown> {
  const appSettings: Record<string, unknown> = {
    providers: providers.map((p) => ({
      providerId: p["providerId"],
      apiKeyRef:
        (p["apiKeyRef"] as string | undefined) ??
        (p["apiKey"] as string | undefined) ??
        "",
      modelIds: (p["modelIds"] as string[] | undefined) ?? [],
      defaultModelId: (p["defaultModelId"] as string | undefined) ?? "",
      modelFallbacks: (p["modelFallbacks"] as string[] | undefined) ?? [],
      enabled: (p["enabled"] as boolean | undefined) ?? true,
      enableModelFallback:
        (p["enableModelFallback"] as boolean | undefined) ?? false,
      baseUrl: p["baseUrl"],
    })),
    enableProviderFallback: extra.enableProviderFallback ?? true,
  };
  const all = readAll();
  all["provider_all"] = appSettings;
  for (const p of providers) {
    all[`provider_${p["providerId"]}`] = p;
  }
  writeAll(all);
  return appSettings;
}
