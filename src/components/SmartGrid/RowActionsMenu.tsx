'use client';

import { useState, useRef, useEffect } from 'react';
import { Campaign } from '@/types/campaign';

interface RowActionsMenuProps {
  campaign: Campaign;
  onViewDetails?: () => void;
  onManageBudget?: () => void;
  onToggleStatus?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onViewAdGroups?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
  dividerAfter?: boolean;
}

export default function RowActionsMenu({
  campaign,
  onViewDetails,
  onManageBudget,
  onToggleStatus,
  onDuplicate,
  onExport,
  onViewAdGroups,
}: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const menuItems: MenuItem[] = [
    {
      id: 'view-details',
      label: 'View Details',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      onClick: () => {
        onViewDetails?.();
        setIsOpen(false);
      },
    },
    {
      id: 'view-ad-groups',
      label: 'View Ad Groups',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      onClick: () => {
        onViewAdGroups?.();
        setIsOpen(false);
      },
    },
    {
      id: 'manage-budget',
      label: 'Manage Budget',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => {
        onManageBudget?.();
        setIsOpen(false);
      },
      dividerAfter: true,
    },
    {
      id: 'toggle-status',
      label: campaign.status === 'ENABLED' ? 'Pause Campaign' : 'Enable Campaign',
      icon: campaign.status === 'ENABLED' ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => {
        onToggleStatus?.();
        setIsOpen(false);
      },
      variant: campaign.status === 'ENABLED' ? 'default' : 'success',
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      onClick: () => {
        onDuplicate?.();
        setIsOpen(false);
      },
    },
    {
      id: 'export',
      label: 'Export',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
      onClick: () => {
        onExport?.();
        setIsOpen(false);
      },
    },
  ];

  const getVariantStyles = (variant?: MenuItem['variant']) => {
    switch (variant) {
      case 'danger':
        return 'text-rose-600 hover:bg-rose-50';
      case 'success':
        return 'text-emerald-600 hover:bg-emerald-50';
      default:
        return 'text-slate-700 hover:bg-slate-100';
    }
  };

  return (
    <div className="relative">
      {/* Kebab Button */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        aria-label="Actions menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {menuItems.map((item) => (
            <div key={item.id}>
              <button
                onClick={item.onClick}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${getVariantStyles(item.variant)}`}
              >
                {item.icon}
                {item.label}
              </button>
              {item.dividerAfter && (
                <div className="my-1 border-t border-slate-200" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
