'use client';

import { useState } from 'react';
import { useMode } from '@/contexts/ModeContext';

export default function ModeToggle() {
  const { mode, toggleMode, isSimpleMode, isProMode, isHydrated } = useMode();
  const [showTooltip, setShowTooltip] = useState(false);

  // Show a neutral placeholder during SSR/hydration to prevent mismatch
  if (!isHydrated) {
    return (
      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium">
          <div className="h-4 w-4 rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-10 rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-7 rounded-full bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={toggleMode}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
          isProMode
            ? 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100'
            : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
        }`}
        aria-label={`Current mode: ${mode}. Click to switch.`}
      >
        {/* Icon based on mode */}
        {isSimpleMode ? (
          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )}
        <span className={isSimpleMode ? 'text-emerald-700' : 'text-indigo-700'}>
          {isSimpleMode ? 'Simple' : 'Pro'}
        </span>
        {/* Toggle indicator */}
        <div className={`relative h-4 w-7 rounded-full transition-colors ${isProMode ? 'bg-indigo-400' : 'bg-emerald-400'}`}>
          <div
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${isProMode ? 'translate-x-3.5' : 'translate-x-0.5'}`}
          />
        </div>
      </button>

      {/* Feature Tooltip */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg bg-slate-900 p-3 text-xs text-white shadow-xl z-50">
          <div className="mb-2 font-semibold">
            {isSimpleMode ? 'Simple Mode' : 'Pro Mode'}
          </div>
          {isSimpleMode ? (
            <ul className="space-y-1 text-slate-300">
              <li className="flex items-center gap-1.5">
                <svg className="h-3 w-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                AI-powered recommendations
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="h-3 w-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Core metrics (Spend, Conv)
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="h-3 w-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Streamlined interface
              </li>
            </ul>
          ) : (
            <ul className="space-y-1 text-slate-300">
              <li className="flex items-center gap-1.5">
                <svg className="h-3 w-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                All metrics (CTR, CPA, Clicks)
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="h-3 w-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Trend indicators
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="h-3 w-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Advanced filtering
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="h-3 w-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Score breakdowns
              </li>
            </ul>
          )}
          <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400">
            Click to switch to {isSimpleMode ? 'Pro' : 'Simple'} mode
          </div>
          {/* Arrow */}
          <div className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 bg-slate-900" />
        </div>
      )}
    </div>
  );
}
