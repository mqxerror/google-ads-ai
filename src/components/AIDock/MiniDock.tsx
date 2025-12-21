/**
 * Mini AI Dock
 *
 * Always-visible floating bar at the bottom that shows:
 * - AI status/headline
 * - Quick access to AI Assistant
 * - Expands to full dock on click
 */

'use client';

import { useAIDock } from '@/contexts/AIDockContext';
import { SparklesIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

export function MiniDock() {
  const { mode, headline, openDock, closeDock, context } = useAIDock();

  // Don't show if in full mode (main dock is open)
  if (mode === 'full') return null;

  // Show mini dock if there's context or we're in mini mode
  const hasContext = !!context;
  if (mode === 'hidden' && !hasContext) return null;

  const handleExpand = () => {
    if (context) {
      openDock(context);
    } else {
      openDock({ trigger: 'manual' });
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 animate-slideUp">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full shadow-lg">
        {/* AI Icon */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <SparklesIcon className="w-4 h-4 text-white" />
        </div>

        {/* Headline */}
        <span className="text-sm font-medium text-gray-700 max-w-[200px] truncate">
          {headline || 'AI Assistant Ready'}
        </span>

        {/* Expand Button */}
        <button
          onClick={handleExpand}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
        >
          <ChevronUpIcon className="w-3.5 h-3.5" />
          Open
        </button>

        {/* Dismiss */}
        <button
          onClick={closeDock}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default MiniDock;
