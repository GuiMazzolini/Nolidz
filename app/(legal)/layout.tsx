import { Barlow_Condensed, Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
});

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${barlow.variable} font-sans antialiased bg-paper text-ink min-h-screen flex flex-col`}>
      <header className="border-b-2 border-ink/10 bg-paper/90">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image
              src="/nolidz.jpeg"
              alt="nolidz"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md object-cover border border-ink/10"
            />
            <span className="font-display italic font-extrabold text-xl text-ink lowercase">
              nolidz
            </span>
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t-2 border-ink/10 py-6">
        <div className="mx-auto max-w-2xl px-4 flex gap-5 text-xs text-ink/50">
          <Link href="/impressum" className="hover:text-ink">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-ink">Datenschutz</Link>
          <Link href="/widerruf" className="hover:text-ink">Widerruf</Link>
        </div>
      </footer>
    </div>
  );
}
