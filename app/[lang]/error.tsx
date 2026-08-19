"use client";

import Link from "@/app/i18n/Link";
import { useT } from "@/app/i18n/client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="bg-white border-2 border-ink/10 p-10 text-center max-w-md w-full">
        <p className="font-display italic font-extrabold text-5xl text-red-500 mb-4">!</p>
        <h1 className="font-display italic font-extrabold text-2xl text-ink mb-3">
          {t.error.heading}
        </h1>
        <p className="text-ink/60 mb-8">{error.message || t.error.body}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-block bg-ink text-paper px-6 py-3 font-semibold hover:bg-ink/85 transition-colors"
          >
            {t.common.tryAgain}
          </button>
          <Link
            href="/"
            className="inline-block border-2 border-ink/15 text-ink px-6 py-3 font-semibold hover:border-cardboard-dark transition-colors"
          >
            {t.common.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
