'use client';

import { OpsWorkbench } from '@/components/OpsWorkbench';
import { QueueMonitor } from '@/components/QueueMonitor';
import { CacheInspector } from '@/components/CacheInspector';
import SystemStatus from '@/components/OpsCenter/SystemStatus';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';

type OpsTab = 'actions' | 'queue' | 'cache' | 'system';

// Environment detection
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';

export default function OpsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<OpsTab>('actions');
  const [gitSha, setGitSha] = useState<string>('');

  // Try to get git SHA on mount
  useEffect(() => {
    // In production, this would be set at build time
    // For now, just show build ID
    setGitSha(BUILD_ID.slice(0, 7));
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setIsSidebarOpen(true)} />

        {/* Environment Banner + Tab Bar */}
        <div className="bg-white border-b border-gray-200">
          {/* Environment Badge */}
          <div className="px-6 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${
                IS_PRODUCTION
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-green-100 text-green-800 border border-green-200'
              }`}>
                {IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}
              </span>
              {gitSha && (
                <span className="text-xs text-gray-400 font-mono">
                  build: {gitSha}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {/* Tab Bar */}
          <nav className="flex gap-6 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('actions')}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'actions'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Action Queue
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'queue'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Background Jobs
            </button>
            <button
              onClick={() => setActiveTab('cache')}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'cache'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Cache Inspector
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'system'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              System
            </button>
          </nav>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {activeTab === 'actions' && <OpsWorkbench />}
          {activeTab === 'queue' && <QueueMonitor />}
          {activeTab === 'cache' && <CacheInspector />}
          {activeTab === 'system' && <SystemStatus />}
        </main>
      </div>
    </div>
  );
}
