'use client';

import { OpsWorkbench } from '@/components/OpsWorkbench';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

export default function OpsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-hidden">
          <OpsWorkbench />
        </main>
      </div>
    </div>
  );
}
