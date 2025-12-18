'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from '@/contexts/AccountContext';
import { parseCommand, mightBeNaturalLanguage, getSuggestions, ParsedCommand } from '@/lib/nlp/command-parser';

interface Command {
  id: string;
  name: string;
  description?: string;
  category: 'navigation' | 'action' | 'search' | 'settings';
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { accounts, setCurrentAccount } = useAccount();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Navigation icon
  const NavigationIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );

  // Action icon
  const ActionIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  // Settings icon
  const SettingsIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  // Search icon
  const SearchIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );

  // Define all available commands
  const commands: Command[] = useMemo(() => [
    // Navigation commands
    {
      id: 'nav-dashboard',
      name: 'Go to Dashboard',
      description: 'View your account overview',
      category: 'navigation',
      icon: <NavigationIcon />,
      shortcut: 'G D',
      action: () => { router.push('/dashboard'); onClose(); }
    },
    {
      id: 'nav-campaigns',
      name: 'Go to Campaigns',
      description: 'Manage your campaigns',
      category: 'navigation',
      icon: <NavigationIcon />,
      shortcut: 'G C',
      action: () => { router.push('/'); onClose(); }
    },
    {
      id: 'nav-reports',
      name: 'Go to Reports',
      description: 'View performance reports',
      category: 'navigation',
      icon: <NavigationIcon />,
      shortcut: 'G R',
      action: () => { router.push('/reports'); onClose(); }
    },
    {
      id: 'nav-automation',
      name: 'Go to Automation',
      description: 'Manage rules and scheduled tasks',
      category: 'navigation',
      icon: <NavigationIcon />,
      shortcut: 'G A',
      action: () => { router.push('/automation'); onClose(); }
    },
    {
      id: 'nav-team',
      name: 'Go to Team',
      description: 'Manage team members',
      category: 'navigation',
      icon: <NavigationIcon />,
      shortcut: 'G T',
      action: () => { router.push('/team'); onClose(); }
    },
    {
      id: 'nav-approvals',
      name: 'Go to Approvals',
      description: 'Review pending approvals',
      category: 'navigation',
      icon: <NavigationIcon />,
      shortcut: 'G P',
      action: () => { router.push('/approvals'); onClose(); }
    },
    {
      id: 'nav-activity',
      name: 'Go to Activity',
      description: 'View activity history',
      category: 'navigation',
      icon: <NavigationIcon />,
      action: () => { router.push('/activity'); onClose(); }
    },
    {
      id: 'nav-settings',
      name: 'Go to Settings',
      description: 'Configure application settings',
      category: 'navigation',
      icon: <NavigationIcon />,
      shortcut: 'G S',
      action: () => { router.push('/settings'); onClose(); }
    },
    // Action commands
    {
      id: 'action-new-campaign',
      name: 'Create New Campaign',
      description: 'Start a new campaign',
      category: 'action',
      icon: <ActionIcon />,
      shortcut: 'N C',
      action: () => { router.push('/?action=new-campaign'); onClose(); }
    },
    {
      id: 'action-new-rule',
      name: 'Create New Rule',
      description: 'Create an automated rule',
      category: 'action',
      icon: <ActionIcon />,
      shortcut: 'N R',
      action: () => { router.push('/automation?tab=rules&action=new'); onClose(); }
    },
    {
      id: 'action-schedule-report',
      name: 'Schedule New Report',
      description: 'Create a scheduled report',
      category: 'action',
      icon: <ActionIcon />,
      action: () => { router.push('/automation?tab=scheduled&action=new'); onClose(); }
    },
    {
      id: 'action-bulk-import',
      name: 'Bulk Import',
      description: 'Import campaigns from CSV',
      category: 'action',
      icon: <ActionIcon />,
      action: () => { router.push('/automation?tab=bulk'); onClose(); }
    },
    {
      id: 'action-invite-member',
      name: 'Invite Team Member',
      description: 'Add a new team member',
      category: 'action',
      icon: <ActionIcon />,
      action: () => { router.push('/team?action=invite'); onClose(); }
    },
    // Settings commands
    {
      id: 'settings-theme',
      name: 'Toggle Dark Mode',
      description: 'Switch between light and dark theme',
      category: 'settings',
      icon: <SettingsIcon />,
      shortcut: '⌘ ⇧ D',
      action: () => {
        document.documentElement.classList.toggle('dark');
        onClose();
      }
    },
    {
      id: 'settings-keyboard',
      name: 'View Keyboard Shortcuts',
      description: 'See all available shortcuts',
      category: 'settings',
      icon: <SettingsIcon />,
      shortcut: '?',
      action: () => {
        window.dispatchEvent(new CustomEvent('show-keyboard-shortcuts'));
        onClose();
      }
    },
    // Account switching
    ...accounts.map((account) => ({
      id: `account-${account.id}`,
      name: `Switch to ${account.accountName}`,
      description: `Account ID: ${account.id}`,
      category: 'search' as const,
      icon: <SearchIcon />,
      action: () => { setCurrentAccount(account); onClose(); }
    })),
  ], [router, onClose, accounts, setCurrentAccount]);

  // Check if query is natural language
  const isNaturalLanguage = useMemo(() => {
    return query.length > 5 && mightBeNaturalLanguage(query);
  }, [query]);

  // Parse natural language command
  const parsedNL = useMemo<ParsedCommand | null>(() => {
    if (!isNaturalLanguage) return null;
    return parseCommand(query);
  }, [query, isNaturalLanguage]);

  // Get NL suggestions when typing
  const nlSuggestions = useMemo(() => {
    if (query.length < 2 || isNaturalLanguage) return [];
    return getSuggestions(query);
  }, [query, isNaturalLanguage]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    // If it's natural language, still show some matching commands
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      cmd =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery) ||
        cmd.category.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Get flat list for keyboard navigation
  const flatCommands = useMemo(() => {
    return Object.values(groupedCommands).flat();
  }, [groupedCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < flatCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : flatCommands.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [flatCommands, selectedIndex, onClose]);

  // Global keyboard shortcut to open
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          window.dispatchEvent(new CustomEvent('open-command-palette'));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    action: 'Actions',
    search: 'Accounts',
    settings: 'Settings',
  };

  let currentIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed inset-x-4 top-[15%] z-[101] mx-auto max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        {/* Search Input */}
        <div className="flex items-center border-b border-gray-200 px-4">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-listbox"
            aria-activedescendant={flatCommands[selectedIndex] ? `cmd-${flatCommands[selectedIndex].id}` : undefined}
            aria-autocomplete="list"
            aria-label="Search commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, pages, accounts..."
            className="w-full border-0 bg-transparent px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
          />
          <kbd className="hidden rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 sm:block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-listbox"
          role="listbox"
          aria-label="Commands"
          className="max-h-[60vh] overflow-y-auto p-2"
        >
          {/* NL Understanding Panel */}
          {parsedNL && parsedNL.confidence > 0.5 && (
            <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 rounded-full bg-indigo-100 p-1.5">
                  <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-indigo-900">
                    {parsedNL.humanReadable}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                      {parsedNL.intent}
                    </span>
                    <span className="text-xs text-indigo-600">
                      {Math.round(parsedNL.confidence * 100)}% confidence
                    </span>
                  </div>
                  {parsedNL.needsClarification && parsedNL.clarificationQuestion && (
                    <p className="mt-2 text-xs text-indigo-700">
                      {parsedNL.clarificationQuestion}
                    </p>
                  )}
                </div>
                {parsedNL.suggestedAction && (
                  <button
                    onClick={() => {
                      // Execute the suggested action
                      console.log('Execute NL action:', parsedNL.suggestedAction);
                      onClose();
                    }}
                    className="flex-shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          )}

          {/* NL Suggestions */}
          {nlSuggestions.length > 0 && !parsedNL && (
            <div className="mb-3">
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Try asking
              </div>
              {nlSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(suggestion)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100"
                >
                  <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {flatCommands.length === 0 && !parsedNL ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No commands found for &quot;{query}&quot;
            </div>
          ) : flatCommands.length > 0 && (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category} role="group" aria-labelledby={`group-${category}`} className="mb-2">
                <div
                  id={`group-${category}`}
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400"
                >
                  {categoryLabels[category] || category}
                </div>
                {cmds.map((cmd) => {
                  const index = currentIndex++;
                  const isSelected = selectedIndex === index;
                  return (
                    <button
                      key={cmd.id}
                      id={`cmd-${cmd.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-index={index}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex-shrink-0 ${
                          isSelected ? 'text-blue-600' : 'text-gray-400'
                        }`}
                      >
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{cmd.name}</div>
                        {cmd.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd
                          aria-label={`Keyboard shortcut: ${cmd.shortcut}`}
                          className="flex-shrink-0 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500"
                        >
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-gray-100 px-1.5 py-0.5">↑↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-gray-100 px-1.5 py-0.5">↵</kbd>
              to select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-100 px-1.5 py-0.5">⌘</kbd>
            <kbd className="rounded bg-gray-100 px-1.5 py-0.5">K</kbd>
            to open
          </span>
        </div>
      </div>
    </>
  );
}
