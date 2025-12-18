'use client';

import { useUndoRedo } from '@/contexts/UndoRedoContext';

interface UndoRedoButtonsProps {
  showLabels?: boolean;
  size?: 'sm' | 'md';
}

export default function UndoRedoButtons({ showLabels = false, size = 'md' }: UndoRedoButtonsProps) {
  const { canUndo, canRedo, undo, redo, lastAction } = useUndoRedo();

  const buttonClass = size === 'sm'
    ? 'p-1.5 rounded'
    : 'p-2 rounded-lg';

  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className="flex items-center gap-1">
      {/* Undo Button */}
      <div className="group relative">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`${buttonClass} text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
          title={canUndo ? `Undo: ${lastAction?.description}` : 'Nothing to undo'}
        >
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </button>
        {/* Tooltip */}
        {canUndo && lastAction && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
            <div className="rounded bg-gray-900 px-2 py-1 text-xs text-white whitespace-nowrap">
              Undo: {lastAction.description}
              <span className="ml-2 text-gray-400">Cmd+Z</span>
            </div>
          </div>
        )}
      </div>

      {showLabels && <span className="text-xs text-gray-500">Undo</span>}

      {/* Redo Button */}
      <div className="group relative">
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`${buttonClass} text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
          title={canRedo ? 'Redo last action' : 'Nothing to redo'}
        >
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
            />
          </svg>
        </button>
        {/* Tooltip */}
        {canRedo && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
            <div className="rounded bg-gray-900 px-2 py-1 text-xs text-white whitespace-nowrap">
              Redo
              <span className="ml-2 text-gray-400">Cmd+Shift+Z</span>
            </div>
          </div>
        )}
      </div>

      {showLabels && <span className="text-xs text-gray-500">Redo</span>}
    </div>
  );
}
