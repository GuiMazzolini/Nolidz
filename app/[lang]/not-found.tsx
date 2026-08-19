import Link from "@/app/i18n/Link";
import { getT } from "@/app/i18n/server";

export default async function NotFoundPage() {
  const t = await getT();

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="bg-white border-2 border-ink/10 p-12 text-center max-w-md w-full">
        <p className="font-display italic font-extrabold text-6xl text-cardboard-dark mb-4">
          404
        </p>
        <h1 className="font-display italic font-extrabold text-2xl text-ink mb-3">
          {t.notFound.heading}
        </h1>
        <p className="text-ink/60 mb-8">{t.notFound.body}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-block bg-ink text-paper px-6 py-3 font-semibold hover:bg-ink/85 transition-colors"
          >
            {t.common.backToHome}
          </Link>
          <Link
            href="/products"
            className="inline-block border-2 border-ink/15 text-ink px-6 py-3 font-semibold hover:border-cardboard-dark transition-colors"
          >
            {t.common.browseProducts}
          </Link>
        </div>
      </div>
    </div>
  );
}
