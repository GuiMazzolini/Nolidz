"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Asks DHL for the current status of one parcel.
 *
 * Deliberately manual. An automatic refresh on page load would spend the
 * daily DHL budget every time an admin opened this list, so the request only
 * happens when someone decides they want it.
 */
export default function RefreshTrackingButton({
  sessionId,
  canRefresh,
}: {
  sessionId: string;
  /** False once the parcel is delivered, or within the six-hour floor. */
  canRefresh: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function refresh() {
    setLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(sessionId)}/tracking`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: false }),
        }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setIsError(true);
        setMessage(typeof data.error === "string" ? data.error : "Check failed");
        return;
      }

      // A cached answer is a success, not a failure — say so plainly rather
      // than letting it look like the button did nothing.
      setMessage(
        data.refreshed ? "Updated from DHL." : "Already up to date (cached)."
      );
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={refresh}
        disabled={loading || !canRefresh}
        title={
          canRefresh ? undefined : "Delivered, or checked within the last 6 hours"
        }
        className="border-2 border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-cardboard-dark disabled:opacity-50"
      >
        {loading ? "Checking DHL…" : "Check DHL status"}
      </button>
      {message && (
        <p
          className={`mt-1 text-xs ${isError ? "text-red-700" : "text-ink/60"}`}
          role={isError ? "alert" : undefined}
        >
          {message}
        </p>
      )}
    </div>
  );
}
