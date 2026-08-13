import type { Metadata } from 'next';
import { Barlow_Condensed, Inter } from 'next/font/google';
import './globals.css';
import NavBar from './components/NavBar';
import Providers from './providers';

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

export const metadata: Metadata = {
  title: {
    default: 'nolidz — Outlet sneaker finds',
    template: '%s | nolidz',
  },
  description:
    'One-of-a-kind sneakers pulled from outlet hunts. Unboxed, photographed, and ready to wear. No lids. Just pairs.',
  icons: {
    icon: '/nolidz.jpeg',
    apple: '/nolidz.jpeg',
  },
  openGraph: {
    title: 'nolidz — Outlet sneaker finds',
    description:
      'One-of-a-kind sneakers pulled from outlet hunts. Unboxed, photographed, and ready to wear.',
    type: 'website',
    images: ['/nolidz.jpeg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <NavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
