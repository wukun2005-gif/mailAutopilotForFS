// Thin client for the Dev BFF provider endpoints (Dev Plan §11).
// Keys are never stored in the browser bundle: GET returns masked keys,
// POST preserves the stored raw key when the field is blank/masked.
import { trimBaseUrl, type ProviderConfig } from "../../shared/provider.ts";

export interface PublicProvider {
  providerId: string;
  name: string;
  nameEn: string;
  desc: string;
  descEn: string;
  devOnly: boolean;
  defaultBaseUrl: string;
  keyPlaceholder: string;
  starterModels: string[];
  baseUrl: string;
  enabled: boolean;
  defaultModelId: string;
  modelIds: string[];
  modelFallbacks: string[];
  enableModelFallback: boolean;
  hasKey: boolean;
  apiKeyMasked: string;
}

export interface PublicSettings {
  enableProviderFallback: boolean;
  providers: PublicProvider[];
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
    body: init?.body ? init.body : undefined,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export const providerApi = {
  getSettings: () => jsonFetch<PublicSettings>("/api/settings"),

  saveProviders: (
    providers: ProviderConfig[],
    enableProviderFallback: boolean,
  ) =>
    jsonFetch<{ ok: true }>("/api/settings/providers", {
      method: "POST",
      body: JSON.stringify({ providers, enableProviderFallback }),
    }),

  queryModels: (providerId: string, apiKey: string, baseUrl: string) =>
    jsonFetch<{ models: string[]; fromApi: boolean; fetchError?: string }>(
      "/api/models",
      {
        method: "POST",
        body: JSON.stringify({ providerId, apiKey, baseUrl: trimBaseUrl(baseUrl) }),
      },
    ),

  verifyModel: (providerId: string, model: string) =>
    jsonFetch<{
      ok: boolean;
      latencyMs?: number;
      model?: string;
      switchedFrom?: unknown;
      error?: string;
    }>("/api/verify", {
      method: "POST",
      body: JSON.stringify({ providerId, model }),
    }),

  chat: (messages: { role: string; content: string }[], model?: string) =>
    jsonFetch<{ ok: boolean; content?: string; error?: string; used?: unknown }>(
      "/api/llm/chat",
      { method: "POST", body: JSON.stringify({ messages, model }) },
    ),
};
