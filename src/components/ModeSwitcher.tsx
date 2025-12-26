'use client';

interface ModeSwitcherProps {
  mode: 'monitor' | 'build';
  onModeChange: (mode: 'monitor' | 'build') => void;
}

export default function ModeSwitcher({ mode, onModeChange }: ModeSwitcherProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-surface2 rounded-xl">
      <button
        onClick={() => onModeChange('monitor')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          mode === 'monitor'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
            : 'text-text2 hover:text-text hover:bg-surface'
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Monitor
      </button>
      <button
        onClick={() => onModeChange('build')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          mode === 'build'
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
            : 'text-text2 hover:text-text hover:bg-surface'
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Build
      </button>
    </div>
  );
}

// Theme configuration for each mode
export const modeThemes = {
  monitor: {
    name: 'Monitor Mode',
    description: 'Track performance & optimize',
    accentColor: 'blue',
    headerBg: 'from-blue-900/20 to-transparent',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
  },
  build: {
    name: 'Build Mode',
    description: 'Create & configure campaigns',
    accentColor: 'purple',
    headerBg: 'from-purple-900/20 to-transparent',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
  },
};
