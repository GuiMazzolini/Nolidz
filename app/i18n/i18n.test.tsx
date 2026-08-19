// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import { renderWithLocale } from "@/app/test/render";
import { proxy } from "@/proxy";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  localeFromPath,
  localePath,
  matchLocale,
  stripLocale,
} from "./config";
import { localeFromRequest } from "./request";
import { apiDictionaryFor, dictionaryFor, adminDictionaryFor } from "./lookup";
import CartErrorBanner from "@/app/components/CartErrorBanner";
import { useCartStore } from "@/app/lib/store/cartStore";

describe("choosing a locale from Accept-Language", () => {
  it("takes the highest-quality language the shop speaks", () => {
    expect(matchLocale("en-GB,en;q=0.9,de;q=0.8")).toBe("en");
    expect(matchLocale("de-AT,de;q=0.9,en;q=0.8")).toBe("de");
  });

  it("ranks by q rather than by written order", () => {
    expect(matchLocale("en;q=0.2,de;q=0.9")).toBe("de");
  });

  it("skips languages the shop does not speak", () => {
    expect(matchLocale("fr-FR,fr;q=0.9,en;q=0.4")).toBe("en");
  });

  it("never picks a language the browser explicitly rejected", () => {
    // q=0 means "not this one", so English must not win it by being listed.
    expect(matchLocale("en;q=0,de;q=0.5")).toBe("de");
  });

  it("falls back to German when there is nothing usable", () => {
    expect(matchLocale(null)).toBe(DEFAULT_LOCALE);
    expect(matchLocale("fr,es")).toBe(DEFAULT_LOCALE);
  });
});

describe("locale paths", () => {
  it("prefixes an app path", () => {
    expect(localePath("de", "/products")).toBe("/de/products");
    expect(localePath("en", "/")).toBe("/en");
  });

  it("is idempotent, so applying it twice is harmless", () => {
    expect(localePath("de", localePath("de", "/cart"))).toBe("/de/cart");
  });

  it("re-points a path that already names the other language", () => {
    expect(localePath("en", "/de/products")).toBe("/en/products");
  });

  it("leaves anything that is not an app path alone", () => {
    expect(localePath("de", "https://stripe.com")).toBe("https://stripe.com");
    expect(localePath("de", "#the-hunt")).toBe("#the-hunt");
  });

  it("strips a prefix back off", () => {
    expect(stripLocale("/de/products/runner")).toBe("/products/runner");
    expect(stripLocale("/en")).toBe("/");
    expect(stripLocale("/products")).toBe("/products");
  });

  it("does not mistake a path that merely starts with the letters", () => {
    expect(stripLocale("/denim")).toBe("/denim");
    expect(localeFromPath("/denim")).toBeNull();
  });
});

describe("the locale proxy", () => {
  function request(path: string, headers: Record<string, string> = {}) {
    return new NextRequest(`http://localhost:3000${path}`, { headers });
  }

  it("redirects an unprefixed URL and remembers the choice", () => {
    const res = proxy(request("/products", { "accept-language": "en" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/en/products");
    expect(res.cookies.get(LOCALE_COOKIE)?.value).toBe("en");
  });

  it("carries the query string across the redirect", () => {
    const res = proxy(request("/products?category=women&sort=price"));

    expect(res.headers.get("location")).toContain("category=women&sort=price");
  });

  it("sends the bare root to a language home page", () => {
    const res = proxy(request("/", { "accept-language": "de" }));
    expect(res.headers.get("location")).toBe("http://localhost:3000/de");
  });

  it("lets a URL that names its language win over the browser's preference", () => {
    // A shared /en/ link must open in English for a German-configured browser.
    const res = proxy(request("/en/products", { "accept-language": "de" }));

    expect(res.status).toBe(200);
    expect(res.cookies.get(LOCALE_COOKIE)?.value).toBe("en");
  });

  it("prefers a remembered choice over the browser's preference", () => {
    const res = proxy(
      request("/products", {
        "accept-language": "de",
        cookie: `${LOCALE_COOKIE}=en`,
      })
    );

    expect(res.headers.get("location")).toBe("http://localhost:3000/en/products");
  });
});

describe("the locale a route handler answers in", () => {
  it("reads the cookie the proxy left", () => {
    const req = new NextRequest("http://localhost:3000/api/cart", {
      headers: { cookie: `theme=dark; ${LOCALE_COOKIE}=en; other=1` },
    });
    expect(localeFromRequest(req)).toBe("en");
  });

  it("falls back to Accept-Language on the first request of a session", () => {
    const req = new NextRequest("http://localhost:3000/api/cart", {
      headers: { "accept-language": "en-US,en;q=0.9" },
    });
    expect(localeFromRequest(req)).toBe("en");
  });

  it("answers in German when a request says nothing at all", () => {
    const req = new NextRequest("http://localhost:3000/api/cart");
    expect(localeFromRequest(req)).toBe(DEFAULT_LOCALE);
  });

  it("returns error text in the language that was asked for", () => {
    expect(apiDictionaryFor("de").outOfStock).toBe("Ausverkauft");
    expect(apiDictionaryFor("en").outOfStock).toBe("Out of stock");
  });
});

describe("dictionary parity", () => {
  type Shape = Record<string, unknown>;

  /** Every leaf path, so a missing or retyped key shows up as a diff. */
  function paths(value: unknown, prefix = ""): string[] {
    if (typeof value === "function") return [`${prefix}:fn`];
    if (Array.isArray(value)) {
      return value.flatMap((item, i) => paths(item, `${prefix}[${i}]`));
    }
    if (value && typeof value === "object") {
      return Object.entries(value as Shape).flatMap(([key, v]) =>
        paths(v, prefix ? `${prefix}.${key}` : key)
      );
    }
    return [`${prefix}:${typeof value}`];
  }

  for (const build of [dictionaryFor, adminDictionaryFor, apiDictionaryFor]) {
    it(`keeps both languages the same shape (${build.name})`, () => {
      expect(paths(build("de")).sort()).toEqual(paths(build("en")).sort());
    });
  }

  it("leaves no blank string in either language", () => {
    for (const locale of LOCALES) {
      for (const build of [dictionaryFor, adminDictionaryFor, apiDictionaryFor]) {
        const blanks = paths(build(locale)).filter((p) => p.endsWith(":string"));
        expect(blanks.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("rendering in each language", () => {
  it("shows German copy under a German locale", () => {
    useCartStore.setState({ cartError: "boom" });

    renderWithLocale(<CartErrorBanner />, { locale: "de" });
    expect(
      screen.getByRole("button", { name: "Fehler ausblenden" })
    ).toBeVisible();
  });

  it("shows English copy under an English locale", () => {
    useCartStore.setState({ cartError: "boom" });

    renderWithLocale(<CartErrorBanner />, { locale: "en" });
    expect(screen.getByRole("button", { name: "Dismiss error" })).toBeVisible();
  });
});
