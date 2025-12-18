'use client';

import { CampaignIssue, ISSUE_CATEGORY_META, IssueSeverity } from '@/types/health';

interface IssueChipsProps {
  issues: CampaignIssue[];
  maxVisible?: number;
  onIssueClick?: (issue: CampaignIssue) => void;
  size?: 'sm' | 'md';
}

// Icons for each issue category
const CategoryIcons: Record<string, React.FC<{ className?: string }>> = {
  'chart-bar': ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  'currency-dollar': ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'trash': ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  'arrow-trending-down': ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  ),
  'arrow-trending-up': ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  'cursor-arrow-rays': ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  ),
  'star': ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  'user-group': ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  'adjustments-horizontal': ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  'document-text': ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

// Fallback icon
const DefaultIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Severity indicator dot
function SeverityDot({ severity }: { severity: IssueSeverity }) {
  const colors = {
    critical: 'bg-rose-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };
  return <span className={`h-1.5 w-1.5 rounded-full ${colors[severity]}`} />;
}

export default function IssueChips({
  issues,
  maxVisible = 2,
  onIssueClick,
  size = 'md',
}: IssueChipsProps) {
  if (!issues || issues.length === 0) {
    return (
      <span className="text-xs text-slate-400 italic">
        No issues
      </span>
    );
  }

  // Sort by severity (critical first) then by impact
  const sortedIssues = [...issues].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.impactValue - a.impactValue;
  });

  const visibleIssues = sortedIssues.slice(0, maxVisible);
  const remainingCount = sortedIssues.length - maxVisible;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5',
  };

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
  };

  // Get color classes for chip based on severity
  const getChipColors = (severity: IssueSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          base: 'bg-rose-50 text-rose-700 border-rose-200',
          hover: 'hover:bg-rose-100 hover:border-rose-300',
        };
      case 'warning':
        return {
          base: 'bg-amber-50 text-amber-700 border-amber-200',
          hover: 'hover:bg-amber-100 hover:border-amber-300',
        };
      case 'info':
        return {
          base: 'bg-blue-50 text-blue-700 border-blue-200',
          hover: 'hover:bg-blue-100 hover:border-blue-300',
        };
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleIssues.map((issue) => {
        const meta = ISSUE_CATEGORY_META[issue.category];
        const IconComponent = CategoryIcons[meta?.icon] || DefaultIcon;
        const colors = getChipColors(issue.severity);

        return (
          <button
            key={issue.id}
            onClick={(e) => {
              e.stopPropagation();
              onIssueClick?.(issue);
            }}
            className={`
              inline-flex items-center rounded-md border font-medium
              transition-colors cursor-pointer
              ${sizeClasses[size]}
              ${colors.base}
              ${onIssueClick ? colors.hover : ''}
            `}
            title={issue.summary}
          >
            <IconComponent className={iconSizes[size]} />
            <span className="truncate max-w-[80px]">{issue.label}</span>
            {issue.impactEstimate && (
              <span className="opacity-60 text-[10px] ml-0.5 hidden sm:inline">
                {issue.impactEstimate}
              </span>
            )}
          </button>
        );
      })}

      {/* "+N more" badge */}
      {remainingCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Could trigger showing all issues in drawer
            onIssueClick?.(sortedIssues[0]);
          }}
          className={`
            inline-flex items-center rounded-md border font-medium
            bg-slate-50 text-slate-600 border-slate-200

            hover:bg-slate-100
            transition-colors cursor-pointer
            ${sizeClasses[size]}
          `}
        >
          +{remainingCount}
        </button>
      )}
    </div>
  );
}

// Single issue chip for inline use
export function IssueChip({
  issue,
  onClick,
  size = 'md',
  showImpact = false,
}: {
  issue: CampaignIssue;
  onClick?: (issue: CampaignIssue) => void;
  size?: 'sm' | 'md';
  showImpact?: boolean;
}) {
  const meta = ISSUE_CATEGORY_META[issue.category];
  const IconComponent = CategoryIcons[meta?.icon] || DefaultIcon;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5',
  };

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
  };

  const getChipColors = (severity: IssueSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          base: 'bg-rose-50 text-rose-700 border-rose-200',
          hover: 'hover:bg-rose-100 hover:border-rose-300',
        };
      case 'warning':
        return {
          base: 'bg-amber-50 text-amber-700 border-amber-200',
          hover: 'hover:bg-amber-100 hover:border-amber-300',
        };
      case 'info':
        return {
          base: 'bg-blue-50 text-blue-700 border-blue-200',
          hover: 'hover:bg-blue-100 hover:border-blue-300',
        };
    }
  };

  const colors = getChipColors(issue.severity);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(issue);
      }}
      className={`
        inline-flex items-center rounded-md border font-medium
        transition-colors cursor-pointer
        ${sizeClasses[size]}
        ${colors.base}
        ${onClick ? colors.hover : ''}
      `}
      title={issue.summary}
    >
      <SeverityDot severity={issue.severity} />
      <IconComponent className={iconSizes[size]} />
      <span>{issue.label}</span>
      {showImpact && issue.impactEstimate && (
        <span className="opacity-70 ml-1">• {issue.impactEstimate}</span>
      )}
    </button>
  );
}

// Summary badge showing issue counts
export function IssueSummary({
  issues,
  onClick,
}: {
  issues: CampaignIssue[];
  onClick?: () => void;
}) {
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  if (issues.length === 0) {
    return (
      <span className="text-xs text-slate-400">
        No issues
      </span>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="inline-flex items-center gap-2 text-xs hover:underline cursor-pointer"
    >
      {criticalCount > 0 && (
        <span className="flex items-center gap-0.5 text-rose-600">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          {criticalCount}
        </span>
      )}
      {warningCount > 0 && (
        <span className="flex items-center gap-0.5 text-amber-600">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {warningCount}
        </span>
      )}
      {infoCount > 0 && (
        <span className="flex items-center gap-0.5 text-blue-600">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          {infoCount}
        </span>
      )}
    </button>
  );
}
