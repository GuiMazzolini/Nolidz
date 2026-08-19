import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { I18nProvider } from "@/app/i18n/client";
import { DEFAULT_LOCALE, type Locale } from "@/app/i18n/config";

/**
 * Render a component with a locale pinned.
 *
 * Component copy depends on the language now, so a test that asserts on
 * user-visible text has to say which one it means. These tests assert English,
 * matching the language the rest of the repo is written in — German rendering
 * is covered directly in app/i18n/i18n.test.tsx rather than duplicated through
 * every component suite.
 *
 * Without the provider a component would fall back to the context default,
 * which is German — so this is not optional decoration.
 */
export function renderWithLocale(
  ui: React.ReactElement,
  { locale = "en", ...options }: RenderOptions & { locale?: Locale } = {}
): RenderResult {
  return render(ui, {
    wrapper: ({ children }) => (
      <I18nProvider locale={locale}>{children}</I18nProvider>
    ),
    ...options,
  });
}

export { DEFAULT_LOCALE };
