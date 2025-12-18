'use client';

import AppShell from '@/components/AppShell';
import TeamManagement from '@/components/Team/TeamManagement';

export default function TeamPage() {
  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-6 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">Team Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage team members, roles, and permissions for your Google Ads accounts
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <TeamManagement />
        </div>
      </div>
    </AppShell>
  );
}
