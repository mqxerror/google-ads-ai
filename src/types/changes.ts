/**
 * What Changed Types
 *
 * Types for the daily workflow surface that shows:
 * - Budget/bid/target changes
 * - Major metric deltas
 * - Anomalies
 * - Each with actionable options
 */

export type ChangeCategory =
  | 'budget'
  | 'bidding'
  | 'status'
  | 'metric_spike'
  | 'metric_drop'
  | 'anomaly'
  | 'wasted_spend'
  | 'opportunity';

export type ChangeSeverity = 'info' | 'warning' | 'critical' | 'positive';

export type ChangeActionType =
  | 'queue_fix'
  | 'explain'
  | 'ignore'
  | 'revert'
  | 'apply_recommendation';

export interface ChangeItem {
  id: string;
  category: ChangeCategory;
  severity: ChangeSeverity;
  entityType: 'campaign' | 'adGroup' | 'keyword' | 'ad';
  entityId: string;
  entityName: string;

  // What changed
  title: string;
  description: string;

  // Before/after for config changes
  previousValue?: string | number;
  currentValue?: string | number;
  fieldName?: string;

  // For metric changes
  metric?: string;
  delta?: number; // Percentage change
  absoluteDelta?: number; // Absolute change
  previousMetricValue?: number;
  currentMetricValue?: number;

  // When it changed
  detectedAt: string;
  periodStart: string;
  periodEnd: string;
  comparePeriodStart?: string;
  comparePeriodEnd?: string;

  // Impact assessment
  estimatedImpact?: {
    metric: string;
    direction: 'positive' | 'negative' | 'neutral';
    magnitude: 'low' | 'medium' | 'high';
    value?: number;
  };

  // Available actions
  availableActions: ChangeAction[];

  // AI explanation (populated on demand)
  aiExplanation?: string;
  aiRecommendation?: string;

  // User state
  status: 'new' | 'acknowledged' | 'queued' | 'resolved' | 'ignored';
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface ChangeAction {
  type: ChangeActionType;
  label: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;

  // For queue_fix actions
  actionPayload?: {
    actionType: string;
    entityType: string;
    entityId: string;
    newValue: string | number;
  };
}

export interface ChangeSummary {
  totalChanges: number;
  byCategory: Record<ChangeCategory, number>;
  bySeverity: Record<ChangeSeverity, number>;
  criticalCount: number;
  warningCount: number;
  positiveCount: number;

  // Top impact items
  topImpactItems: ChangeItem[];

  // Comparison period info
  currentPeriod: { start: string; end: string };
  comparePeriod: { start: string; end: string };
}

export interface WhatChangedResponse {
  success: boolean;
  summary: ChangeSummary;
  changes: ChangeItem[];
  generatedAt: string;

  // Cache info
  cached: boolean;
  cacheAge?: number;
}

// Thresholds for detecting significant changes
export const CHANGE_THRESHOLDS = {
  // Metric changes (percentage)
  SPEND_SPIKE: 30, // 30% increase
  SPEND_DROP: 20, // 20% decrease
  CPA_SPIKE: 25, // 25% increase in CPA
  CPA_DROP: 15, // 15% decrease (positive)
  CONVERSION_DROP: 20, // 20% drop in conversions
  CONVERSION_SPIKE: 30, // 30% increase (positive)
  CTR_DROP: 15, // 15% drop in CTR
  ROAS_DROP: 20, // 20% drop in ROAS

  // Absolute minimums (ignore small changes)
  MIN_SPEND_FOR_ALERT: 50, // $50 minimum spend to trigger alerts
  MIN_CONVERSIONS_FOR_ALERT: 3, // At least 3 conversions to compare

  // Wasted spend
  WASTED_SPEND_THRESHOLD: 100, // $100+ spend with 0 conversions
};
