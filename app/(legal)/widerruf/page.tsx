import type { Metadata } from "next";

export const metadata: Metadata = { title: "Widerrufsbelehrung" };

export default function WiderrufPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-sm text-ink/80 space-y-8">
      <h1 className="font-barlow text-4xl font-extrabold uppercase tracking-tight text-ink">
        Widerrufsbelehrung
      </h1>

      <section>
        <h2 className="mb-2 font-semibold text-ink text-base">Widerrufsrecht</h2>
        <p>
          Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von
          Gründen diesen Vertrag zu widerrufen.
        </p>
        <p className="mt-2">
          Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem
          Sie oder ein von Ihnen benannter Dritter, der nicht der
          Beförderer ist, die Waren in Besitz genommen haben bzw. hat.
        </p>
        <p className="mt-2">
          Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
        </p>
        <address className="mt-1 not-italic pl-4 border-l-2 border-ink/20 space-y-0.5">
          <p>Kristiyan Valin</p>
          <p>Schönleinstraße 15</p>
          <p>10967 Berlin</p>
          <p>
            E-Mail:{" "}
            <a
              href="mailto:kristiyanval@gmail.com"
              className="underline hover:text-ink"
            >
              kristiyanval@gmail.com
            </a>
          </p>
        </address>
        <p className="mt-2">
          mittels einer eindeutigen Erklärung (z. B. eine per Post
          versandte oder per E-Mail übermittelte Mitteilung) über
          Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.
          Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die
          Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf
          der Widerrufsfrist absenden.
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-ink text-base">
          Folgen des Widerrufs
        </h2>
        <p>
          Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle
          Zahlungen, die wir von Ihnen erhalten haben, unverzüglich
          und spätestens binnen vierzehn Tagen ab dem Tag
          zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf
          dieses Vertrags bei uns eingegangen ist. Für diese
          Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie
          bei der ursprünglichen Transaktion eingesetzt haben, es sei
          denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart;
          in keinem Fall werden Ihnen wegen dieser Rückzahlung
          Entgelte berechnet.
        </p>
        <p className="mt-2">
          Wir können die Rückzahlung verweigern, bis wir die Waren
          wieder zurückerhalten haben oder bis Sie den Nachweis
          erbracht haben, dass Sie die Waren zurückgesandt haben, je
          nachdem, welches der frühere Zeitpunkt ist.
        </p>
        <p className="mt-2">
          Sie haben die Waren unverzüglich und in jedem Fall
          spätestens binnen vierzehn Tagen ab dem Tag, an dem Sie uns
          über den Widerruf dieses Vertrags unterrichten, an uns
          zurückzusenden oder zu übergeben. Die Frist ist gewahrt,
          wenn Sie die Waren vor Ablauf der Frist von vierzehn Tagen
          absenden.
        </p>
        <p className="mt-2 font-semibold text-ink">
          Wir tragen die Kosten der Rücksendung.
        </p>
        <p className="mt-2">
          Sie müssen für einen etwaigen Wertverlust der Waren nur
          aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der
          Beschaffenheit, Eigenschaften und Funktionsweise der Waren
          nicht notwendigen Umgang mit ihnen zurückzuführen ist.
        </p>
      </section>

      <section className="rounded-lg bg-ink/5 p-4 text-xs text-ink/60">
        <p>
          <strong className="text-ink">Hinweis:</strong> Das
          Widerrufsrecht gilt nicht für Waren, die nach
          Kundenspezifikation angefertigt wurden oder die aufgrund
          ihrer Beschaffenheit nicht für eine Rücksendung geeignet
          sind. Outlet-Artikel können, wenn sie deutlich beschädigt
          oder getragen zurückgesendet werden, vom Widerruf
          ausgeschlossen werden — bitte senden Sie Artikel in
          ungetragenem Zustand zurück.
        </p>
      </section>
    </main>
  );
}
