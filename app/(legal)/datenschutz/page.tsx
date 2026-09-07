import type { Metadata } from "next";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-sm text-ink/80 space-y-8">
      <h1 className="font-barlow text-4xl font-extrabold uppercase tracking-tight text-ink">
        Datenschutzerklärung
      </h1>

      <section>
        <h2 className="mb-2 font-semibold text-ink text-base">
          1. Verantwortlicher
        </h2>
        <p>
          Kristiyan Valin<br />
          Schönleinstraße 15, 10967 Berlin<br />
          E-Mail:{" "}
          <a href="mailto:kristiyanval@gmail.com" className="underline hover:text-ink">
            kristiyanval@gmail.com
          </a>
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-ink text-base">
          2. Welche Daten wir erheben und warum
        </h2>
        <p>
          Beim Besuch dieser Website werden keine Tracking- oder
          Werbe-Cookies gesetzt. Wir speichern ausschließlich
          funktionale Session-Daten (z. B. Warenkorb, Login-Status)
          für die Dauer Ihrer Sitzung.
        </p>
        <p className="mt-2">
          Bei einer Bestellung erheben wir folgende Daten, um den
          Kauf abzuwickeln und die Ware zu versenden:
        </p>
        <ul className="mt-1 list-disc pl-5 space-y-1">
          <li>Name und Lieferadresse (Deutschland)</li>
          <li>E-Mail-Adresse</li>
          <li>Zahlungsdaten (werden ausschließlich von Stripe verarbeitet)</li>
          <li>Bestelldaten und Versandstatus</li>
        </ul>
        <p className="mt-2">
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
          (Vertragserfüllung).
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-ink text-base">
          3. Weitergabe an Dritte
        </h2>
        <p>
          Wir geben Ihre Daten nur an Dienstleister weiter, die
          für die Vertragsabwicklung notwendig sind:
        </p>
        <ul className="mt-1 list-disc pl-5 space-y-1">
          <li>
            <strong>Stripe Payments Europe, Ltd.</strong> – Zahlungsabwicklung
            (Karte &amp; PayPal); Datenschutzrichtlinie:{" "}
            <a
              href="https://stripe.com/de/privacy"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-ink"
            >
              stripe.com/de/privacy
            </a>
          </li>
          <li>
            <strong>DHL Paket GmbH</strong> – Versand und Sendungsverfolgung
          </li>
          <li>
            <strong>Vercel Inc.</strong> – Hosting der Website
          </li>
          <li>
            <strong>MongoDB Atlas (MongoDB, Inc.)</strong> – verschlüsselte
            Datenbankablage in der EU-Region
          </li>
          <li>
            <strong>Resend Inc.</strong> – Transaktions-E-Mails
            (Bestellbestätigung)
          </li>
        </ul>
        <p className="mt-2">
          Alle Dienstleister sind DSGVO-konform und haben mit uns
          entsprechende Auftragsverarbeitungsverträge abgeschlossen.
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-ink text-base">
          4. Speicherdauer
        </h2>
        <p>
          Bestelldaten werden für 2 Jahre gespeichert und
          anschließend gelöscht, sofern keine gesetzlichen
          Aufbewahrungspflichten entgegenstehen (z. B.
          Aufbewahrungsfrist nach HGB/AO: 10 Jahre für
          steuerrelevante Belege).
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-ink text-base">
          5. Ihre Rechte
        </h2>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung,
          Einschränkung der Verarbeitung sowie Datenübertragbarkeit.
          Wenden Sie sich hierzu jederzeit per E-Mail an{" "}
          <a
            href="mailto:kristiyanval@gmail.com"
            className="underline hover:text-ink"
          >
            kristiyanval@gmail.com
          </a>
          . Außerdem haben Sie das Recht, Beschwerde bei der
          zuständigen Datenschutzaufsichtsbehörde einzulegen
          (Berliner Beauftragte für Datenschutz und
          Informationsfreiheit).
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-ink text-base">
          6. Kontakt bei Datenschutzfragen
        </h2>
        <p>
          Kristiyan Valin · Schönleinstraße 15, 10967 Berlin ·{" "}
          <a
            href="mailto:kristiyanval@gmail.com"
            className="underline hover:text-ink"
          >
            kristiyanval@gmail.com
          </a>
        </p>
      </section>
    </main>
  );
}
