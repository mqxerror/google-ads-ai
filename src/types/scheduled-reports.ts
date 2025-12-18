export type ReportType =
  | 'performance'
  | 'campaign_summary'
  | 'keyword_performance'
  | 'ad_performance'
  | 'budget_pacing'
  | 'conversion_tracking'
  | 'quality_score';

export type ReportFrequency = 'daily' | 'weekly' | 'monthly';

export type ReportFormat = 'pdf' | 'csv' | 'excel';

export type DateRangeType =
  | 'yesterday'
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'last_month'
  | 'this_month'
  | 'last_quarter'
  | 'this_quarter'
  | 'custom';

export type ReportStatus = 'active' | 'paused' | 'error';

export interface ReportMetrics {
  spend?: boolean;
  clicks?: boolean;
  impressions?: boolean;
  conversions?: boolean;
  ctr?: boolean;
  cpa?: boolean;
  roas?: boolean;
  conversion_rate?: boolean;
  quality_score?: boolean;
  avg_position?: boolean;
}

export interface ScheduledReport {
  id: string;
  name: string;
  description?: string;
  accountId: string;
  type: ReportType;
  frequency: ReportFrequency;
  format: ReportFormat;
  dateRange: DateRangeType;
  customDateRange?: {
    startDate: string;
    endDate: string;
  };
  metrics: ReportMetrics;
  filters?: {
    campaignIds?: string[];
    adGroupIds?: string[];
    status?: ('ENABLED' | 'PAUSED')[];
  };
  recipients: string[]; // Email addresses
  status: ReportStatus;
  enabled: boolean;
  lastRun?: string; // ISO timestamp
  nextRun?: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
  history?: ReportExecution[];
}

export interface ReportExecution {
  id: string;
  reportId: string;
  executedAt: string;
  status: 'success' | 'failed';
  error?: string;
  fileUrl?: string; // URL to download the report
  fileSize?: number; // in bytes
  recordCount?: number; // Number of rows/records in report
}

export interface ReportTemplate {
  name: string;
  description: string;
  type: ReportType;
  frequency: ReportFrequency;
  format: ReportFormat;
  dateRange: DateRangeType;
  metrics: ReportMetrics;
}

// Predefined report templates
export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    name: 'Daily Performance Summary',
    description: 'Overview of all campaigns with key metrics from yesterday',
    type: 'performance',
    frequency: 'daily',
    format: 'pdf',
    dateRange: 'yesterday',
    metrics: {
      spend: true,
      clicks: true,
      impressions: true,
      conversions: true,
      ctr: true,
      cpa: true,
      roas: true,
    },
  },
  {
    name: 'Weekly Campaign Report',
    description: 'Detailed campaign performance for the last 7 days',
    type: 'campaign_summary',
    frequency: 'weekly',
    format: 'excel',
    dateRange: 'last_7_days',
    metrics: {
      spend: true,
      clicks: true,
      impressions: true,
      conversions: true,
      ctr: true,
      cpa: true,
      roas: true,
      conversion_rate: true,
    },
  },
  {
    name: 'Monthly Keyword Analysis',
    description: 'Keyword performance and quality scores for the past month',
    type: 'keyword_performance',
    frequency: 'monthly',
    format: 'csv',
    dateRange: 'last_month',
    metrics: {
      clicks: true,
      impressions: true,
      conversions: true,
      ctr: true,
      cpa: true,
      quality_score: true,
      avg_position: true,
    },
  },
  {
    name: 'Budget Pacing Report',
    description: 'Daily budget spend and pacing for all active campaigns',
    type: 'budget_pacing',
    frequency: 'daily',
    format: 'pdf',
    dateRange: 'this_month',
    metrics: {
      spend: true,
    },
  },
];

// Helper functions
export function getReportTypeLabel(type: ReportType): string {
  const labels: Record<ReportType, string> = {
    performance: 'Performance Overview',
    campaign_summary: 'Campaign Summary',
    keyword_performance: 'Keyword Performance',
    ad_performance: 'Ad Performance',
    budget_pacing: 'Budget Pacing',
    conversion_tracking: 'Conversion Tracking',
    quality_score: 'Quality Score Analysis',
  };
  return labels[type];
}

export function getFrequencyLabel(frequency: ReportFrequency): string {
  const labels: Record<ReportFrequency, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };
  return labels[frequency];
}

export function getFormatLabel(format: ReportFormat): string {
  const labels: Record<ReportFormat, string> = {
    pdf: 'PDF',
    csv: 'CSV',
    excel: 'Excel (XLSX)',
  };
  return labels[format];
}

export function getDateRangeLabel(dateRange: DateRangeType): string {
  const labels: Record<DateRangeType, string> = {
    yesterday: 'Yesterday',
    last_7_days: 'Last 7 days',
    last_14_days: 'Last 14 days',
    last_30_days: 'Last 30 days',
    last_month: 'Last month',
    this_month: 'This month',
    last_quarter: 'Last quarter',
    this_quarter: 'This quarter',
    custom: 'Custom range',
  };
  return labels[dateRange];
}

export function getMetricLabel(metric: keyof ReportMetrics): string {
  const labels: Record<keyof ReportMetrics, string> = {
    spend: 'Spend',
    clicks: 'Clicks',
    impressions: 'Impressions',
    conversions: 'Conversions',
    ctr: 'CTR',
    cpa: 'CPA',
    roas: 'ROAS',
    conversion_rate: 'Conversion Rate',
    quality_score: 'Quality Score',
    avg_position: 'Avg. Position',
  };
  return labels[metric];
}

export function getSelectedMetricsList(metrics: ReportMetrics): string[] {
  return Object.entries(metrics)
    .filter(([_, enabled]) => enabled)
    .map(([metric]) => getMetricLabel(metric as keyof ReportMetrics));
}

export function calculateNextRunDate(
  frequency: ReportFrequency,
  lastRun?: string
): Date {
  const now = new Date();
  const base = lastRun ? new Date(lastRun) : now;

  switch (frequency) {
    case 'daily':
      const daily = new Date(base);
      daily.setDate(daily.getDate() + 1);
      daily.setHours(8, 0, 0, 0); // 8 AM
      return daily;
    case 'weekly':
      const weekly = new Date(base);
      weekly.setDate(weekly.getDate() + 7);
      weekly.setHours(8, 0, 0, 0); // Monday 8 AM
      return weekly;
    case 'monthly':
      const monthly = new Date(base);
      monthly.setMonth(monthly.getMonth() + 1);
      monthly.setDate(1);
      monthly.setHours(8, 0, 0, 0); // 1st of month, 8 AM
      return monthly;
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

export function getDateRangeDates(dateRange: DateRangeType): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  let endDate = new Date(now);
  let startDate = new Date(now);

  switch (dateRange) {
    case 'yesterday':
      startDate.setDate(now.getDate() - 1);
      endDate.setDate(now.getDate() - 1);
      break;
    case 'last_7_days':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'last_14_days':
      startDate.setDate(now.getDate() - 14);
      break;
    case 'last_30_days':
      startDate.setDate(now.getDate() - 30);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate.setDate(0); // Last day of previous month
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_quarter': {
      const lastQuarterMonth = Math.floor((now.getMonth() - 3) / 3) * 3;
      startDate = new Date(now.getFullYear(), lastQuarterMonth, 1);
      endDate = new Date(now.getFullYear(), lastQuarterMonth + 3, 0);
      break;
    }
    case 'this_quarter': {
      const thisQuarterMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), thisQuarterMonth, 1);
      break;
    }
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
