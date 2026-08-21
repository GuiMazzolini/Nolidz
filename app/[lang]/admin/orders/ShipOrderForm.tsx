"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminT } from "@/app/i18n/client";

/**
 * The carriers offered at checkout come first, because those are what the
 * warehouse actually ships and what tracking can look up. The rest stay on the
 * list because orders have gone out with them before and the field has always
 * been free text.
 */
const CARRIER_SUGGESTIONS = [
  "DHL",
  "DHL Express",
  "DPD",
  "UPS",
  "FedEx",
  "GLS",
  "Hermes",
];

export default function ShipOrderForm({
  sessionId,
  initialTracking = "",
  initialCarrier = "",
  alreadyShipped = false,
}: {
  sessionId: string;
  initialTracking?: string;
  initialCarrier?: string;
  alreadyShipped?: boolean;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [carrier, setCarrier] = useState(initialCarrier);
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(sessionId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackingNumber,
            carrier: carrier || null,
            sendEmail,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : t.orders.updateFailed
        );
        return;
      }

      setSuccess(
        sendEmail ? t.orders.shippedWithEmail : t.orders.shippedNoEmail
      );
      router.refresh();
    } catch {
      setError(t.orders.network);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-2 border-ink/10 bg-paper p-4">
      <p className="text-sm font-semibold text-ink">
        {alreadyShipped ? t.orders.shipFormUpdate : t.orders.shipFormCreate}
      </p>
      <p className="text-xs text-ink/50">{t.orders.shipFormHint}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink/70">
            {t.orders.trackingNumberLabel}
          </span>
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            required
            placeholder={t.orders.trackingNumberPlaceholder}
            className="w-full border-2 border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-cardboard"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink/70">
            {t.orders.carrierLabel}
          </span>
          <input
            list={`carriers-${sessionId}`}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder={t.orders.carrierPlaceholder}
            className="w-full border-2 border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-cardboard"
          />
          <datalist id={`carriers-${sessionId}`}>
            {CARRIER_SUGGESTIONS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink/75">
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
          className="border-ink/30"
        />
        {t.orders.emailCustomer}
      </label>

      {error && (
        <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !trackingNumber.trim()}
        className="bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/85 disabled:opacity-60"
      >
        {loading
          ? t.common.saving
          : alreadyShipped
            ? t.orders.updateAndNotify
            : t.orders.markShipped}
      </button>
    </form>
  );
}
