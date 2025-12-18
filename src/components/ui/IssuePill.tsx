'use client';

import { CampaignIssue } from '@/types/health';

interface IssuePillProps {
  issue: CampaignIssue;
  additionalCount?: number;
  onClick?: () => void;
}

export default function IssuePill({ issue, additionalCount, onClick }: IssuePillProps) {
  // Determine severity class
  const getSeverityClass = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  const severityClass = getSeverityClass(issue.severity);

  return (
    <button
      onClick={onClick}
      className={`issue-pill ${severityClass} cursor-pointer`}
    >
      <span>{issue.label || issue.category}</span>
      {additionalCount && additionalCount > 0 && (
        <span className="issue-count">+{additionalCount}</span>
      )}
    </button>
  );
}

// Simple text-only version for inline use
export function IssuePillSimple({
  label,
  severity = 'warning',
  count,
  onClick,
}: {
  label: string;
  severity?: 'critical' | 'warning' | 'info';
  count?: number;
  onClick?: () => void;
}) {
  const severityClass = severity === 'critical' ? 'danger' : severity;

  return (
    <button
      onClick={onClick}
      className={`issue-pill ${severityClass} cursor-pointer`}
    >
      <span>{label}</span>
      {count && count > 0 && (
        <span className="issue-count">+{count}</span>
      )}
    </button>
  );
}
