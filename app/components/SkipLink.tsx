"use client";

import { useT } from "@/app/i18n/client";

/** First focusable control for keyboard users; visually hidden until focused. */
export default function SkipLink() {
  const t = useT();

  return (
    <a href="#main-content" className="skip-link">
      {t.common.skipToContent}
    </a>
  );
}
