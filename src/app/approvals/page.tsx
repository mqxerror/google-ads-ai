'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import ApprovalQueue from '@/components/Approvals/ApprovalQueue';
import RequestApproval from '@/components/Approvals/RequestApproval';
import { CreateApprovalRequest } from '@/types/approvals';

export default function ApprovalsPage() {
  const [showRequestModal, setShowRequestModal] = useState(false);

  const handleSubmitRequest = async (request: CreateApprovalRequest) => {
    // In a real app, this would send to an API
    console.log('Submitting approval request:', request);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Approvals</h1>
              <p className="mt-1 text-sm text-gray-500">
                Review and approve pending changes from team members
              </p>
            </div>
            <button
              onClick={() => setShowRequestModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Request Approval
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <ApprovalQueue />
        </div>

        {/* Request Modal */}
        <RequestApproval
          isOpen={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          onSubmit={handleSubmitRequest}
        />
      </div>
    </AppShell>
  );
}
