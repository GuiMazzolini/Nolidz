"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/products";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const title = useMemo(
    () => (mode === "login" ? "Welcome back" : "Create your account"),
    [mode],
  );

  const subtitle = useMemo(
    () =>
      mode === "login"
        ? "Log in to save your cart and checkout."
        : "Sign up to start shopping with a saved cart.",
    [mode],
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
          setError(data.error || "Could not create account.");
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
            ? "Invalid email or password."
            : "Account created, but login failed. Try logging in.",
        );
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
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
              Log in
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
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink/70">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border-2 border-ink/15 px-3 py-2.5 text-ink outline-none focus:border-cardboard"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink/70">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-2 border-ink/15 px-3 py-2.5 text-ink outline-none focus:border-cardboard"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink/70">
                Password
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
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
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
              {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink/10" />
            <span className="text-xs font-medium uppercase tracking-wide text-ink/40">or</span>
            <div className="h-px flex-1 bg-ink/10" />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl })}
              className="flex w-full items-center justify-center gap-2 border-2 border-ink/15 bg-white py-2.5 text-sm font-semibold text-ink hover:border-cardboard transition-colors"
            >
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl })}
              className="flex w-full items-center justify-center gap-2 border-2 border-ink/15 bg-white py-2.5 text-sm font-semibold text-ink hover:border-cardboard transition-colors"
            >
              Continue with Google
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-ink/50">
          <Link href="/products" className="font-medium text-cardboard-dark hover:text-ink">
            Continue shopping
          </Link>
          {" without an account"}
        </p>
      </div>
    </div>
  );
}
