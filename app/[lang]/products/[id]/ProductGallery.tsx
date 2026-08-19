"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { useT } from "@/app/i18n/client";

/**
 * The product photography on a detail page: one large image, with a thumbnail
 * strip and arrows once there is more than one.
 *
 * The images arrive already resolved and ordered — see productGallery, which
 * puts the colourway's hero first and de-duplicates. This component owns only
 * which one is showing.
 *
 * A single-photo product renders exactly what it did before the gallery
 * existed: no strip, no arrows, no controls to tab past.
 */
export default function ProductGallery({
  images,
  alt,
}: {
  /** Display-ready srcs, hero first. Never empty. */
  images: string[];
  alt: string;
}) {
  const t = useT();
  const [active, setActive] = useState(0);
  const count = images.length;

  /**
   * Wraps in both directions: at the last photo "next" returns to the first.
   * A gallery is a loop, and a dead arrow button on the last frame reads as
   * broken rather than as a boundary.
   */
  const step = useCallback(
    (delta: number) => setActive((i) => (i + delta + count) % count),
    [count]
  );

  const current = images[Math.min(active, count - 1)];

  return (
    <div className="w-full max-w-md">
      <div
        className="relative w-full aspect-square"
        // Arrow keys move through the photos once the gallery has focus, which
        // is the behaviour a keyboard user expects from a carousel.
        onKeyDown={(e) => {
          if (count < 2) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          }
        }}
        role="group"
        aria-roledescription="carousel"
        aria-label={t.gallery.photosOf(alt)}
      >
        <Image
          key={current}
          src={current}
          alt={count > 1 ? t.gallery.photoOf(alt, active + 1, count) : alt}
          fill
          className="object-cover rounded-xl"
          unoptimized
          priority
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={t.gallery.previousPhoto}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-3 text-gray-800 shadow-md backdrop-blur transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 touch-manipulation"
            >
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={t.gallery.nextPhoto}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-3 text-gray-800 shadow-md backdrop-blur transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 touch-manipulation"
            >
              <Chevron direction="right" />
            </button>

            <p
              className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white"
              aria-hidden
            >
              {active + 1} / {count}
            </p>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={t.gallery.productPhotos}>
          {images.map((src, index) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={t.gallery.showPhoto(index + 1, count)}
                aria-current={index === active}
                className={`relative block h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  index === active
                    ? "border-blue-600"
                    : "border-transparent hover:border-gray-400"
                }`}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                  // Only the hero is worth blocking render on. Everything past
                  // it loads lazily, which is what lets a product carry as many
                  // photos as it needs without the page paying for all of them.
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points={direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}
