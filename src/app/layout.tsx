import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

import { Providers } from '@/components/ui/Providers';

import '@/styles/globals.css';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Argon',
  description: 'Hourly ETH 8h forecast gates Uniswap LP in and out of range. Deposit once.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable}`}>
      <body className="min-h-dvh bg-void font-mono text-data text-text-hi antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
