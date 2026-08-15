"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AuthButton from "./AuthButton";
import CartButton from "./CartButton";

function NavLink({
  href,
  label,
  active,
  compact = false,
}: {
  href: string;
  label: string;
  active: boolean;
  /** Tighter padding for the mobile category strip. */
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`font-medium transition-colors ${
        compact
          ? "flex-1 px-1 py-2 text-center text-xs"
          : "block px-3 py-2 text-sm"
      } ${
        active
          ? "text-cardboard-dark bg-cardboard/25"
          : "text-ink/65 hover:text-ink hover:bg-ink/5"
      }`}
    >
      {label}
    </Link>
  );
}

function CategoryLinks({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const onShop = pathname === "/products";

  return (
    <>
      <NavLink
        href="/products?category=women"
        label="Women"
        active={onShop && category === "women"}
        compact={compact}
      />
      <NavLink
        href="/products?category=men"
        label="Men"
        active={onShop && category === "men"}
        compact={compact}
      />
      <NavLink
        href="/products?category=kids"
        label="Kids"
        active={onShop && category === "kids"}
        compact={compact}
      />
      <NavLink
        href="/products"
        label="All"
        active={onShop && !category}
        compact={compact}
      />
    </>
  );
}

function DesktopNav() {
  const pathname = usePathname();

  return (
    <div className="hidden sm:flex items-center gap-1">
      <Suspense
        fallback={<div className="h-9 w-48 bg-ink/5 animate-pulse" />}
      >
        <div className="flex items-center gap-0.5">
          <CategoryLinks />
          <span className="mx-1 h-4 w-px bg-ink/15" aria-hidden />
        </div>
      </Suspense>
      <CartButton active={pathname === "/cart"} />
    </div>
  );
}

function MobileCategories() {
  return (
    <div className="sm:hidden border-t border-ink/10">
      <Suspense
        fallback={
          <div className="flex gap-1 px-2 py-2">
            <div className="h-8 flex-1 bg-ink/5 animate-pulse" />
            <div className="h-8 flex-1 bg-ink/5 animate-pulse" />
            <div className="h-8 flex-1 bg-ink/5 animate-pulse" />
            <div className="h-8 flex-1 bg-ink/5 animate-pulse" />
          </div>
        }
      >
        <nav
          aria-label="Shop by"
          className="flex items-stretch gap-0.5 px-1"
        >
          <CategoryLinks compact />
        </nav>
      </Suspense>
    </div>
  );
}

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-paper/90 backdrop-blur-md border-b-2 border-ink/10">
      <div className="container mx-auto px-3 sm:px-4 h-14 sm:h-[4.5rem] flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
          <Image
            src="/nolidz.jpeg"
            alt="nolidz"
            width={48}
            height={48}
            className="h-9 w-9 sm:h-12 sm:w-12 rounded-md object-cover border border-ink/10"
            priority
          />
          <span className="hidden sm:inline font-display italic font-extrabold text-2xl tracking-tight text-ink lowercase">
            nolidz
          </span>
        </Link>

        <DesktopNav />

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="sm:hidden">
            <CartButton active={pathname === "/cart"} />
          </div>
          {/* Remounting on navigation is what closes the account menu. */}
          <AuthButton key={pathname} />
        </div>
      </div>

      <MobileCategories />
    </nav>
  );
}
