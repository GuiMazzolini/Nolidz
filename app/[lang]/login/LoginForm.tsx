"use client";

import Image from "next/image";
import Link from "@/app/i18n/Link";
import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocalePath, useT } from "@/app/i18n/client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const t = useT();
  const localePath = useLocalePath();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Callback urls are written as plain app paths (`/cart`), so they need the
  // locale attached before anyone is sent there.
  const callbackUrl = localePath(searchParams.get("callbackUrl") || "/products");
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const title = useMemo(
    () => (mode === "login" ? t.login.titleLogin : t.login.titleSignup),
    [mode, t],
  );

  const subtitle = useMemo(
    () => (mode === "login" ? t.login.subtitleLogin : t.login.subtitleSignup),
    [mode, t],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || t.login.errorCreateAccount);
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          mode === "login"
            ? t.login.errorInvalidCredentials
            : t.login.errorSignupLoginFailed,
        );
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(t.login.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }

  return (
    <div className="min-h-screen bg-paper py-12 px-4">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <Image
              src="/nolidz.jpeg"
              alt="nolidz"
              width={40}
              height={40}
              className="h-10 w-10 rounded-md object-cover border border-ink/10"
            />
            <span className="font-display italic font-extrabold text-2xl text-ink lowercase">
              nolidz
            </span>
          </Link>
          <h1 className="font-display italic font-extrabold text-3xl text-ink">{title}</h1>
          <p className="mt-2 text-ink/60">{subtitle}</p>
        </div>

        <div className="border-2 border-ink/10 bg-white p-6">
          <div className="mb-6 grid grid-cols-2 gap-1 bg-paper p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`py-2 text-sm font-semibold transition-colors ${
                mode === "login"
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink/55 hover:text-ink"
              }`}
            >
              {t.login.tabLogin}
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`py-2 text-sm font-semibold transition-colors ${
                mode === "signup"
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink/55 hover:text-ink"
              }`}
            >
              {t.login.tabSignup}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink/70">
                  {t.login.nameLabel}
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border-2 border-ink/15 px-3 py-2.5 text-ink outline-none focus:border-cardboard"
                  placeholder={t.login.namePlaceholder}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink/70">
                {t.login.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-2 border-ink/15 px-3 py-2.5 text-ink outline-none focus:border-cardboard"
                placeholder={t.login.emailPlaceholder}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink/70">
                {t.login.passwordLabel}
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-ink/15 px-3 py-2.5 text-ink outline-none focus:border-cardboard"
                placeholder={
                  mode === "signup"
                    ? t.login.passwordPlaceholderSignup
                    : t.login.passwordPlaceholderLogin
                }
              />
            </div>

            {error && (
              <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink py-3 text-sm font-semibold text-paper hover:bg-ink/85 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? t.common.pleaseWait
                : mode === "login"
                  ? t.login.submitLogin
                  : t.login.submitSignup}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink/10" />
            <span className="text-xs font-medium uppercase tracking-wide text-ink/40">
              {t.common.or}
            </span>
            <div className="h-px flex-1 bg-ink/10" />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl })}
              className="flex w-full items-center justify-center gap-2 border-2 border-ink/15 bg-white py-2.5 text-sm font-semibold text-ink hover:border-cardboard transition-colors"
            >
              {t.login.continueWithGoogle}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-ink/50">
          <Link href="/products" className="font-medium text-cardboard-dark hover:text-ink">
            {t.login.continueShopping}
          </Link>
          {t.login.withoutAccount}
        </p>
      </div>
    </div>
  );
}
