'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CampaignWizard from '@/components/campaigns/CampaignWizard';
import VisualCampaignModal from '@/components/campaigns/VisualCampaignModal';
import VideoCampaignModal from '@/components/campaigns/VideoCampaignModal';
import Link from 'next/link';

type CampaignTypeOption = 'SEARCH' | 'DISPLAY' | 'PMAX' | 'DEMAND_GEN' | 'VIDEO';

const CAMPAIGN_TYPES: Record<CampaignTypeOption, {
  icon: string;
  title: string;
  description: string;
  features: string[];
  color: string;
}> = {
  SEARCH: {
    icon: '🔍',
    title: 'Search Campaign',
    description: 'Text ads on Google Search results when users search for your keywords',
    features: ['Keyword targeting', 'Text ads', 'High intent traffic', 'Pay per click'],
    color: 'bg-blue-500/10 text-blue-500',
  },
  PMAX: {
    icon: '🚀',
    title: 'Performance Max',
    description: 'AI-optimized ads across all Google channels - Search, Display, YouTube, Gmail, Discover',
    features: ['All channels', 'AI optimization', 'Asset-based', 'Best for conversions'],
    color: 'bg-purple-500/10 text-purple-500',
  },
  VIDEO: {
    icon: '▶️',
    title: 'YouTube Video',
    description: 'Video ads on YouTube - in-stream, discovery, shorts, and bumper ads',
    features: ['YouTube ads', 'Skippable/Non-skippable', 'Shorts ads', 'Brand awareness'],
    color: 'bg-red-500/10 text-red-500',
  },
  DISPLAY: {
    icon: '🖼️',
    title: 'Display Campaign',
    description: 'Image ads shown across millions of websites and apps in the Google Display Network',
    features: ['Visual ads', 'Audience targeting', 'Brand awareness', 'Remarketing'],
    color: 'bg-emerald-500/10 text-emerald-500',
  },
  DEMAND_GEN: {
    icon: '✨',
    title: 'Demand Gen',
    description: 'Engaging visual ads on YouTube, Discover feed, and Gmail to reach new customers',
    features: ['YouTube Shorts', 'Discover feed', 'Gmail ads', 'Visually rich'],
    color: 'bg-orange-500/10 text-orange-500',
  },
};

export default function CreateCampaignPage() {
  const router = useRouter();
  const [showSearchWizard, setShowSearchWizard] = useState(false);
  const [showVisualModal, setShowVisualModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [visualModalType, setVisualModalType] = useState<'DISPLAY' | 'PMAX' | 'DEMAND_GEN'>('PMAX');

  const handleClose = () => {
    setShowSearchWizard(false);
    setShowVisualModal(false);
    setShowVideoModal(false);
  };

  const handleSuccess = (campaign: any) => {
    console.log('Campaign created:', campaign);
    router.push('/');
  };

  const handleCampaignTypeSelect = (type: CampaignTypeOption) => {
    if (type === 'SEARCH') {
      setShowSearchWizard(true);
    } else if (type === 'VIDEO') {
      setShowVideoModal(true);
    } else {
      setVisualModalType(type as 'DISPLAY' | 'PMAX' | 'DEMAND_GEN');
      setShowVisualModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
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
              <p className="text-sm text-text3">Choose a campaign type to get started</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Campaign Type Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-text mb-2">Select Campaign Type</h2>
          <p className="text-text3 mb-6">Each campaign type is optimized for different goals and ad formats</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.entries(CAMPAIGN_TYPES) as [CampaignTypeOption, typeof CAMPAIGN_TYPES[CampaignTypeOption]][]).map(([type, info]) => (
              <button
                key={type}
                onClick={() => handleCampaignTypeSelect(type)}
                className="bg-surface rounded-xl border border-divider p-6 text-left hover:border-accent hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl ${info.color} flex items-center justify-center flex-shrink-0 text-2xl`}>
                    {info.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text mb-1 group-hover:text-accent transition-colors">
                      {info.title}
                    </h3>
                    <p className="text-sm text-text3 mb-3">{info.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {info.features.map((feature, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-surface2 text-text3 text-xs rounded-full"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-text3 group-hover:text-accent transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Alternative Options */}
        <div className="border-t border-divider pt-8">
          <h3 className="text-sm font-medium text-text3 mb-4">Or start from...</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/keyword-factory"
              className="bg-surface rounded-lg border border-divider p-5 hover:border-accent transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-text mb-1">Keyword Research</h3>
                  <p className="text-sm text-text3">
                    Generate keywords first, then create campaigns
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/lists"
              className="bg-surface rounded-lg border border-divider p-5 hover:border-accent transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-text mb-1">Keyword Lists</h3>
                  <p className="text-sm text-text3">
                    Use saved keyword lists to create campaigns
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Pro Tips */}
        <div className="mt-8 bg-accent-light rounded-xl p-6">
          <h3 className="font-medium text-accent mb-3 flex items-center gap-2">
            <span>💡</span> Pro Tips
          </h3>
          <ul className="space-y-2 text-sm text-text2">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span><strong>Search</strong> is best for capturing high-intent users actively searching for your products/services</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span><strong>Performance Max</strong> uses Google's AI to optimize across all channels - great for e-commerce and lead gen</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span><strong>Display</strong> is perfect for brand awareness and remarketing to previous visitors</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span><strong>Demand Gen</strong> excels at reaching new audiences on YouTube, Discover, and Gmail</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span><strong>Video</strong> campaigns run on YouTube with various formats - skippable, non-skippable, and Shorts</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Search Campaign Wizard */}
      <CampaignWizard isOpen={showSearchWizard} onClose={handleClose} />

      {/* Visual Campaign Modal (Display/PMax/Demand Gen) */}
      <VisualCampaignModal
        isOpen={showVisualModal}
        onClose={handleClose}
        onSuccess={handleSuccess}
        initialType={visualModalType}
      />

      {/* Video Campaign Modal (YouTube) */}
      <VideoCampaignModal
        isOpen={showVideoModal}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
