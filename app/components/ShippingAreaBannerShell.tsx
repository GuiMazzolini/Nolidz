"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/app/i18n/client";

const DISMISSED_KEY = "nolidz:shipping-area-banner-dismissed";

/**
 * Dismissal lives in sessionStorage, which React treats as an external store:
 * the server cannot know what this tab has dismissed, so the first render has
 * to claim "not dismissed" and correct itself once mounted. Going through
 * useSyncExternalStore does that without a hydration mismatch and without a
 * setState in an effect.
 *
 * Per tab, not permanent, and deliberately so — the IP guess that put this
 * banner on screen can be wrong, and one shopper dismissing it on a VPN
 * should not silence it for the next person on that browser.
 */
let listeners: (() => void)[] = [];

function subscribe(onChange: () => void) {
  listeners.push(onChange);
  return () => {
    listeners = listeners.filter((l) => l !== onChange);
  };
}

function isDismissed() {
  return sessionStorage.getItem(DISMISSED_KEY) === "1";
}

function neverDismissedOnServer() {
  return false;
}

function dismiss() {
  sessionStorage.setItem(DISMISSED_KEY, "1");
  for (const listener of listeners) listener();
}

/**
 * The visible half of ShippingAreaBanner.
 *
 * Wording stays a statement of where we ship, not an assertion about where the
 * reader is. IP is a guess, and a German customer reading this from a holiday
 * or a work VPN should recognise it as information rather than a refusal —
 * their German delivery address will go through either way.
 */
export default function ShippingAreaBannerShell({ area }: { area: string }) {
  const t = useT();
  const dismissed = useSyncExternalStore(
    subscribe,
    isDismissed,
    neverDismissedOnServer
  );

  if (dismissed) return null;

  return (
    <div className="border-b-2 border-ink/10 bg-cardboard/25 text-ink">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-4 py-2.5 sm:px-6">
        <p className="text-sm">
          <span className="font-semibold">{t.shippingBanner.shipToOnly(area)}</span>{" "}
          <span className="text-ink/70">{t.shippingBanner.body(area)}</span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.shippingBanner.dismiss}
          className="shrink-0 px-1 text-lg leading-none text-ink/65 hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>
  );
}
