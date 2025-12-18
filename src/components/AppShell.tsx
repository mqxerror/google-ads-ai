'use client';

import { useState, ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import ActionQueueDrawer from './ActionQueueDrawer';
import GlobalUI from './GlobalUI';
import Breadcrumb from './Breadcrumb/Breadcrumb';
import { useActionQueue } from '@/contexts/ActionQueueContext';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const { pendingCount } = useActionQueue();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar */}
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        isMobile
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:ml-64">
        {/* Header */}
        <Header onMenuToggle={() => setIsMobileSidebarOpen(true)} />

        {/* Breadcrumb Navigation */}
        <div className="border-b border-gray-200 bg-white px-4 py-2 lg:px-6">
          <Breadcrumb />
        </div>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 pb-20 md:pb-6">
          {children}
        </main>

        {/* Chat Panel Toggle Button (desktop) */}
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 sm:bottom-4"
            aria-label="Open AI Chat"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </button>
        )}

        {/* Action Queue Toggle Button (mobile fixed bottom bar) */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white p-2 sm:hidden">
          <button
            onClick={() => setIsQueueOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700"
          >
            <svg className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Action Queue
            <span className={`rounded-full px-2 py-0.5 text-xs ${pendingCount > 0 ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'}`}>
              {pendingCount}
            </span>
          </button>
        </div>

        {/* Desktop Action Queue Button */}
        <button
          onClick={() => setIsQueueOpen(true)}
          className={`fixed bottom-4 left-4 z-30 hidden items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-lg sm:flex lg:left-72 ${
            pendingCount > 0
              ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          Action Queue
          <span className={`rounded-full px-2 py-0.5 text-xs ${pendingCount > 0 ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'}`}>
            {pendingCount}
          </span>
        </button>
      </div>

      {/* Chat Panel */}
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* Action Queue Drawer */}
      <ActionQueueDrawer isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />

      {/* Global UI Components (Command Palette, Keyboard Shortcuts, Toast, Mobile Nav) */}
      <GlobalUI />
    </div>
  );
}
