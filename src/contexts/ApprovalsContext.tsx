'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import {
  ApprovalRequest,
  ApprovalStatus,
  CreateApprovalRequest,
  ReviewApprovalRequest,
  ApprovalStats,
  getPriorityLevel,
} from '@/types/approvals';
import { usePermissions } from '@/contexts/PermissionsContext';

interface ApprovalsContextType {
  approvalRequests: ApprovalRequest[];
  pendingRequests: ApprovalRequest[];
  stats: ApprovalStats;
  isLoading: boolean;
  error: string | null;
  createApprovalRequest: (request: CreateApprovalRequest) => Promise<ApprovalRequest>;
  reviewApprovalRequest: (review: ReviewApprovalRequest) => Promise<void>;
  cancelApprovalRequest: (requestId: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
}

const ApprovalsContext = createContext<ApprovalsContextType | undefined>(undefined);

// Mock data for demo purposes
const MOCK_APPROVALS: ApprovalRequest[] = [
  {
    id: '1',
    changeType: 'budget_increase',
    entityType: 'campaign',
    entityId: '123',
    entityName: 'Summer Sale Campaign',
    requestedBy: {
      id: '2',
      name: 'Marketing Manager',
      email: 'manager@company.com',
    },
    requestedAt: new Date('2024-12-12T09:00:00'),
    status: 'pending',
    priority: 'high',
    changes: [
      {
        field: 'budget',
        currentValue: 1000,
        newValue: 2500,
        displayLabel: 'Daily Budget',
      },
    ],
    reason: 'Campaign is performing exceptionally well with 5.2 ROAS. Increasing budget to capitalize on high performance period.',
    impact: {
      estimatedSpendChange: 1500,
      estimatedImpactPercentage: 150,
      affectedEntities: 1,
    },
  },
  {
    id: '2',
    changeType: 'bulk_edit',
    entityType: 'keyword',
    requestedBy: {
      id: '3',
      name: 'Data Analyst',
      email: 'analyst@company.com',
    },
    requestedAt: new Date('2024-12-13T14:30:00'),
    status: 'pending',
    priority: 'medium',
    changes: [
      {
        field: 'status',
        currentValue: 'ENABLED',
        newValue: 'PAUSED',
        displayLabel: 'Status',
      },
    ],
    reason: 'Pausing 15 underperforming keywords with CPA > $75',
    impact: {
      estimatedSpendChange: -850,
      affectedEntities: 15,
    },
  },
  {
    id: '3',
    changeType: 'budget_decrease',
    entityType: 'campaign',
    entityId: '456',
    entityName: 'Brand Awareness Campaign',
    requestedBy: {
      id: '2',
      name: 'Marketing Manager',
      email: 'manager@company.com',
    },
    requestedAt: new Date('2024-12-11T16:00:00'),
    status: 'approved',
    priority: 'low',
    changes: [
      {
        field: 'budget',
        currentValue: 2000,
        newValue: 1200,
        displayLabel: 'Daily Budget',
      },
    ],
    reason: 'Reallocating budget to higher performing campaigns',
    impact: {
      estimatedSpendChange: -800,
      estimatedImpactPercentage: -40,
      affectedEntities: 1,
    },
    reviewedBy: {
      id: '1',
      name: 'Admin User',
      email: 'admin@company.com',
    },
    reviewedAt: new Date('2024-12-11T17:30:00'),
    reviewComments: 'Approved. Good reallocation strategy.',
  },
];

export function ApprovalsProvider({ children }: { children: ReactNode }) {
  const { currentUser, checks } = usePermissions();
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load approval requests on mount
  useEffect(() => {
    refreshRequests();
  }, []);

  const refreshRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // In real implementation, fetch from API
      await new Promise(resolve => setTimeout(resolve, 500));
      setApprovalRequests(MOCK_APPROVALS);
    } catch (err) {
      console.error('Failed to load approval requests:', err);
      setError('Failed to load approval requests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createApprovalRequest = useCallback(
    async (request: CreateApprovalRequest): Promise<ApprovalRequest> => {
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const priority = getPriorityLevel(request.changeType, request.impact);

      const newRequest: ApprovalRequest = {
        id: Date.now().toString(),
        ...request,
        requestedBy: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar,
        },
        requestedAt: new Date(),
        status: 'pending',
        priority,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      // In real implementation, call API
      await new Promise(resolve => setTimeout(resolve, 500));

      setApprovalRequests(prev => [newRequest, ...prev]);

      return newRequest;
    },
    [currentUser]
  );

  const reviewApprovalRequest = useCallback(
    async (review: ReviewApprovalRequest) => {
      if (!checks.canApprove()) {
        throw new Error('User does not have permission to review approvals');
      }

      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const request = approvalRequests.find(r => r.id === review.requestId);
      if (!request) {
        throw new Error('Approval request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Approval request has already been reviewed');
      }

      // In real implementation, call API
      await new Promise(resolve => setTimeout(resolve, 500));

      const updatedRequest: ApprovalRequest = {
        ...request,
        status: review.decision === 'approve' ? 'approved' : 'rejected',
        reviewedBy: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
        },
        reviewedAt: new Date(),
        reviewComments: review.comments,
      };

      setApprovalRequests(prev =>
        prev.map(r => (r.id === review.requestId ? updatedRequest : r))
      );
    },
    [approvalRequests, checks, currentUser]
  );

  const cancelApprovalRequest = useCallback(
    async (requestId: string) => {
      const request = approvalRequests.find(r => r.id === requestId);
      if (!request) {
        throw new Error('Approval request not found');
      }

      // Only the requester can cancel their own request
      if (request.requestedBy.id !== currentUser?.id && !checks.canApprove()) {
        throw new Error('You do not have permission to cancel this request');
      }

      if (request.status !== 'pending') {
        throw new Error('Only pending requests can be cancelled');
      }

      // In real implementation, call API
      await new Promise(resolve => setTimeout(resolve, 500));

      setApprovalRequests(prev =>
        prev.map(r => (r.id === requestId ? { ...r, status: 'cancelled' as ApprovalStatus } : r))
      );
    },
    [approvalRequests, checks, currentUser]
  );

  // Computed values
  const pendingRequests = approvalRequests.filter(r => r.status === 'pending');

  const stats: ApprovalStats = {
    total: approvalRequests.length,
    pending: approvalRequests.filter(r => r.status === 'pending').length,
    approved: approvalRequests.filter(r => r.status === 'approved').length,
    rejected: approvalRequests.filter(r => r.status === 'rejected').length,
    expired: approvalRequests.filter(
      r => r.expiresAt && r.expiresAt < new Date() && r.status === 'pending'
    ).length,
  };

  return (
    <ApprovalsContext.Provider
      value={{
        approvalRequests,
        pendingRequests,
        stats,
        isLoading,
        error,
        createApprovalRequest,
        reviewApprovalRequest,
        cancelApprovalRequest,
        refreshRequests,
      }}
    >
      {children}
    </ApprovalsContext.Provider>
  );
}

export function useApprovals() {
  const context = useContext(ApprovalsContext);
  if (context === undefined) {
    throw new Error('useApprovals must be used within an ApprovalsProvider');
  }
  return context;
}
