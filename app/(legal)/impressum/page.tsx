import type { Metadata } from "next";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-8 font-barlow text-4xl font-extrabold uppercase tracking-tight">
        Impressum
      </h1>

      <section className="space-y-1 text-sm text-ink/80">
        <p className="font-semibold text-ink">Angaben gemäß § 5 TMG</p>
        <p>Kristiyan Valin</p>
        <p>Schönleinstraße 15</p>
        <p>10967 Berlin</p>
        <p>Deutschland</p>
      </section>

      <section className="mt-8 space-y-1 text-sm text-ink/80">
        <p className="font-semibold text-ink">Kontakt</p>
        <p>
          E-Mail:{" "}
          <a
            href="mailto:kristiyanval@gmail.com"
            className="underline hover:text-ink"
          >
            kristiyanval@gmail.com
          </a>
        </p>
      </section>

      <section className="mt-8 text-sm text-ink/80">
        <p className="font-semibold text-ink">
          Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
        </p>
        <p>Kristiyan Valin, Schönleinstraße 15, 10967 Berlin</p>
      </section>

      <section className="mt-8 text-sm text-ink/60">
        <p className="font-semibold text-ink">Hinweis zur Online-Streitbeilegung</p>
        <p className="mt-1">
          Die Europäische Kommission stellt eine Plattform zur
          Online-Streitbeilegung (OS) bereit:{" "}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-ink"
          >
            https://ec.europa.eu/consumers/odr/
          </a>
          . Wir sind nicht verpflichtet und nicht bereit, an einem
          Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>
    </main>
  );
}
