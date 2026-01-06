'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useCampaignsStore } from '@/stores/campaigns-store';
import { useShallow } from 'zustand/react/shallow';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface CommandPaletteProps {
  onClose?: () => void;
}

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const campaigns = useCampaignsStore(useShallow((state) => state.campaigns));
  const toggleCampaignStatus = useCampaignsStore((state) => state.toggleCampaignStatus);
  const pauseMultiple = useCampaignsStore((state) => state.pauseMultipleCampaigns);
  const wasterThreshold = useCampaignsStore((state) => state.wasterThreshold);

  // Toggle with Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (callback: () => void) => {
    callback();
    setOpen(false);
    onClose?.();
  };

  const wasters = campaigns.filter(c => (c.aiScore ?? 0) < wasterThreshold && c.status === 'ENABLED');
  const enabledCampaigns = campaigns.filter(c => c.status === 'ENABLED');

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Menu"
      className="fixed inset-0 z-50"
    >
      {/* Accessibility: Hidden title for screen readers */}
      <VisuallyHidden>
        <h2>Command Palette</h2>
      </VisuallyHidden>

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Dialog */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[560px] bg-surface rounded-2xl shadow-2xl border border-divider overflow-hidden">
        <Command className="flex flex-col">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-divider">
            <svg className="w-5 h-5 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Command.Input
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-text placeholder:text-text3 focus:outline-none text-base"
            />
            <kbd className="px-2 py-1 bg-surface2 rounded text-xs text-text3">esc</kbd>
          </div>

          {/* Commands list */}
          <Command.List className="max-h-[400px] overflow-auto p-2">
            <Command.Empty className="py-6 text-center text-text3 text-sm">
              No results found.
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className="mb-2">
              <div className="px-2 py-1 text-xs text-text3 uppercase tracking-wide">Quick Actions</div>

              {wasters.length > 0 && (
                <Command.Item
                  onSelect={() => handleSelect(() => pauseMultiple(wasters.map(w => w.id)))}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-surface2 data-[selected=true]:bg-surface2"
                >
                  <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text">Pause {wasters.length} Waster{wasters.length > 1 ? 's' : ''}</p>
                    <p className="text-xs text-text3">Save ~${wasters.reduce((s, w) => s + (w.spend ?? 0), 0).toLocaleString()}/mo</p>
                  </div>
                  <kbd className="px-1.5 py-0.5 bg-surface2 rounded text-xs text-text3">P</kbd>
                </Command.Item>
              )}

              <Command.Item
                onSelect={() => handleSelect(() => router.push('/campaigns/create'))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-surface2 data-[selected=true]:bg-surface2"
              >
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">Create Campaign</p>
                  <p className="text-xs text-text3">Start a new ad campaign</p>
                </div>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => router.push('/command'))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-surface2 data-[selected=true]:bg-surface2"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-sm">
                  🧠
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">Insight Hub</p>
                  <p className="text-xs text-text3">Ask AI about your campaigns</p>
                </div>
              </Command.Item>
            </Command.Group>

            {/* Navigation */}
            <Command.Group heading="Navigate" className="mb-2">
              <div className="px-2 py-1 text-xs text-text3 uppercase tracking-wide">Navigate</div>

              <Command.Item
                onSelect={() => handleSelect(() => router.push('/'))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-surface2 data-[selected=true]:bg-surface2"
              >
                <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-sm text-text">Dashboard</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => router.push('/spend-shield'))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-surface2 data-[selected=true]:bg-surface2"
              >
                <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-sm text-text">Spend Shield</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => router.push('/keyword-factory'))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-surface2 data-[selected=true]:bg-surface2"
              >
                <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span className="text-sm text-text">Keyword Factory</span>
              </Command.Item>
            </Command.Group>

            {/* Keyboard Shortcuts */}
            <Command.Group heading="Shortcuts" className="mb-2">
              <div className="px-2 py-1 text-xs text-text3 uppercase tracking-wide">Keyboard Shortcuts</div>

              <div className="px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-text3">Pause campaign</span>
                <kbd className="px-1.5 py-0.5 bg-surface2 rounded text-xs text-text3">P</kbd>
              </div>
              <div className="px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-text3">Edit budget</span>
                <kbd className="px-1.5 py-0.5 bg-surface2 rounded text-xs text-text3">B</kbd>
              </div>
              <div className="px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-text3">Clear selection</span>
                <kbd className="px-1.5 py-0.5 bg-surface2 rounded text-xs text-text3">Esc</kbd>
              </div>
              <div className="px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-text3">Command palette</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-surface2 rounded text-xs text-text3">⌘</kbd>
                  <kbd className="px-1.5 py-0.5 bg-surface2 rounded text-xs text-text3">K</kbd>
                </div>
              </div>
            </Command.Group>

            {/* Campaigns */}
            {enabledCampaigns.length > 0 && (
              <Command.Group heading="Campaigns" className="mb-2">
                <div className="px-2 py-1 text-xs text-text3 uppercase tracking-wide">Campaigns</div>
                {enabledCampaigns.slice(0, 5).map((campaign) => (
                  <Command.Item
                    key={campaign.id}
                    onSelect={() => handleSelect(() => toggleCampaignStatus(campaign.id))}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-surface2 data-[selected=true]:bg-surface2"
                  >
                    <span className={`w-2 h-2 rounded-full ${campaign.status === 'ENABLED' ? 'bg-success' : 'bg-text3'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{campaign.name}</p>
                      <p className="text-xs text-text3">{campaign.type} • Score: {campaign.aiScore ?? 0}</p>
                    </div>
                    <span className="text-xs text-text3">Pause</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-divider flex items-center justify-between text-xs text-text3">
            <span>Quick Ads AI</span>
            <div className="flex items-center gap-4">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>esc Close</span>
            </div>
          </div>
        </Command>
      </div>
    </Command.Dialog>
  );
}
