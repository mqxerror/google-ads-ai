import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quick Ads AI - Fast Google Ads Management',
  description: 'Simple, fast, AI-driven Google Ads management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg">
        {children}
      </body>
    </html>
  );
}
