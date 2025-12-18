'use client';

import { useState } from 'react';
import { Keyword } from '@/types/campaign';

interface MatchTypeSimulatorProps {
  keyword: Keyword;
  onApplyChange?: (keyword: Keyword, newMatchType: 'BROAD' | 'PHRASE' | 'EXACT') => void;
}

interface SimulationResult {
  matchType: 'BROAD' | 'PHRASE' | 'EXACT';
  volumeChange: string;
  cpaRisk: string;
  recommendation: 'expand' | 'maintain' | 'restrict';
  confidence: 'high' | 'medium' | 'low';
  details: string;
}

function simulateMatchTypeChange(keyword: Keyword, targetType: 'BROAD' | 'PHRASE' | 'EXACT'): SimulationResult {
  const currentType = keyword.matchType;

  // Simulate based on match type transitions
  if (currentType === targetType) {
    return {
      matchType: targetType,
      volumeChange: '0%',
      cpaRisk: 'No change',
      recommendation: 'maintain',
      confidence: 'high',
      details: 'Current match type',
    };
  }

  // Exact → Phrase
  if (currentType === 'EXACT' && targetType === 'PHRASE') {
    return {
      matchType: 'PHRASE',
      volumeChange: '+15-25%',
      cpaRisk: '+5-10%',
      recommendation: keyword.conversions > 5 ? 'expand' : 'maintain',
      confidence: 'medium',
      details: 'Captures close variants and word order variations',
    };
  }

  // Exact → Broad
  if (currentType === 'EXACT' && targetType === 'BROAD') {
    return {
      matchType: 'BROAD',
      volumeChange: '+40-60%',
      cpaRisk: '+15-30%',
      recommendation: keyword.conversions > 10 ? 'expand' : 'restrict',
      confidence: 'low',
      details: 'Maximum reach but requires strong negative list',
    };
  }

  // Phrase → Exact
  if (currentType === 'PHRASE' && targetType === 'EXACT') {
    return {
      matchType: 'EXACT',
      volumeChange: '-20-35%',
      cpaRisk: '-10-15%',
      recommendation: keyword.cpa > 50 ? 'restrict' : 'maintain',
      confidence: 'high',
      details: 'Tighter targeting, lower waste',
    };
  }

  // Phrase → Broad
  if (currentType === 'PHRASE' && targetType === 'BROAD') {
    return {
      matchType: 'BROAD',
      volumeChange: '+28-45%',
      cpaRisk: '+12-25%',
      recommendation: keyword.conversions > 8 ? 'expand' : 'maintain',
      confidence: 'medium',
      details: 'Broader reach, monitor search terms closely',
    };
  }

  // Broad → Phrase
  if (currentType === 'BROAD' && targetType === 'PHRASE') {
    return {
      matchType: 'PHRASE',
      volumeChange: '-25-40%',
      cpaRisk: '-15-20%',
      recommendation: keyword.cpa > 40 ? 'restrict' : 'maintain',
      confidence: 'medium',
      details: 'Reduces irrelevant matches',
    };
  }

  // Broad → Exact
  if (currentType === 'BROAD' && targetType === 'EXACT') {
    return {
      matchType: 'EXACT',
      volumeChange: '-45-60%',
      cpaRisk: '-20-35%',
      recommendation: keyword.cpa > 60 ? 'restrict' : 'maintain',
      confidence: 'high',
      details: 'Maximum precision, minimum waste',
    };
  }

  // Fallback
  return {
    matchType: targetType,
    volumeChange: '±10%',
    cpaRisk: '±5%',
    recommendation: 'maintain',
    confidence: 'low',
    details: 'Insufficient data for accurate prediction',
  };
}

