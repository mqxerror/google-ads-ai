import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Google Ads Keyword Generator - Free PPC Keyword Tool',
  description: 'Generate keyword variations, synonyms, match types, and negative keywords for Google Ads campaigns. Get real search volume, CPC, and competition data from Google Ads Keyword Planner.',
  keywords: [
    'Google Ads keyword generator',
    'PPC keyword generator',
    'keyword variations generator',
    'negative keyword generator',
    'Google Ads Keyword Planner',
    'keyword research tool',
    'Google Ads keywords',
    'PPC keywords',
    'keyword match types',
    'transactional keywords',
  ],
  openGraph: {
    title: 'Google Ads Keyword Generator - Free PPC Keyword Tool',
    description: 'Generate keyword variations, synonyms, match types, and negative keywords for Google Ads campaigns with real search volume and CPC data.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Google Ads Keyword Generator - Free PPC Keyword Tool',
    description: 'Generate keyword variations, synonyms, match types, and negative keywords for Google Ads campaigns with real search volume and CPC data.',
  },
};

export default function KeywordFactoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
