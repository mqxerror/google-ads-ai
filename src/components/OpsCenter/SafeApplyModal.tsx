'use client';

import { useState } from 'react';
import { Campaign } from '@/types/campaign';
import { CampaignIssue, RecommendedFix } from '@/types/health';

export type ApplyMode = 'direct' | 'draft' | 'scheduled' | 'experiment';

interface SafeApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: ApplyMode, options: ApplyOptions) => void;
  campaign: Campaign;
  issue: CampaignIssue;
  fix?: RecommendedFix;
  changes: ChangeItem[];
}

interface ApplyOptions {
  scheduledDate?: string;
  scheduledTime?: string;
  experimentName?: string;
  experimentBudgetPercent?: number;
  experimentDuration?: number;
}

export interface ChangeItem {
  field: string;
  currentValue: string | number;
  newValue: string | number;
  type: 'add' | 'remove' | 'modify';
}

const APPLY_MODES: { id: ApplyMode; label: string; description: string; icon: string; recommended?: boolean }[] = [
  {
    id: 'direct',
    label: 'Apply Now',
    description: 'Changes take effect immediately',
    icon: '⚡',
  },
  {
    id: 'draft',
    label: 'Save as Draft',
    description: 'Review and apply later from Ops Center',
    icon: '📝',
    recommended: true,
  },
  {
    id: 'scheduled',
    label: 'Schedule',
    description: 'Apply at a specific date and time',
    icon: '🕐',
  },
  {
    id: 'experiment',
    label: 'Run as Experiment',
    description: 'Test with portion of traffic first',
    icon: '🧪',
  },
];

export default function SafeApplyModal({
  isOpen,
  onClose,
  onConfirm,
  campaign,
  issue,
  changes,
}: SafeApplyModalProps) {
  const [selectedMode, setSelectedMode] = useState<ApplyMode>('draft');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [experimentName, setExperimentName] = useState(`${campaign.name} - Test`);
  const [experimentBudget, setExperimentBudget] = useState(30);
  const [experimentDuration, setExperimentDuration] = useState(14);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const options: ApplyOptions = {};

    if (selectedMode === 'scheduled') {
      options.scheduledDate = scheduledDate;
      options.scheduledTime = scheduledTime;
    } else if (selectedMode === 'experiment') {
      options.experimentName = experimentName;
      options.experimentBudgetPercent = experimentBudget;
      options.experimentDuration = experimentDuration;
    }

    onConfirm(selectedMode, options);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[var(--surface)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--divider)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[var(--text)]">
                Apply Fix
              </h2>
              <p className="text-[13px] text-[var(--text2)] mt-0.5">
                Choose how to apply this change
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface2)] text-[var(--text2)]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Changes Summary */}
          <div className="mb-5">
            <h3 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-2">
              Changes to Apply
            </h3>
            <div className="bg-[var(--surface2)] rounded-xl p-3 space-y-2">
              {changes.map((change, idx) => (
                <div key={idx} className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--text2)]">{change.field}</span>
                  <div className="flex items-center gap-2">
                    {change.type === 'modify' ? (
                      <>
                        <span className="text-[var(--text3)] line-through">{change.currentValue}</span>
                        <svg className="w-3 h-3 text-[var(--text3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="font-medium text-[var(--text)]">{change.newValue}</span>
                      </>
                    ) : change.type === 'add' ? (
                      <span className="text-[var(--success)] font-medium">+ {change.newValue}</span>
                    ) : (
                      <span className="text-[var(--danger)] font-medium line-through">{change.currentValue}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Apply Mode Selection */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-2">
              Apply Method
            </h3>
            {APPLY_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedMode === mode.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--divider)] hover:border-[var(--text3)] hover:bg-[var(--surface2)]'
                }`}
              >
                <span className="text-xl">{mode.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[14px] font-medium ${
                      selectedMode === mode.id ? 'text-[var(--accent)]' : 'text-[var(--text)]'
                    }`}>
                      {mode.label}
                    </span>
                    {mode.recommended && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--text3)]">{mode.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedMode === mode.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                    : 'border-[var(--divider)]'
                }`}>
                  {selectedMode === mode.id && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Conditional Options */}
          {selectedMode === 'scheduled' && (
            <div className="mt-4 p-4 bg-[var(--surface2)] rounded-xl space-y-3">
              <h4 className="text-[12px] font-medium text-[var(--text)]">Schedule Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--text3)] mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--divider)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text3)] mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--divider)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedMode === 'experiment' && (
            <div className="mt-4 p-4 bg-[var(--surface2)] rounded-xl space-y-3">
              <h4 className="text-[12px] font-medium text-[var(--text)]">Experiment Setup</h4>
              <div>
                <label className="block text-[11px] text-[var(--text3)] mb-1">Experiment Name</label>
                <input
                  type="text"
                  value={experimentName}
                  onChange={(e) => setExperimentName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--divider)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--text3)] mb-1">
                    Traffic Split ({experimentBudget}%)
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={50}
                    step={5}
                    value={experimentBudget}
                    onChange={(e) => setExperimentBudget(Number(e.target.value))}
                    className="w-full h-2 bg-[var(--surface3)] rounded-full appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text3)] mb-1">Duration (days)</label>
                  <select
                    value={experimentDuration}
                    onChange={(e) => setExperimentDuration(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--divider)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={21}>21 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--divider)] bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-10 px-4 bg-[var(--surface2)] text-[var(--text)] text-[14px] font-medium rounded-xl hover:bg-[var(--surface3)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedMode === 'scheduled' && !scheduledDate}
              className="flex-1 h-10 px-4 bg-[var(--accent)] text-white text-[14px] font-medium rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {selectedMode === 'direct' ? 'Apply Now' :
               selectedMode === 'draft' ? 'Save to Queue' :
               selectedMode === 'scheduled' ? 'Schedule' :
               'Start Experiment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
