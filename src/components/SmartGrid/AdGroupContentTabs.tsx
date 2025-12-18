'use client';

import { useState } from 'react';
import KeywordsGrid from './KeywordsGrid';
import AdsGrid from './AdsGrid';

type TabType = 'keywords' | 'ads';

export default function AdGroupContentTabs() {
  const [activeTab, setActiveTab] = useState<TabType>('keywords');

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-gray-200 px-4 py-2 bg-white">
        <button
          onClick={() => setActiveTab('keywords')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'keywords'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Keywords
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'ads'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Ads
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'keywords' ? <KeywordsGrid /> : <AdsGrid />}
      </div>
    </div>
  );
}
