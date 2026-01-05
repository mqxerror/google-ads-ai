'use client';

import { useState } from 'react';
import { Campaign } from '@/types/campaign';

interface AIPlaybooksProps {
  campaigns: Campaign[];
  onAction: (action: string, campaigns: Campaign[]) => void;
}

interface Playbook {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: 'danger' | 'success' | 'warning' | 'accent';
  savings?: number;
  campaigns: Campaign[];
  steps: string[];
}

export default function AIPlaybooks({ campaigns, onAction }: AIPlaybooksProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);

  // Generate playbooks from campaign data
  const generatePlaybooks = (): Playbook[] => {
    const playbooks: Playbook[] = [];

    // Wasters playbook
    const wasters = campaigns.filter(c => (c.aiScore ?? 0) < 40 && c.status === 'ENABLED');
    if (wasters.length > 0) {
      const potentialSavings = wasters.reduce((sum, c) => sum + (c.spend ?? 0), 0) * 0.3;
      playbooks.push({
        id: 'pause-wasters',
        title: `Pause ${wasters.length} Waster${wasters.length > 1 ? 's' : ''}`,
        description: `Save ~$${potentialSavings.toFixed(0)}/mo by pausing low-performing campaigns`,
        icon: '🛑',
        color: 'danger',
        savings: potentialSavings,
        campaigns: wasters,
        steps: [
          `Review ${wasters.length} campaigns with AI Score below 40`,
          'Pause campaigns to stop wasted spend',
          'Monitor for 7 days to confirm savings',
          'Reallocate budget to winners',
        ],
      });
    }

    // Winners playbook
    const winners = campaigns.filter(c => (c.aiScore ?? 0) >= 70 && c.status === 'ENABLED');
    if (winners.length > 0) {
      playbooks.push({
        id: 'boost-winners',
        title: `Boost ${winners.length} Winner${winners.length > 1 ? 's' : ''}`,
        description: 'Increase budget on high-performing campaigns for more conversions',
        icon: '🚀',
        color: 'success',
        campaigns: winners,
        steps: [
          `Identify ${winners.length} campaigns with AI Score 70+`,
          'Increase daily budget by 20%',
          'Monitor ROAS for 3 days',
          'Scale further if performance holds',
        ],
      });
    }

    // Needs attention playbook
    const needsAttention = campaigns.filter(c => (c.aiScore ?? 0) >= 40 && (c.aiScore ?? 0) < 70);
    if (needsAttention.length > 0) {
      playbooks.push({
        id: 'optimize-middle',
        title: `Optimize ${needsAttention.length} Campaign${needsAttention.length > 1 ? 's' : ''}`,
        description: 'Improve mid-tier campaigns with targeted optimizations',
        icon: '⚡',
        color: 'warning',
        campaigns: needsAttention,
        steps: [
          'Review ad copy for these campaigns',
          'Add negative keywords to reduce waste',
          'Test new headlines and descriptions',
          'Re-evaluate in 2 weeks',
        ],
      });
    }

    // Quick win playbook
    const quickWins = campaigns.filter(c => (c.ctr ?? 0) < 2 && c.status === 'ENABLED');
    if (quickWins.length > 0) {
      playbooks.push({
        id: 'improve-ctr',
        title: 'Improve Click-Through Rate',
        description: `${quickWins.length} campaigns have CTR below 2%`,
        icon: '📈',
        color: 'accent',
        campaigns: quickWins,
        steps: [
          'Analyze competitor ad copy',
          'Add emotional triggers to headlines',
          'Include specific numbers and offers',
          'A/B test new variations',
        ],
      });
    }

    return playbooks;
  };

  const playbooks = generatePlaybooks();

  const handleExecute = async (playbook: Playbook) => {
    setExecuting(playbook.id);
    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 1500));
    onAction(playbook.id, playbook.campaigns);
    setExecuting(null);
    setExpandedId(null);
  };

  const colorClasses = {
    danger: {
      bg: 'bg-danger/10',
      border: 'border-danger/20',
      text: 'text-danger',
      button: 'bg-danger hover:bg-danger/80',
    },
    success: {
      bg: 'bg-success/10',
      border: 'border-success/20',
      text: 'text-success',
      button: 'bg-success hover:bg-success/80',
    },
    warning: {
      bg: 'bg-warning/10',
      border: 'border-warning/20',
      text: 'text-warning',
      button: 'bg-warning hover:bg-warning/80',
    },
    accent: {
      bg: 'bg-accent/10',
      border: 'border-accent/20',
      text: 'text-accent',
      button: 'bg-accent hover:bg-accent/80',
    },
  };

  if (playbooks.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🎯</span>
        <h3 className="text-sm font-semibold text-text">AI Playbooks</h3>
        <span className="text-xs text-text3">Recommended actions</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {playbooks.map(playbook => {
          const colors = colorClasses[playbook.color];
          const isExpanded = expandedId === playbook.id;

          return (
            <div
              key={playbook.id}
              className={`card p-4 cursor-pointer transition-all ${colors.bg} border ${colors.border} ${
                isExpanded ? 'ring-2 ring-offset-2 ring-offset-background' : ''
              }`}
              style={{ ['--tw-ring-color' as string]: `var(--${playbook.color})` }}
              onClick={() => setExpandedId(isExpanded ? null : playbook.id)}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{playbook.icon}</span>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold text-sm ${colors.text}`}>{playbook.title}</h4>
                  <p className="text-xs text-text2 mt-0.5 line-clamp-2">{playbook.description}</p>

                  {playbook.savings && (
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-xs text-text3">Potential savings:</span>
                      <span className={`text-sm font-bold ${colors.text}`}>
                        ${playbook.savings.toFixed(0)}/mo
                      </span>
                      <span className="relative group">
                        <svg className="w-3.5 h-3.5 text-text3 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          Based on 30% of current spend on low-AI-score campaigns
                        </div>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded View */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-divider animate-fadeIn">
                  <div className="text-xs text-text3 mb-2">Steps:</div>
                  <ol className="space-y-2 mb-4">
                    {playbook.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-text2">
                        <span className={`w-4 h-4 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center flex-shrink-0 text-[10px] font-bold`}>
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>

                  <div className="text-xs text-text3 mb-2">
                    Campaigns: {playbook.campaigns.map(c => c.name).join(', ')}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExecute(playbook);
                    }}
                    disabled={executing === playbook.id}
                    className={`w-full py-2 rounded-lg text-white text-sm font-medium ${colors.button} transition-colors disabled:opacity-50`}
                  >
                    {executing === playbook.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Executing...
                      </span>
                    ) : (
                      'Execute Playbook'
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
