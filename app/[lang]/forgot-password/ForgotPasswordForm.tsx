"use client";

import Image from "next/image";
import Link from "@/app/i18n/Link";
import { FormEvent, useState } from "react";
import { useT } from "@/app/i18n/client";

export default function ForgotPasswordForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.error === "string" ? data.error : t.forgotPassword.errorGeneric
        );
        return;
      }

      setSent(true);
    } catch {
      setError(t.forgotPassword.errorGeneric);
    } finally {
      setLoading(false);
    }
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
          <h1 className="font-display italic font-extrabold text-3xl text-ink">
            {sent ? t.forgotPassword.successTitle : t.forgotPassword.title}
          </h1>
          <p className="mt-2 text-ink/60">
            {sent ? t.forgotPassword.successBody : t.forgotPassword.intro}
          </p>
        </div>

        <div className="border-2 border-ink/10 bg-white p-6">
          {sent ? (
            <Link
              href="/login"
              className="block w-full bg-ink py-3 text-center text-sm font-semibold text-paper hover:bg-ink/85 transition-colors"
            >
              {t.forgotPassword.backToLogin}
            </Link>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-ink/70"
                >
                  {t.forgotPassword.emailLabel}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-2 border-ink/15 px-3 py-2.5 text-ink outline-none focus:border-cardboard"
                  placeholder={t.forgotPassword.emailPlaceholder}
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
                {loading ? t.common.pleaseWait : t.forgotPassword.submit}
              </button>
            </form>
          )}
        </div>

        {!sent && (
          <p className="mt-6 text-center text-sm text-ink/50">
            <Link href="/login" className="font-medium text-cardboard-dark hover:text-ink">
              {t.forgotPassword.backToLogin}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
