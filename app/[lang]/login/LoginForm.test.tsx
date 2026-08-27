// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithLocale } from "@/app/test/render";

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import LoginForm from "@/app/[lang]/login/LoginForm";

describe("LoginForm Google button", () => {
  it("offers Google sign-in when the provider is configured", () => {
    renderWithLocale(<LoginForm googleEnabled />);
    expect(
      screen.getByRole("button", { name: /continue with google/i })
    ).toBeInTheDocument();
  });

  // The button is only as good as the redirect behind it; with no credentials
  // configured that redirect dead-ends, so the whole block goes away rather
  // than offering a route that cannot complete.
  it("hides the button and its divider when the provider is unconfigured", () => {
    renderWithLocale(<LoginForm googleEnabled={false} />);
    expect(
      screen.queryByRole("button", { name: /continue with google/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^or$/i)).not.toBeInTheDocument();
  });

  it("leaves the email form working either way", () => {
    renderWithLocale(<LoginForm googleEnabled={false} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});
