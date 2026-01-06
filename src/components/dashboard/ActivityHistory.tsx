'use client';

import { useCampaignsStore, Activity } from '@/stores/campaigns-store';
import { useShallow } from 'zustand/react/shallow';
import { useMemo } from 'react';

const ACTIVITY_ICONS: Record<Activity['type'], { icon: string; color: string }> = {
  pause: { icon: '⏸️', color: 'bg-warning/10 text-warning' },
  enable: { icon: '▶️', color: 'bg-success/10 text-success' },
  budget_change: { icon: '💰', color: 'bg-accent/10 text-accent' },
  negative_keywords: { icon: '🚫', color: 'bg-danger/10 text-danger' },
  create: { icon: '✨', color: 'bg-accent/10 text-accent' },
  bulk_pause: { icon: '⏸️', color: 'bg-warning/10 text-warning' },
  bulk_enable: { icon: '▶️', color: 'bg-success/10 text-success' },
  sync: { icon: '🔄', color: 'bg-text3/10 text-text3' },
  scan: { icon: '🔍', color: 'bg-accent/10 text-accent' },
  alert: { icon: '⚠️', color: 'bg-warning/10 text-warning' },
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ActivityHistory() {
  const activities = useCampaignsStore(useShallow((state) => state.activities));
  const lastFetchedAt = useCampaignsStore((state) => state.lastFetchedAt);
  const campaigns = useCampaignsStore(useShallow((state) => state.campaigns));

  // Generate system activities based on state
  const systemActivities = useMemo((): Activity[] => {
    const sys: Activity[] = [];

    // Add last sync event
    if (lastFetchedAt) {
      sys.push({
        id: 'sys-sync',
        type: 'sync',
        description: `Synced ${campaigns.length} campaigns`,
        timestamp: lastFetchedAt,
        isSystem: true,
      });
    }

    // Add waste scan event (if wasters detected)
    const wasters = campaigns.filter(c => (c.aiScore ?? 100) < 40);
    if (wasters.length > 0 && lastFetchedAt) {
      sys.push({
        id: 'sys-scan',
        type: 'scan',
        description: `Detected ${wasters.length} underperforming campaign${wasters.length > 1 ? 's' : ''}`,
        timestamp: lastFetchedAt - 1000, // Slightly before sync
        isSystem: true,
        details: { wasterCount: wasters.length },
      });
    }

    return sys;
  }, [lastFetchedAt, campaigns]);

  // Combine user and system activities
  const allActivities = useMemo(() => {
    const combined = [...activities, ...systemActivities];
    return combined.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  }, [activities, systemActivities]);

  const userActivities = allActivities.filter(a => !a.isSystem);
  const recentSystemActivity = allActivities.find(a => a.isSystem);

  if (allActivities.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="font-semibold text-text mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-surface2 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-text3">No activity yet</p>
          <p className="text-xs text-text3 mt-1">Sync data to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text">Recent Activity</h3>
        <span className="text-xs text-text3">
          {userActivities.length > 0 ? `${userActivities.length} action${userActivities.length > 1 ? 's' : ''}` : 'System only'}
        </span>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {allActivities.map((activity) => {
          const config = ACTIVITY_ICONS[activity.type];

          return (
            <div
              key={activity.id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                activity.isSystem ? 'bg-surface2/30' : 'hover:bg-surface2'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                <span className="text-sm">{config.icon}</span>
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm ${activity.isSystem ? 'text-text3' : 'text-text'}`}>
                  {activity.description}
                </p>
                {activity.details?.keywords && (
                  <p className="text-xs text-text3 mt-1 truncate">
                    Keywords: {activity.details.keywords.slice(0, 3).join(', ')}
                    {activity.details.keywords.length > 3 && '...'}
                  </p>
                )}
                <p className="text-xs text-text3 mt-1">
                  {formatTimeAgo(activity.timestamp)}
                  {activity.isSystem && ' · system'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Last sync footer */}
      {lastFetchedAt && (
        <div className="mt-4 pt-3 border-t border-divider">
          <p className="text-xs text-text3 text-center">
            Last sync: {new Date(lastFetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
