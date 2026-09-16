"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/app/i18n/client";

/**
 * The product photography on a detail page: one large image, with a thumbnail
 * strip and arrows once there is more than one.
 *
 * Click the hero to open a lightbox; click again inside it to toggle zoom.
 * The images arrive already resolved and ordered — see productGallery.
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const count = images.length;

  const step = useCallback(
    (delta: number) => setActive((i) => (i + delta + count) % count),
    [count]
  );

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setZoomed(false);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      } else if (count > 1 && e.key === "ArrowLeft") {
        e.preventDefault();
        setZoomed(false);
        step(-1);
      } else if (count > 1 && e.key === "ArrowRight") {
        e.preventDefault();
        setZoomed(false);
        step(1);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen, closeLightbox, step, count]);

  const current = images[Math.min(active, count - 1)];

  return (
    <div className="w-full max-w-md">
      <div
        className="relative w-full aspect-square"
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
        <button
          type="button"
          onClick={() => {
            setZoomed(false);
            setLightboxOpen(true);
          }}
          className="absolute inset-0 z-[1] cursor-zoom-in rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          aria-label={t.gallery.openLarger}
        >
          <Image
            key={current}
            src={current}
            alt={count > 1 ? t.gallery.photoOf(alt, active + 1, count) : alt}
            fill
            className="object-cover rounded-xl pointer-events-none"
            unoptimized
            priority
          />
        </button>

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
              className="absolute bottom-2 right-2 z-10 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white"
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
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.gallery.lightboxLabel(alt)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label={t.gallery.closeLarger}
            className="absolute right-4 top-4 z-20 rounded-full bg-white/90 px-3 py-2 text-sm font-semibold text-ink hover:bg-white"
          >
            {t.gallery.closeLarger}
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomed(false);
                  step(-1);
                }}
                aria-label={t.gallery.previousPhoto}
                className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-3 text-ink hover:bg-white sm:left-6"
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomed(false);
                  step(1);
                }}
                aria-label={t.gallery.nextPhoto}
                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-3 text-ink hover:bg-white sm:right-6"
              >
                <Chevron direction="right" />
              </button>
            </>
          )}

          <div
            className={`relative max-h-[90vh] max-w-[min(90vw,56rem)] overflow-auto ${
              zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setZoomed((z) => !z);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- lightbox needs native scaling without Next layout constraints */}
            <img
              src={current}
              alt={count > 1 ? t.gallery.photoOf(alt, active + 1, count) : alt}
              className={`mx-auto select-none transition-transform duration-200 ${
                zoomed
                  ? "max-h-none w-[min(160vw,72rem)] max-w-none"
                  : "max-h-[85vh] w-auto max-w-full"
              }`}
              draggable={false}
            />
            <p className="mt-3 text-center text-sm text-paper/80">
              {zoomed ? t.gallery.zoomOutHint : t.gallery.zoomInHint}
            </p>
          </div>
        </div>
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
