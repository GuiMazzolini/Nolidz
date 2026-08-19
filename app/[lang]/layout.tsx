import type { Metadata } from 'next';
import { Barlow_Condensed, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import '../globals.css';
import NavBar from '@/app/components/NavBar';
import Footer from '@/app/components/Footer';
import Providers from '@/app/providers';
import { I18nProvider } from '@/app/i18n/client';
import { LOCALES, LOCALE_HTML_LANG, isLocale } from '@/app/i18n/config';
import { dictionaryFor, getLocale } from '@/app/i18n/server';
import { getAppUrl } from '@/app/lib/stripe';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-barlow',
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = dictionaryFor(locale);

  return {
    // Lets the metadata helpers resolve relative URLs against the real host.
    metadataBase: new URL(getAppUrl()),
    title: {
      default: t.home.metaTitle,
      template: '%s | nolidz',
    },
    description: t.home.metaDescription,
    icons: {
      icon: '/nolidz.jpeg',
      apple: '/nolidz.jpeg',
    },
    openGraph: {
      title: t.home.metaTitle,
      description: t.home.ogDescription,
      type: 'website',
      locale: LOCALE_HTML_LANG[locale],
      images: ['/nolidz.jpeg'],
    },
  };
}

/**
 * Props are spelled out rather than taken from the generated `LayoutProps`
 * helper. That global only exists once `next typegen` has written .next/types,
 * which a clean checkout running `tsc --noEmit` before `next build` has not —
 * so relying on it makes the typecheck pass or fail depending on whether a
 * build happened to run first.
 */
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={LOCALE_HTML_LANG[lang]}
      className={`${inter.variable} ${barlow.variable}`}
    >
      <body className="font-sans antialiased">
        {/* Only the locale string crosses into the client tree; the dictionary
            itself is imported there, so navigation does not re-serialise it. */}
        <I18nProvider locale={lang}>
          <Providers>
            <NavBar />
            {children}
            <Footer />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
