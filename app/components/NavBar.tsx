"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AuthButton from "./AuthButton";
import CartButton from "./CartButton";

/**
 * Shop + cart sit in the center as the main browsing actions.
 * Account controls stay on the right.
 */
function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "text-cardboard-dark bg-cardboard/25"
          : "text-ink/65 hover:text-ink hover:bg-ink/5"
      }`}
    >
      {label}
    </Link>
  );
}

function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const onShop = pathname === "/products";

  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <NavLink
        href="/products?category=women"
        label="Women"
        active={onShop && category === "women"}
      />
      <NavLink
        href="/products?category=men"
        label="Men"
        active={onShop && category === "men"}
      />
      <NavLink
        href="/products?category=kids"
        label="Kids"
        active={onShop && category === "kids"}
      />
      <span className="hidden sm:block mx-1 h-4 w-px bg-ink/15" aria-hidden />
      <NavLink
        href="/products"
        label="All"
        active={onShop && !category}
      />
      <CartButton active={pathname === "/cart"} />
    </div>
  );
}

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-paper/90 backdrop-blur-md border-b-2 border-ink/10">
      <div className="container mx-auto px-4 h-[4.5rem] flex items-center justify-between gap-3 sm:gap-4">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <Image
            src="/nolidz.jpeg"
            alt="nolidz"
            width={48}
            height={48}
            className="h-12 w-12 rounded-md object-cover border border-ink/10"
            priority
          />
          <span className="hidden sm:inline font-display italic font-extrabold text-2xl tracking-tight text-ink lowercase">
            nolidz
          </span>
        </Link>

        <Suspense
          fallback={
            <div className="flex items-center gap-1">
              <div className="h-9 w-40 bg-ink/5 animate-pulse" />
              <CartButton active={pathname === "/cart"} />
            </div>
          }
        >
          <NavLinks />
        </Suspense>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Remounting on navigation is what closes the account menu. */}
          <AuthButton key={pathname} />
        </div>
      </div>
    </nav>
  );
}
