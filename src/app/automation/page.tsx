'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import RulesPanel from '@/components/AutomatedRules/RulesPanel';
import ScheduledReportsPanel from '@/components/ScheduledReports/ScheduledReportsPanel';
import BulkImportExport from '@/components/BulkOperations/BulkImportExport';

type Tab = 'rules' | 'scheduled' | 'bulk';

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rules');

  const tabs = [
    { id: 'rules' as const, name: 'Automated Rules', description: 'Create rules to automate campaign management' },
    { id: 'scheduled' as const, name: 'Scheduled Reports', description: 'Schedule recurring reports' },
    { id: 'bulk' as const, name: 'Bulk Operations', description: 'Import/export campaigns in bulk' },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-6 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">Automation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Automate your Google Ads management with rules, scheduled reports, and bulk operations
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-white px-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }
                `}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'rules' && <RulesPanel />}
          {activeTab === 'scheduled' && <ScheduledReportsPanel />}
          {activeTab === 'bulk' && <BulkImportExport />}
        </div>
      </div>
    </AppShell>
  );
}
