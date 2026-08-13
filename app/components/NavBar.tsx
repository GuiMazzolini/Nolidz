"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "text-cardboard bg-white/10"
          : "text-white/70 hover:text-white hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const shopActive =
    pathname === "/products" || pathname.startsWith("/products/");

  return (
    <nav className="sticky top-0 z-50 bg-ink/90 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4 h-[4.5rem] flex items-center justify-between gap-3 sm:gap-4">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <Image
            src="/nolidz.jpeg"
            alt="nolidz"
            width={48}
            height={48}
            className="h-12 w-12 rounded-md object-cover"
            priority
          />
          <span className="hidden sm:inline font-display italic font-extrabold text-2xl tracking-tight text-white lowercase">
            nolidz
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <NavLink href="/products" label="Shop" active={shopActive} />
          <CartButton active={pathname === "/cart"} />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Remounting on navigation is what closes the account menu. */}
          <AuthButton key={pathname} />
        </div>
      </div>
    </nav>
  );
}
