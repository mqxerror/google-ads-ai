'use client';

import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChatPanel } from '@/components/insight-hub';
import { Suspense } from 'react';

function InsightHubContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  // Get context from URL params
  const initialQuery = searchParams.get('q') || undefined;
  const contextView = searchParams.get('ctx') || undefined;
  const campaignId = searchParams.get('cid') || undefined;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="text-gray-500 text-sm">Loading Insight Hub...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <span className="text-5xl mb-4 block">🔒</span>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in Required</h1>
          <p className="text-gray-600 mb-6">
            Please sign in to access the Insight Hub and connect your Google Marketing accounts.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo and title */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <span className="text-2xl">🧠</span>
                <span className="font-bold text-gray-900">Insight Hub</span>
              </Link>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-full">
                BETA
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/campaigns/create"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Campaigns
              </Link>
              <Link
                href="/spend-shield"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Spend Shield
              </Link>
              <div className="w-px h-4 bg-gray-300" />
              <div className="flex items-center gap-2">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                    {session?.user?.name?.[0] || 'U'}
                  </div>
                )}
                <span className="text-sm text-gray-700 hidden sm:block">
                  {session?.user?.name?.split(' ')[0]}
                </span>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        <div className="flex-1 flex flex-col bg-white shadow-sm my-4 mx-4 rounded-xl overflow-hidden border border-gray-200">
          <ChatPanel initialQuery={initialQuery} contextView={contextView} campaignId={campaignId} />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-400">
            Insight Hub connects to your Google Ads, Analytics, Search Console, and BigQuery data.
            <span className="mx-2">•</span>
            <Link href="/settings/api-keys" className="text-blue-600 hover:underline">
              Configure APIs
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function InsightHubPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="text-gray-500 text-sm">Loading Insight Hub...</p>
        </div>
      </div>
    }>
      <InsightHubContent />
    </Suspense>
  );
}
