import type { Metadata } from "next";
import NextLink from "next/link";
import { getI18n } from "@/app/i18n/server";
import { formatMoney } from "@/app/lib/money";
import { SHIPPING_FLAT_RATE } from "@/app/lib/shipping";
import { BUSINESS, BUSINESS_ADDRESS_LINES } from "@/app/lib/business";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.returns.metaTitle };
}

/**
 * How to send an order back, in the reader's language.
 *
 * Storefront copy, so it lives under `[lang]` and speaks both languages —
 * unlike the Widerrufsbelehrung at /widerruf, which is the German text of the
 * offer and stays German. The two pages describe the same policy from
 * different ends: this one is what the customer does, that one is what we owe.
 * The postage promise in particular is a single fact written in two places, so
 * a change to one is a change to both.
 */
export default async function ReturnsPage() {
  const { locale, t } = await getI18n();
  const mailto = `mailto:${BUSINESS.email}`;

  const steps = [
    {
      heading: t.returns.step1Heading,
      body: t.returns.step1Body(BUSINESS.email),
      aside: t.returns.step1Aside,
    },
    { heading: t.returns.step2Heading, body: t.returns.step2Body },
    {
      heading: t.returns.step3Heading,
      body: t.returns.step3Body,
      aside: t.returns.step3Aside,
    },
    { heading: t.returns.step4Heading, body: t.returns.step4Body },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 space-y-12">
      <header className="space-y-4">
        <h1 className="font-barlow text-4xl font-extrabold uppercase tracking-tight text-ink sm:text-5xl">
          {t.returns.heading}
        </h1>
        <p className="text-lg text-ink/80">{t.returns.intro}</p>
      </header>

      <section className="rounded-2xl border-2 border-ink/10 bg-white p-6">
        <h2 className="font-barlow text-2xl font-extrabold uppercase tracking-tight text-ink">
          {t.returns.deadlineHeading}
        </h2>
        <p className="mt-2 text-sm text-ink/80">{t.returns.deadlineBody}</p>
      </section>

      <section className="space-y-6">
        <h2 className="font-barlow text-2xl font-extrabold uppercase tracking-tight text-ink">
          {t.returns.stepsHeading}
        </h2>
        {/*
          An ordered list, so a screen reader announces "3 of 4" and the order
          is carried by the markup rather than by the numbers being drawn. The
          drawn number is aria-hidden to keep it from being read twice.
        */}
        <ol className="space-y-6">
          {steps.map((step, index) => (
            <li key={step.heading} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-barlow text-lg font-extrabold text-paper"
              >
                {index + 1}
              </span>
              <div className="space-y-1 pt-1">
                <h3 className="font-semibold text-ink">{step.heading}</h3>
                <p className="text-sm text-ink/80">{step.body}</p>
                {step.aside && (
                  <p className="text-xs text-ink/60">{step.aside}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl bg-ink p-6 text-paper">
        <h2 className="font-barlow text-2xl font-extrabold uppercase tracking-tight">
          {t.returns.postageHeading}
        </h2>
        <p className="mt-2 text-sm text-paper/85">{t.returns.postageBody}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-barlow text-2xl font-extrabold uppercase tracking-tight text-ink">
          {t.returns.refundHeading}
        </h2>
        <ul className="space-y-2 text-sm text-ink/80">
          {[
            t.returns.refundWholeOrder,
            /*
             * Priced from SHIPPING_METHODS rather than written out, so the
             * cap we promise here cannot drift from the rate checkout charges.
             */
            t.returns.refundExpress(
              formatMoney(SHIPPING_FLAT_RATE, undefined, locale)
            ),
            t.returns.refundPartial,
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden="true" className="text-ink/40">
                —
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-barlow text-2xl font-extrabold uppercase tracking-tight text-ink">
          {t.returns.conditionHeading}
        </h2>
        <p className="text-sm text-ink/80">{t.returns.conditionBody}</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-barlow text-2xl font-extrabold uppercase tracking-tight text-ink">
          {t.returns.addressHeading}
        </h2>
        <p className="text-sm text-ink/80">{t.returns.addressBody}</p>
        <address className="mt-2 not-italic border-l-2 border-ink/20 pl-4 text-sm text-ink/80">
          {BUSINESS_ADDRESS_LINES.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      </section>

      <section className="space-y-2">
        <h2 className="font-barlow text-2xl font-extrabold uppercase tracking-tight text-ink">
          {t.returns.questionsHeading}
        </h2>
        <p className="text-sm text-ink/80">
          {t.returns.questionsBody(BUSINESS.email)}
        </p>
        <a
          href={mailto}
          className="inline-block rounded-lg border-2 border-ink px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          {BUSINESS.email}
        </a>
      </section>

      <p className="border-t-2 border-ink/10 pt-6 text-xs text-ink/60">
        {t.returns.legalBefore}
        {/*
          next/link rather than the locale-aware one: /widerruf sits outside
          app/[lang], so prefixing it would point at a route that is not there.
        */}
        <NextLink href="/widerruf" className="underline hover:text-ink">
          {t.returns.legalLinkLabel}
        </NextLink>
        {t.returns.legalAfter}
      </p>
    </main>
  );
}
