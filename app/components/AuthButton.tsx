"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Account menu.
 *
 * NavBar remounts this on navigation (`key={pathname}`), which is what closes
 * the menu after a link is followed — no effect syncing state to the route.
 */
export default function AuthButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (status === "loading") {
    return <div className="h-9 w-28 bg-ink/5 animate-pulse" />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link
          href="/login"
          className="border-2 border-ink/15 px-2.5 sm:px-3 py-2 text-sm font-medium text-ink/75 hover:border-ink/30 hover:bg-white/60 transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/login?mode=signup"
          className="bg-ink px-3 sm:px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/85 transition-colors"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const name = session.user?.name;
  const email = session.user?.email;
  const isAdmin = !!session.user?.isAdmin;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`flex items-center gap-2 py-1 pl-1 pr-2 transition-colors ${
          open ? "bg-ink/5" : "hover:bg-ink/5"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cardboard text-xs font-semibold text-ink">
          {initials(name)}
        </span>
        <span className="hidden sm:block max-w-[120px] truncate text-sm font-medium text-ink/75">
          {name}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-ink/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden border-2 border-ink/10 bg-white shadow-lg"
        >
          <div className="border-b border-ink/10 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            {email && (
              <p className="truncate text-xs text-ink/50" title={email}>
                {email}
              </p>
            )}
          </div>

          <div className="py-1">
            <Link
              href="/orders"
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink/80 hover:bg-paper"
            >
              <svg className="h-4 w-4 text-ink/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Order history
            </Link>

            <Link
              href="/account"
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink/80 hover:bg-paper"
            >
              <svg className="h-4 w-4 text-ink/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Account settings
            </Link>

            {isAdmin && (
              <Link
                href="/admin/products"
                role="menuitem"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink/80 hover:bg-paper"
              >
                <svg className="h-4 w-4 text-ink/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin
              </Link>
            )}
          </div>

          <div className="border-t border-ink/10 py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink/80 hover:bg-paper"
            >
              <svg className="h-4 w-4 text-ink/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
