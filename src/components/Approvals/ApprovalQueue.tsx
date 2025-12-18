'use client';

import { useState } from 'react';
import { ApprovalStatus, ApprovalChangeType } from '@/types/approvals';
import { useApprovals } from '@/contexts/ApprovalsContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import ApprovalRequest from './ApprovalRequest';
import RequestApproval from './RequestApproval';

interface ApprovalQueueProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ApprovalQueue({ isOpen = true, onClose }: ApprovalQueueProps) {
  const { checks } = usePermissions();
  const {
    approvalRequests,
    pendingRequests,
    stats,
    isLoading,
    error,
    createApprovalRequest,
    reviewApprovalRequest,
    cancelApprovalRequest,
  } = useApprovals();

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ApprovalChangeType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleApprove = async (requestId: string, comments?: string) => {
    try {
      await reviewApprovalRequest({
        requestId,
        decision: 'approve',
        comments,
      });
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (requestId: string, comments?: string) => {
    try {
      await reviewApprovalRequest({
        requestId,
        decision: 'reject',
        comments,
      });
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (confirm('Are you sure you want to cancel this approval request?')) {
      try {
        await cancelApprovalRequest(requestId);
      } catch (err) {
        console.error('Failed to cancel:', err);
      }
    }
  };

  const handleCreateRequest = async (request: any) => {
    await createApprovalRequest(request);
  };

  // Filter requests
  const filteredRequests = approvalRequests.filter((request) => {
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesType = typeFilter === 'all' || request.changeType === typeFilter;
    const matchesSearch =
      !searchQuery ||
      request.entityName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.requestedBy.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesType && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl overflow-y-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Approval Queue</h2>
              <p className="mt-1 text-sm text-gray-500">
                Review and manage approval requests
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-yellow-50 p-3 text-center">
              <div className="text-2xl font-semibold text-yellow-700">{stats.pending}</div>
              <div className="text-xs text-yellow-600">Pending</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div className="text-2xl font-semibold text-green-700">{stats.approved}</div>
              <div className="text-xs text-green-600">Approved</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <div className="text-2xl font-semibold text-red-700">{stats.rejected}</div>
              <div className="text-xs text-red-600">Rejected</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <div className="text-2xl font-semibold text-gray-700">{stats.total}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4">
            <button
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search requests..."
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <svg
                  className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ApprovalStatus | 'all')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ApprovalChangeType | 'all')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="budget_increase">Budget Increase</option>
              <option value="budget_decrease">Budget Decrease</option>
              <option value="bid_change">Bid Change</option>
              <option value="status_change">Status Change</option>
              <option value="campaign_create">Campaign Creation</option>
              <option value="campaign_delete">Campaign Deletion</option>
              <option value="bulk_edit">Bulk Edit</option>
            </select>
          </div>

          {/* Requests List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-lg bg-gray-50 py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-4 text-sm text-gray-500">No approval requests found</p>
              <p className="mt-1 text-xs text-gray-400">
                Try adjusting your filters or create a new request
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => (
                <ApprovalRequest
                  key={request.id}
                  request={request}
                  onApprove={checks.canApprove() ? handleApprove : undefined}
                  onReject={checks.canApprove() ? handleReject : undefined}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )}

          {/* Quick Actions for Managers */}
          {checks.canApprove() && pendingRequests.length > 0 && (
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-900">
                    {pendingRequests.length} request{pendingRequests.length !== 1 ? 's' : ''} awaiting review
                  </h3>
                  <p className="mt-1 text-sm text-blue-700">
                    Review pending requests to keep your team moving
                  </p>
                </div>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Review Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Request Approval Modal */}
      <RequestApproval
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSubmit={handleCreateRequest}
      />
    </>
  );
}
