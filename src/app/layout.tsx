import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Quick Ads AI - Smart Google Ads Management',
  description: 'AI-powered Google Ads optimization. Stop wasting spend. Grow what works.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-bg" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