export default function MatchTypeSimulator({ keyword, onApplyChange }: MatchTypeSimulatorProps) {
  const [selectedType, setSelectedType] = useState<'BROAD' | 'PHRASE' | 'EXACT'>(keyword.matchType);
  const [isExpanded, setIsExpanded] = useState(false);

  const matchTypes: Array<'BROAD' | 'PHRASE' | 'EXACT'> = ['BROAD', 'PHRASE', 'EXACT'];
  const simulations = matchTypes.map(type => simulateMatchTypeChange(keyword, type));

  const currentSimulation = simulations.find(s => s.matchType === selectedType);

  const matchTypeConfig = {
    BROAD: {
      label: 'Broad',
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      border: 'border-purple-200',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      ),
    },
    PHRASE: {
      label: 'Phrase',
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    EXACT: {
      label: 'Exact',
      bg: 'bg-emerald-100',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const recommendationConfig = {
    expand: { label: 'Expand', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    maintain: { label: 'Maintain', bg: 'bg-slate-100', text: 'text-slate-700' },
    restrict: { label: 'Restrict', bg: 'bg-amber-100', text: 'text-amber-700' },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="font-semibold text-gray-900">Match Type Simulator</span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${matchTypeConfig[keyword.matchType].bg} ${matchTypeConfig[keyword.matchType].text}`}>
            Current: {matchTypeConfig[keyword.matchType].label}
          </span>
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Match Type Selector */}
          <div className="flex gap-2">
            {matchTypes.map(type => {
              const config = matchTypeConfig[type];
              const isSelected = selectedType === type;
              const isCurrent = keyword.matchType === type;

              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                    isSelected
                      ? `${config.bg} ${config.border} ${config.text} ring-2 ring-offset-1 ${config.border.replace('border', 'ring')}`
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {config.icon}
                  <span className="font-medium text-sm">{config.label}</span>
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Simulation Results */}
          {currentSimulation && selectedType !== keyword.matchType && (
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  If changed to {matchTypeConfig[selectedType].label}:
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${recommendationConfig[currentSimulation.recommendation].bg} ${recommendationConfig[currentSimulation.recommendation].text}`}>
                  {recommendationConfig[currentSimulation.recommendation].label}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="text-xs text-gray-500">Volume Change</span>
                  </div>
                  <span className={`text-lg font-bold ${
                    currentSimulation.volumeChange.startsWith('+') ? 'text-emerald-600' :
                    currentSimulation.volumeChange.startsWith('-') ? 'text-rose-600' :
                    'text-gray-700'
                  }`}>
                    {currentSimulation.volumeChange}
                  </span>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-xs text-gray-500">CPA Risk</span>
                  </div>
                  <span className={`text-lg font-bold ${
                    currentSimulation.cpaRisk.startsWith('+') ? 'text-amber-600' :
                    currentSimulation.cpaRisk.startsWith('-') ? 'text-emerald-600' :
                    'text-gray-700'
                  }`}>
                    {currentSimulation.cpaRisk}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{currentSimulation.details}</span>
              </div>

              {/* Confidence */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Confidence:</span>
                <div className="flex gap-1">
                  {['high', 'medium', 'low'].map((level, i) => (
                    <div
                      key={level}
                      className={`w-8 h-1.5 rounded-full ${
                        (currentSimulation.confidence === 'high' && i <= 0) ||
                        (currentSimulation.confidence === 'medium' && i <= 1) ||
                        (currentSimulation.confidence === 'low' && i <= 2)
                          ? currentSimulation.confidence === 'high' ? 'bg-emerald-500' :
                            currentSimulation.confidence === 'medium' ? 'bg-amber-500' :
                            'bg-rose-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-xs font-medium ${
                  currentSimulation.confidence === 'high' ? 'text-emerald-600' :
                  currentSimulation.confidence === 'medium' ? 'text-amber-600' :
                  'text-rose-600'
                }`}>
                  {currentSimulation.confidence}
                </span>
              </div>

              {/* Apply Button */}
              {onApplyChange && (
                <button
                  onClick={() => onApplyChange(keyword, selectedType)}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Add to Action Queue
                </button>
              )}
            </div>
          )}

          {/* Current Match Type Info */}
          {selectedType === keyword.matchType && (
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Current match type</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Select a different match type to see projected impact</p>
            </div>
          )}

          {/* Historical Performance Hint */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs text-blue-700">
              Projections based on {keyword.conversions} conversions and ${keyword.spend.toFixed(0)} spend over 30 days
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
