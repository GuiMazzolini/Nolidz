"use client";

import Image from "next/image";
import NextLink from "next/link";
import { useT } from "@/app/i18n/client";

export default function Footer() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-ink/10 bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/nolidz.jpeg"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-md object-cover border border-ink/10"
          />
          <span className="font-display italic font-extrabold text-xl">nolidz</span>
        </div>
        <nav className="flex gap-5 text-xs text-ink/70">
          <NextLink href="/impressum" className="hover:text-ink transition-colors">
            {t.footer.impressum}
          </NextLink>
          <NextLink href="/datenschutz" className="hover:text-ink transition-colors">
            {t.footer.datenschutz}
          </NextLink>
          <NextLink href="/widerruf" className="hover:text-ink transition-colors">
            {t.footer.widerruf}
          </NextLink>
          <span>{t.footer.copyright(year)}</span>
        </nav>
      </div>
    </footer>
  );
}
