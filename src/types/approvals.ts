export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type ApprovalChangeType =
  | 'budget_increase'
  | 'budget_decrease'
  | 'bid_change'
  | 'status_change'
  | 'campaign_create'
  | 'campaign_delete'
  | 'bulk_edit';

export interface ApprovalRequest {
  id: string;
  changeType: ApprovalChangeType;
  entityType: 'campaign' | 'adGroup' | 'keyword' | 'ad';
  entityId?: string;
  entityName?: string;
  requestedBy: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  requestedAt: Date;
  status: ApprovalStatus;
  priority: 'low' | 'medium' | 'high';

  // Change details
  changes: ApprovalChange[];

  // Justification
  reason?: string;
  impact?: {
    estimatedSpendChange?: number;
    estimatedImpactPercentage?: number;
    affectedEntities?: number;
  };

  // Approval details
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
  };
  reviewedAt?: Date;
  reviewComments?: string;

  // Metadata
  expiresAt?: Date;
  autoApproveThreshold?: number;
}

export interface ApprovalChange {
  field: string;
  currentValue: string | number | boolean;
  newValue: string | number | boolean;
  displayLabel: string;
}

export interface CreateApprovalRequest {
  changeType: ApprovalChangeType;
  entityType: ApprovalRequest['entityType'];
  entityId?: string;
  entityName?: string;
  changes: ApprovalChange[];
  reason?: string;
  impact?: ApprovalRequest['impact'];
}

export interface ReviewApprovalRequest {
  requestId: string;
  decision: 'approve' | 'reject';
  comments?: string;
}

export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
}

export interface ApprovalFilter {
  status?: ApprovalStatus[];
  changeType?: ApprovalChangeType[];
  priority?: ('low' | 'medium' | 'high')[];
  requestedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Approval threshold configurations
export interface ApprovalThreshold {
  changeType: ApprovalChangeType;
  threshold: number; // Dollar amount or percentage
  requiresApproval: boolean;
  autoApproveBelow?: boolean;
}

export const DEFAULT_APPROVAL_THRESHOLDS: ApprovalThreshold[] = [
  {
    changeType: 'budget_increase',
    threshold: 500, // Requires approval for increases > $500
    requiresApproval: true,
    autoApproveBelow: true,
  },
  {
    changeType: 'budget_decrease',
    threshold: 1000, // Requires approval for decreases > $1000
    requiresApproval: true,
    autoApproveBelow: false,
  },
  {
    changeType: 'campaign_delete',
    threshold: 0,
    requiresApproval: true,
    autoApproveBelow: false,
  },
  {
    changeType: 'bulk_edit',
    threshold: 10, // Requires approval for bulk changes affecting > 10 entities
    requiresApproval: true,
    autoApproveBelow: false,
  },
];

export function getPriorityLevel(
  changeType: ApprovalChangeType,
  impact?: ApprovalRequest['impact']
): 'low' | 'medium' | 'high' {
  // High priority for deletions and large budget changes
  if (changeType === 'campaign_delete') return 'high';

  if (impact?.estimatedSpendChange) {
    const absChange = Math.abs(impact.estimatedSpendChange);
    if (absChange > 5000) return 'high';
    if (absChange > 1000) return 'medium';
  }

  if (impact?.affectedEntities && impact.affectedEntities > 20) return 'high';
  if (impact?.affectedEntities && impact.affectedEntities > 5) return 'medium';

  return 'low';
}

export function requiresApproval(
  changeType: ApprovalChangeType,
  changeValue?: number,
  thresholds: ApprovalThreshold[] = DEFAULT_APPROVAL_THRESHOLDS
): boolean {
  const threshold = thresholds.find(t => t.changeType === changeType);

  if (!threshold) return false;
  if (!threshold.requiresApproval) return false;

  if (changeValue !== undefined && threshold.autoApproveBelow) {
    return Math.abs(changeValue) > threshold.threshold;
  }

  return true;
}
