import { NextResponse } from "next/server";
import type { z } from "zod";
import { DEFAULT_LOCALE } from "@/app/i18n/config";
import { localeFromRequest } from "@/app/i18n/request";
import { apiDictionaryFor } from "@/app/i18n/lookup";

/**
 * Parse and validate a JSON request body against a schema.
 *
 * Returns a discriminated union so callers can `if (!parsed.ok) return
 * parsed.response;` and get a uniform 400 for both malformed JSON and schema
 * violations, without leaking internal field paths to the client.
 */
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<
  { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: badRequest(apiDictionaryFor(localeFromRequest(req)).invalidBody),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: badRequest(
        firstIssueMessage(
          result.error,
          apiDictionaryFor(localeFromRequest(req)).invalidBody
        )
      ),
    };
  }

  return { ok: true, data: result.data };
}

/**
 * The first schema violation, as a sentence.
 *
 * Zod's own constraint text ("Too small: expected string to have >=1
 * characters") is not translated — it comes from the library, and switching
 * Zod's locale is a global setting that cannot be varied per request without
 * racing between concurrent ones. In practice these are a backstop: every form
 * that posts here validates first, in the reader's language. The messages we
 * write ourselves are translated, in api.en/api.de.
 */
function firstIssueMessage(error: z.ZodError, fallback: string): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * The 401 for a signed-out caller.
 *
 * Takes the request so the message lands in the language the page was served
 * in — Route Handlers cannot read the `[lang]` segment, so the locale cookie
 * is the only thing that knows.
 */
export function unauthorized(req?: Request): NextResponse {
  const locale = req ? localeFromRequest(req) : DEFAULT_LOCALE;
  return NextResponse.json(
    { error: apiDictionaryFor(locale).unauthorized },
    { status: 401 }
  );
}
