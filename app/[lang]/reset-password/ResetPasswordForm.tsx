"use client";

import Image from "next/image";
import Link from "@/app/i18n/Link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/app/i18n/client";

export default function ResetPasswordForm() {
  const t = useT();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== confirm) {
      setError(t.resetPassword.passwordsDoNotMatch);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : t.resetPassword.errorInvalidToken
        );
        return;
      }

      setDone(true);
    } catch {
      setError(t.resetPassword.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  const missingToken = !token;

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
          <h1 className="font-display italic font-extrabold text-3xl text-ink">
            {missingToken
              ? t.resetPassword.missingTokenTitle
              : done
                ? t.resetPassword.successTitle
                : t.resetPassword.title}
          </h1>
          <p className="mt-2 text-ink/60">
            {missingToken
              ? t.resetPassword.missingTokenBody
              : done
                ? t.resetPassword.successBody
                : t.resetPassword.intro}
          </p>
        </div>

        <div className="border-2 border-ink/10 bg-white p-6">
          {missingToken ? (
            <Link
              href="/forgot-password"
              className="block w-full bg-ink py-3 text-center text-sm font-semibold text-paper hover:bg-ink/85 transition-colors"
            >
              {t.resetPassword.requestNewLink}
            </Link>
          ) : done ? (
            <Link
              href="/login"
              className="block w-full bg-ink py-3 text-center text-sm font-semibold text-paper hover:bg-ink/85 transition-colors"
            >
              {t.resetPassword.backToLogin}
            </Link>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-ink/70"
                >
                  {t.resetPassword.passwordLabel}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-2 border-ink/15 px-3 py-2.5 text-ink outline-none focus:border-cardboard"
                  placeholder={t.resetPassword.passwordPlaceholder}
                />
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1.5 block text-sm font-medium text-ink/70"
                >
                  {t.resetPassword.confirmLabel}
                </label>
                <input
                  id="confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full border-2 border-ink/15 px-3 py-2.5 text-ink outline-none focus:border-cardboard"
                  placeholder={t.resetPassword.passwordPlaceholder}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ink py-3 text-sm font-semibold text-paper hover:bg-ink/85 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t.common.pleaseWait : t.resetPassword.submit}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
