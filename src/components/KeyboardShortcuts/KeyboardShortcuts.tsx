'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close dialogs / deselect' },
      { keys: ['⌘', '⇧', 'D'], description: 'Toggle dark mode' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'C'], description: 'Go to Campaigns' },
      { keys: ['G', 'R'], description: 'Go to Reports' },
      { keys: ['G', 'A'], description: 'Go to Automation' },
      { keys: ['G', 'T'], description: 'Go to Team' },
      { keys: ['G', 'P'], description: 'Go to Approvals' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['N', 'C'], description: 'New Campaign' },
      { keys: ['N', 'R'], description: 'New Rule' },
      { keys: ['⌘', 'S'], description: 'Save changes' },
      { keys: ['⌘', 'Z'], description: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
    ],
  },
  {
    title: 'Table Navigation',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navigate rows' },
      { keys: ['←', '→'], description: 'Navigate columns' },
      { keys: ['Space'], description: 'Select / deselect row' },
      { keys: ['⌘', 'A'], description: 'Select all' },
      { keys: ['Enter'], description: 'Open details' },
      { keys: ['Delete'], description: 'Delete selected' },
    ],
  },
  {
    title: 'Filters & Search',
    shortcuts: [
      { keys: ['/'], description: 'Focus search' },
      { keys: ['F'], description: 'Toggle filters panel' },
      { keys: ['⌘', 'F'], description: 'Find in page' },
      { keys: ['⌘', '⇧', 'F'], description: 'Advanced search' },
    ],
  },
];

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  // Close on escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Listen for custom event to open
  useEffect(() => {
    const handleShowShortcuts = () => {
      window.dispatchEvent(new CustomEvent('toggle-keyboard-shortcuts'));
    };

    window.addEventListener('show-keyboard-shortcuts', handleShowShortcuts);
    return () => window.removeEventListener('show-keyboard-shortcuts', handleShowShortcuts);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 z-[101] mx-auto my-auto max-w-4xl max-h-[85vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Keyboard Shortcuts
            </h2>
            <p className="text-sm text-gray-500">
              Speed up your workflow with these shortcuts
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {shortcutGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                    >
                      <span className="text-sm text-gray-700">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <kbd
                            key={keyIndex}
                            className="inline-flex min-w-[24px] items-center justify-center rounded bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-gray-300"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3">
          <p className="text-center text-xs text-gray-500">
            Press <kbd className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">?</kbd> anytime to show this dialog
          </p>
        </div>
      </div>
    </>
  );
}
