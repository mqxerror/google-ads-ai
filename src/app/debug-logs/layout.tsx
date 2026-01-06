import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Debug Logs - Quick Ads AI',
  description: 'View API and MCP data fetching logs',
};

export default function DebugLogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
