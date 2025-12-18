'use client';

import { useState, useRef, useEffect } from 'react';
import { Campaign } from '@/types/campaign';
import { CampaignHealth, RecommendedFix } from '@/types/health';
import { useActionQueue } from '@/contexts/ActionQueueContext';

interface QuickFixDropdownProps {
  campaign: Campaign;
  health?: CampaignHealth;
  onOpenFixDrawer?: (campaign: Campaign, issueId: string) => void;
}

interface QuickFixOption {
  id: string;
  label: string;
  description: string;
  count?: number;
  icon: 'negative' | 'bid' | 'budget' | 'pause' | 'create';
  confidence: 'high' | 'medium' | 'low';
  impact?: string;
}

function getQuickFixes(campaign: Campaign, health?: CampaignHealth): QuickFixOption[] {
  const fixes: QuickFixOption[] = [];

  // Check for wasted spend issues
  if (health?.issues?.some(i => i.category === 'wasted_spend')) {
    fixes.push({
      id: 'negatives',
      label: 'Add Negatives',
      description: 'Block non-converting queries',
      count: 14,
      icon: 'negative',
      confidence: 'high',
      impact: 'Save ~$450/mo',
    });
  }

  // Check for high CPA
  if (campaign.cpa > 60) {
    fixes.push({
      id: 'bid-strategy',
      label: 'Adjust Bid Strategy',
      description: 'Switch to Target CPA',
      icon: 'bid',
      confidence: 'medium',
      impact: 'CPA -15-25%',
    });
  }

  // Check for scaling opportunity
  if (campaign.aiScore >= 75 && campaign.roas > 2) {
    fixes.push({
      id: 'scale-budget',
      label: 'Scale Budget',
      description: 'Increase budget 20%',
      icon: 'budget',
      confidence: 'high',
      impact: '+8-12 conv/week',
    });
  }

  // Check for poor performance
  if (campaign.aiScore < 40) {
    fixes.push({
      id: 'pause',
      label: 'Pause Campaign',
      description: 'Stop wasting spend',
      icon: 'pause',
      confidence: 'medium',
      impact: 'Save $XXX/mo',
    });
  }

  // Always offer ad group optimization
  fixes.push({
    id: 'create-adgroup',
    label: 'Create Ad Group',
    description: 'From top search terms',
    icon: 'create',
    confidence: 'medium',
  });

  return fixes.slice(0, 4);
}

export default function QuickFixDropdown({ campaign, health, onOpenFixDrawer }: QuickFixDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addAction } = useActionQueue();

  const fixes = getQuickFixes(campaign, health);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const iconMap = {
    negative: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    bid: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    budget: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    pause: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    create: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  };

  const confidenceColors = {
    high: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  };

  const handleApplyFix = (fix: QuickFixOption) => {
    // Add to action queue
    addAction({
      actionType: fix.id === 'pause' ? 'pause_campaign' :
                  fix.id === 'scale-budget' ? 'update_budget' :
                  fix.id === 'bid-strategy' ? 'update_bid' : 'update_budget',
      entityType: 'campaign',
      entityId: campaign.id,
      entityName: campaign.name,
      currentValue: 'current',
      newValue: fix.label,
      reason: fix.description,
    });
    setIsOpen(false);
  };

  if (fixes.length === 0) return null;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Quick Fix
        {fixes.length > 0 && (
          <span className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-xs font-bold rounded-full">
            {fixes.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-semibold text-gray-900">Quick Fixes</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">AI-suggested optimizations for {campaign.name}</p>
          </div>

          {/* Fixes List */}
          <div className="p-2 space-y-1">
            {fixes.map((fix) => (
              <button
                key={fix.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyFix(fix);
                }}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  fix.icon === 'negative' ? 'bg-rose-100 text-rose-600' :
                  fix.icon === 'bid' ? 'bg-purple-100 text-purple-600' :
                  fix.icon === 'budget' ? 'bg-emerald-100 text-emerald-600' :
                  fix.icon === 'pause' ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {iconMap[fix.icon]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{fix.label}</span>
                    {fix.count && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                        {fix.count}
                      </span>
                    )}
                    <span className={`ml-auto px-1.5 py-0.5 text-xs font-medium rounded ${confidenceColors[fix.confidence]}`}>
                      {fix.confidence}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{fix.description}</p>
                  {fix.impact && (
                    <p className="text-xs font-medium text-emerald-600 mt-1">{fix.impact}</p>
                  )}
                </div>
                <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mt-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenFixDrawer?.(campaign, health?.issues?.[0]?.id || '');
                setIsOpen(false);
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View All Fixes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
