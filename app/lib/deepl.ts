/**
 * Thin DeepL Translate API client.
 *
 * Free accounts use api-free.deepl.com; Pro uses api.deepl.com. Override the
 * host with DEEPL_API_URL when needed. Without DEEPL_AUTH_KEY the shop keeps
 * serving English source text — translation is an enhancement, not a hard
 * dependency.
 */

export type DeepLTargetLang = "DE";

const DEFAULT_API_URL = "https://api-free.deepl.com";

let warnedMissingKey = false;

export function isDeepLConfigured(): boolean {
  return Boolean(process.env.DEEPL_AUTH_KEY?.trim());
}

function apiBaseUrl(): string {
  const raw = process.env.DEEPL_API_URL?.trim();
  if (!raw) return DEFAULT_API_URL;
  return raw.replace(/\/$/, "");
}

type DeepLResponse = {
  translations?: Array<{ text?: string }>;
};

/**
 * Translate a batch of strings to German in one request.
 *
 * Empty strings stay empty and never leave the client. When the API key is
 * missing, the originals are returned so callers can keep rendering.
 */
export async function translateTexts(
  texts: string[],
  targetLang: DeepLTargetLang = "DE"
): Promise<string[]> {
  if (texts.length === 0) return [];

  const key = process.env.DEEPL_AUTH_KEY?.trim();
  if (!key) {
    if (!warnedMissingKey) {
      console.warn(
        "[deepl] DEEPL_AUTH_KEY is not set; serving source language text"
      );
      warnedMissingKey = true;
    }
    return texts;
  }

  // DeepL rejects empty strings; keep positions by translating only non-empty.
  const indexes: number[] = [];
  const payload: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const value = texts[i] ?? "";
    if (value.trim()) {
      indexes.push(i);
      payload.push(value);
    }
  }

  if (payload.length === 0) return texts;

  const res = await fetch(`${apiBaseUrl()}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: payload,
      target_lang: targetLang,
      source_lang: "EN",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `DeepL translate failed (${res.status}): ${body.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as DeepLResponse;
  const translated = data.translations ?? [];
  if (translated.length !== payload.length) {
    throw new Error(
      `DeepL returned ${translated.length} translations for ${payload.length} texts`
    );
  }

  const out = [...texts];
  for (let i = 0; i < indexes.length; i++) {
    const text = translated[i]?.text;
    if (typeof text !== "string") {
      throw new Error("DeepL response missing translation text");
    }
    out[indexes[i]] = text;
  }
  return out;
}

/** Reset the missing-key warning (tests only). */
export function resetDeepLWarningForTests(): void {
  warnedMissingKey = false;
}
