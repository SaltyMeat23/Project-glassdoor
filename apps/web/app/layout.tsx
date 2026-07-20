import type { Metadata } from 'next';
import { Archivo, Inter, IBM_Plex_Mono } from 'next/font/google';
import { Tabs } from '@/components/Tabs';
import './globals.css';

// Self-hosted at build time (next/font) — no runtime third-party request,
// honoring SECURITY.md §8.2 (no external scripts/fonts/trackers).
const display = Archivo({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});
const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ContractIQ — How do I compare?',
  description:
    'Total-comp intelligence for the U.S. cleared defense workforce. See how your pay and benefits compare to the market — before you sign.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line">
          <div className="mx-auto max-w-5xl px-5 h-14 flex items-center justify-between">
            <span className="font-display font-extrabold tracking-tight text-[17px]">
              Contract<span className="text-accent">IQ</span>
            </span>
            <span className="text-[12px] text-muted">
              Private &amp; anonymous — no account, no name.
            </span>
          </div>
        </header>
        <Tabs />
        {children}
      </body>
    </html>
  );
}
