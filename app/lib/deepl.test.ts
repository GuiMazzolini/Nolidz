import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isDeepLConfigured,
  resetDeepLWarningForTests,
  translateTexts,
} from "./deepl";

describe("translateTexts", () => {
  const originalKey = process.env.DEEPL_AUTH_KEY;
  const originalUrl = process.env.DEEPL_API_URL;

  beforeEach(() => {
    process.env.DEEPL_AUTH_KEY = "test-key";
    delete process.env.DEEPL_API_URL;
    resetDeepLWarningForTests();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.DEEPL_AUTH_KEY = originalKey;
    process.env.DEEPL_API_URL = originalUrl;
    vi.unstubAllGlobals();
  });

  it("reports configured when a key is present", () => {
    expect(isDeepLConfigured()).toBe(true);
  });

  it("returns originals when the key is missing", async () => {
    delete process.env.DEEPL_AUTH_KEY;
    expect(isDeepLConfigured()).toBe(false);
    await expect(translateTexts(["Hello"])).resolves.toEqual(["Hello"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts a batch and maps translations back in order", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        translations: [{ text: "Hallo" }, { text: "Welt" }],
      }),
    } as Response);

    await expect(translateTexts(["Hello", "World"])).resolves.toEqual([
      "Hallo",
      "Welt",
    ]);

    expect(fetch).toHaveBeenCalledWith(
      "https://api-free.deepl.com/v2/translate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "DeepL-Auth-Key test-key",
        }),
      })
    );
  });

  it("keeps empty strings in place without sending them", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        translations: [{ text: "Hallo" }],
      }),
    } as Response);

    await expect(translateTexts(["", "Hello", ""])).resolves.toEqual([
      "",
      "Hallo",
      "",
    ]);

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.text).toEqual(["Hello"]);
  });

  it("throws when DeepL returns an error status", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    } as Response);

    await expect(translateTexts(["Hello"])).rejects.toThrow(/403/);
  });
});
