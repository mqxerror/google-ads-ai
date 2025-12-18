'use client';

import { useState } from 'react';
import { ApprovalRequest as ApprovalRequestType } from '@/types/approvals';
import { usePermissions } from '@/contexts/PermissionsContext';

interface ApprovalRequestProps {
  request: ApprovalRequestType;
  onApprove?: (requestId: string, comments?: string) => void;
  onReject?: (requestId: string, comments?: string) => void;
  onCancel?: (requestId: string) => void;
  isExpanded?: boolean;
}

export default function ApprovalRequest({
  request,
  onApprove,
  onReject,
  onCancel,
  isExpanded = false,
}: ApprovalRequestProps) {
  const { currentUser, checks } = usePermissions();
  const [expanded, setExpanded] = useState(isExpanded);
  const [reviewComments, setReviewComments] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

  const isPending = request.status === 'pending';
  const canReview = checks.canApprove() && isPending;
  const canCancel = request.requestedBy.id === currentUser?.id && isPending;

  const getStatusColor = (status: ApprovalRequestType['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getChangeTypeLabel = (changeType: ApprovalRequestType['changeType']) => {
    const labels: Record<typeof changeType, string> = {
      budget_increase: 'Budget Increase',
      budget_decrease: 'Budget Decrease',
      bid_change: 'Bid Change',
      status_change: 'Status Change',
      campaign_create: 'Campaign Creation',
      campaign_delete: 'Campaign Deletion',
      bulk_edit: 'Bulk Edit',
    };
    return labels[changeType];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleReview = (action: 'approve' | 'reject') => {
    setReviewAction(action);
    setShowReviewForm(true);
  };

  const handleSubmitReview = () => {
    if (reviewAction === 'approve' && onApprove) {
      onApprove(request.id, reviewComments || undefined);
    } else if (reviewAction === 'reject' && onReject) {
      onReject(request.id, reviewComments || undefined);
    }
    setShowReviewForm(false);
    setReviewComments('');
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(request.status)}`}>
              {request.status}
            </span>
            <span className={`inline-flex items-center text-xs font-medium ${getPriorityColor(request.priority)}`}>
              {request.priority} priority
            </span>
          </div>

          <h3 className="font-medium text-gray-900">
            {getChangeTypeLabel(request.changeType)}
            {request.entityName && `: ${request.entityName}`}
          </h3>

          {/* Metadata */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {request.requestedBy.name}
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDate(request.requestedAt)}
            </span>
            {request.impact?.estimatedSpendChange && (
              <span className={`font-medium ${request.impact.estimatedSpendChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {request.impact.estimatedSpendChange > 0 ? '+' : ''}
                {formatCurrency(request.impact.estimatedSpendChange)}
              </span>
            )}
          </div>
        </div>

        {/* Expand Icon */}
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {/* Changes */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Changes</h4>
            <div className="space-y-2">
              {request.changes.map((change, index) => (
                <div key={index} className="rounded-lg bg-white p-3 text-sm">
                  <div className="font-medium text-gray-900 mb-1">{change.displayLabel}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600">{String(change.currentValue)}</span>
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="font-medium text-blue-600">{String(change.newValue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reason */}
          {request.reason && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Reason</h4>
              <p className="text-sm text-gray-600">{request.reason}</p>
            </div>
          )}

          {/* Impact */}
          {request.impact && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Estimated Impact</h4>
              <div className="grid grid-cols-2 gap-3">
                {request.impact.estimatedSpendChange && (
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-gray-500">Spend Change</div>
                    <div className={`text-lg font-semibold ${request.impact.estimatedSpendChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {request.impact.estimatedSpendChange > 0 ? '+' : ''}
                      {formatCurrency(request.impact.estimatedSpendChange)}
                    </div>
                  </div>
                )}
                {request.impact.affectedEntities && (
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-gray-500">Affected Entities</div>
                    <div className="text-lg font-semibold text-gray-900">{request.impact.affectedEntities}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Review Info */}
          {request.reviewedBy && (
            <div className="mb-4 rounded-lg bg-white p-3">
              <div className="text-xs text-gray-500 mb-1">
                Reviewed by {request.reviewedBy.name} on {formatDate(request.reviewedAt!)}
              </div>
              {request.reviewComments && (
                <p className="text-sm text-gray-700 mt-2">{request.reviewComments}</p>
              )}
            </div>
          )}

          {/* Review Form */}
          {showReviewForm && (
            <div className="mb-4 rounded-lg bg-white p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {reviewAction === 'approve' ? 'Approve Request' : 'Reject Request'}
              </h4>
              <textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Add comments (optional)..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                rows={3}
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSubmitReview}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white ${
                    reviewAction === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Confirm {reviewAction === 'approve' ? 'Approval' : 'Rejection'}
                </button>
                <button
                  onClick={() => {
                    setShowReviewForm(false);
                    setReviewComments('');
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!showReviewForm && (
            <div className="flex gap-2">
              {canReview && onApprove && (
                <button
                  onClick={() => handleReview('approve')}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </button>
              )}
              {canReview && onReject && (
                <button
                  onClick={() => handleReview('reject')}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
              )}
              {canCancel && onCancel && (
                <button
                  onClick={() => onCancel(request.id)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel Request
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
