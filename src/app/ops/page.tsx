'use client';

import { OpsWorkbench } from '@/components/OpsWorkbench';
import { QueueMonitor } from '@/components/QueueMonitor';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

type OpsTab = 'actions' | 'queue';

export default function OpsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<OpsTab>('actions');

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setIsSidebarOpen(true)} />

        {/* Tab Bar */}
        <div className="bg-white border-b border-gray-200 px-6">
          <nav className="flex gap-6" aria-label="Tabs">
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
          </nav>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {activeTab === 'actions' && <OpsWorkbench />}
          {activeTab === 'queue' && <QueueMonitor />}
        </main>
      </div>
    </div>
  );
}
