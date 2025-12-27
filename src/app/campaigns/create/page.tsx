'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CampaignWizard from '@/components/campaigns/CampaignWizard';
import Link from 'next/link';

export default function CreateCampaignPage() {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(true);

  const handleClose = () => {
    setShowWizard(false);
    // Redirect to dashboard after closing
    setTimeout(() => {
      router.push('/');
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-divider px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-text3 hover:text-text transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text">Create Campaign</h1>
              <p className="text-sm text-text3">Build a Google Ads campaign with AI assistance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-surface rounded-xl border border-divider p-8 mb-6">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold text-text mb-3">Ready to Launch Your Campaign?</h2>
            <p className="text-text3 mb-6">
              Our AI-powered wizard will guide you through creating a complete Google Ads campaign in 5 simple steps.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center">
                <div className="text-3xl mb-2">🎯</div>
                <div className="text-sm font-medium text-text">Smart Keyword Clustering</div>
                <div className="text-xs text-text3 mt-1">AI groups keywords by semantic similarity</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">✍️</div>
                <div className="text-sm font-medium text-text">AI-Generated Ad Copy</div>
                <div className="text-xs text-text3 mt-1">Claude writes compelling headlines & descriptions</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">💰</div>
                <div className="text-sm font-medium text-text">Real-Time Cost Estimates</div>
                <div className="text-xs text-text3 mt-1">See projected budgets at every step</div>
              </div>
            </div>

            <button
              onClick={() => setShowWizard(true)}
              className="px-8 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
            >
              Start Creating Campaign
            </button>
          </div>
        </div>

        {/* Alternative Options */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/keyword-factory"
            className="bg-surface rounded-lg border border-divider p-6 hover:border-accent transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-text mb-1">Start with Keyword Research</h3>
                <p className="text-sm text-text3">
                  Generate and analyze keywords first, then create campaigns from your selections
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/landing-analyzer"
            className="bg-surface rounded-lg border border-divider p-6 hover:border-accent transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-text mb-1">Analyze Landing Page First</h3>
                <p className="text-sm text-text3">
                  Extract keywords from your landing page and get AI-powered campaign suggestions
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Campaign Wizard */}
      <CampaignWizard isOpen={showWizard} onClose={handleClose} />
    </div>
  );
}
