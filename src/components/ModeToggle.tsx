'use client';

import { useMode } from '@/contexts/ModeContext';

export default function ModeToggle() {
  const { mode, toggleMode, isSimpleMode, isProMode } = useMode();

  return (
    <button
      onClick={toggleMode}
      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
      title={isSimpleMode ? 'Switch to Pro Mode for advanced features' : 'Switch to Simple Mode for focused view'}
      aria-label={`Current mode: ${mode}. Click to switch.`}
    >
      <span className={`transition-colors ${isSimpleMode ? 'text-blue-600' : 'text-gray-400'}`}>
        Simple
      </span>
      <div className={`relative h-5 w-9 rounded-full transition-colors ${isProMode ? 'bg-blue-600' : 'bg-gray-200'}`}>
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isProMode ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </div>
      <span className={`transition-colors ${isProMode ? 'text-blue-600' : 'text-gray-400'}`}>
        Pro
      </span>
    </button>
  );
}
