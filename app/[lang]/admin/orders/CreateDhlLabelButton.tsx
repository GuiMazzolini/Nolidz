"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminT } from "@/app/i18n/client";

/**
 * One-click DHL Paket label for a paid standard order. Creates the label at
 * DHL (billable), stores the PDF, marks shipped, and can email tracking.
 *
 * Street is editable so the admin can add a missing house number before DHL
 * rejects the shipment.
 */
export default function CreateDhlLabelButton({
  sessionId,
  configured,
  eligible,
  hasLabel,
  initialLine1 = "",
  initialPostalCode = "",
  initialCity = "",
  defaultWeightKg = 1,
}: {
  sessionId: string;
  configured: boolean;
  eligible: boolean;
  hasLabel: boolean;
  initialLine1?: string;
  initialPostalCode?: string;
  initialCity?: string;
  defaultWeightKg?: number;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [sendEmail, setSendEmail] = useState(true);
  const [line1, setLine1] = useState(initialLine1);
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [city, setCity] = useState(initialCity);
  const [weightKg, setWeightKg] = useState(String(defaultWeightKg));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const downloadHref = `/api/admin/orders/${encodeURIComponent(sessionId)}/label`;

  if (hasLabel) {
    return (
      <div className="border-2 border-ink/10 bg-paper px-4 py-3 space-y-2">
        <p className="text-sm font-semibold text-ink">{t.orders.labelReady}</p>
        <a
          href={downloadHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-semibold text-cardboard-dark underline underline-offset-2 hover:text-ink"
        >
          {t.orders.downloadLabel}
        </a>
      </div>
    );
  }

  if (!eligible) {
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const parsedWeight = Number(weightKg);
      if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 31.5) {
        setError(t.orders.labelWeightInvalid);
        setLoading(false);
        return;
      }

      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(sessionId)}/label`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sendEmail,
            weightKg: parsedWeight,
            address: {
              line1: line1.trim(),
              postalCode: postalCode.trim(),
              city: city.trim(),
            },
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : t.orders.labelFailed
        );
        return;
      }

      if (data.created === false) {
        setSuccess(t.orders.labelAlreadyExists);
      } else {
        setSuccess(
          sendEmail ? t.orders.labelCreatedWithEmail : t.orders.labelCreatedNoEmail
        );
      }
      router.refresh();
    } catch {
      setError(t.orders.network);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-2 border-ink/10 bg-paper px-4 py-3 space-y-3"
    >
      <div>
        <p className="text-sm font-semibold text-ink">{t.orders.createLabelTitle}</p>
        <p className="mt-1 text-xs text-ink/55">{t.orders.createLabelHint}</p>
      </div>

      {!configured ? (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2">
          {t.orders.labelNotConfigured}
        </p>
      ) : (
        <>
          <label className="block text-sm text-ink/80">
            <span className="font-medium">{t.orders.labelStreet}</span>
            <input
              type="text"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              required
              placeholder={t.orders.labelStreetPlaceholder}
              className="mt-1 w-full border-2 border-ink/15 bg-white px-3 py-2 text-ink"
            />
            <span className="mt-1 block text-xs text-ink/50">
              {t.orders.labelStreetHint}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm text-ink/80">
              <span className="font-medium">{t.orders.labelPostal}</span>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                required
                className="mt-1 w-full border-2 border-ink/15 bg-white px-3 py-2 text-ink"
              />
            </label>
            <label className="block text-sm text-ink/80">
              <span className="font-medium">{t.orders.labelCity}</span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="mt-1 w-full border-2 border-ink/15 bg-white px-3 py-2 text-ink"
              />
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="mt-0.5"
            />
            <span>{t.orders.emailCustomer}</span>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm text-ink/80">
              <span className="font-medium">{t.orders.labelWeight}</span>
              <input
                type="number"
                min="0.1"
                max="31.5"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
                className="mt-1 w-28 border-2 border-ink/15 bg-white px-3 py-2 text-ink"
              />
              <span className="mt-1 block text-xs text-ink/50">
                {t.orders.labelWeightHint}
              </span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 min-w-[10rem] border-2 border-ink bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-cardboard-dark disabled:opacity-50"
            >
              {loading ? t.orders.creatingLabel : t.orders.createLabel}
            </button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {success && <p className="text-sm text-green-800">{success}</p>}
    </form>
  );
}
