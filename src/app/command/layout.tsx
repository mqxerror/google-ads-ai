import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Insight Hub - Quick Ads AI',
  description: 'AI-powered command center for your Google Marketing data. Chat with your campaigns, analytics, and search data.',
};

export default function InsightHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
