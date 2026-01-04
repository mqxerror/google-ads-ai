'use client';

type DataSource = 'google_ads' | 'google_autocomplete' | 'google_trends' | 'google_search_console' | 'ollama' | 'embeddings' | 'rules' | 'dataforseo' | 'calculated' | 'cached';

interface DataSourceBadgeProps {
  source: DataSource;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const SOURCE_CONFIG: Record<DataSource, { icon: string; label: string; color: string; description: string }> = {
  google_ads: {
    icon: '🎯',
    label: 'Google Ads',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'From Google Ads Keyword Planner (FREE)',
  },
  google_autocomplete: {
    icon: '🔍',
    label: 'Autocomplete',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'From Google Autocomplete (FREE)',
  },
  google_trends: {
    icon: '📈',
    label: 'Trends',
    color: 'bg-green-100 text-green-700 border-green-200',
    description: 'From Google Trends (FREE)',
  },
  google_search_console: {
    icon: '📊',
    label: 'GSC',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    description: 'From Google Search Console (FREE)',
  },
  ollama: {
    icon: '🤖',
    label: 'Ollama',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    description: 'Local LLM classification (FREE)',
  },
  embeddings: {
    icon: '🧠',
    label: 'AI',
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    description: 'OpenAI Embeddings (~FREE)',
  },
  rules: {
    icon: '📋',
    label: 'Rules',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    description: 'Pattern matching (FREE)',
  },
  dataforseo: {
    icon: '🔒',
    label: 'DataForSEO',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    description: 'Premium data (Token required)',
  },
  calculated: {
    icon: '🧮',
    label: 'Calculated',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    description: 'Locally calculated (FREE)',
  },
  cached: {
    icon: '💾',
    label: 'Cached',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'From local cache',
  },
};

/**
 * DataSourceBadge - Shows where a metric comes from
 */
export default function DataSourceBadge({
  source,
  showLabel = false,
  size = 'sm',
  className = '',
}: DataSourceBadgeProps) {
  const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.calculated;

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <div className="relative group inline-block">
      <span
        className={`
          inline-flex items-center gap-1 rounded border font-medium
          ${config.color} ${sizeClasses} ${className}
        `}
      >
        <span>{config.icon}</span>
        {showLabel && <span>{config.label}</span>}
      </span>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
          {config.description}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
}

/**
 * DataSourcePanel - Shows all data sources being used
 */
export function DataSourcePanel({ sources }: { sources: DataSource[] }) {
  const uniqueSources = [...new Set(sources)];

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg border">
      <span className="text-sm text-gray-600 font-medium">Data Sources:</span>
      {uniqueSources.map((source) => (
        <DataSourceBadge key={source} source={source} showLabel size="md" />
      ))}
    </div>
  );
}

/**
 * Metric with source indicator
 */
export function MetricWithSource({
  value,
  source,
  format = 'number',
}: {
  value: number | string | null;
  source: DataSource;
  format?: 'number' | 'currency' | 'percent' | 'text';
}) {
  let displayValue = value;

  if (value === null || value === undefined) {
    displayValue = '-';
  } else if (format === 'number' && typeof value === 'number') {
    displayValue = value.toLocaleString();
  } else if (format === 'currency' && typeof value === 'number') {
    displayValue = `$${(value / 1000000).toFixed(2)}`;
  } else if (format === 'percent' && typeof value === 'number') {
    const sign = value > 0 ? '+' : '';
    displayValue = `${sign}${value}%`;
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-medium">{displayValue}</span>
      <DataSourceBadge source={source} size="sm" />
    </div>
  );
}
