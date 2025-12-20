/**
 * Sync Service
 *
 * Orchestrates data synchronization from Google Ads API to local DB cache.
 * Used by both manual sync and background job workers.
 */

import { prisma } from '@/lib/prisma';
import { EntityType, DataFreshness, SyncStatus } from '@prisma/client';
import { subDays, format, isToday, parseISO, differenceInDays } from 'date-fns';
import { metricsService } from './metrics-service';
import { entityHierarchyService } from './entity-hierarchy-service';

// Types
export interface SyncOptions {
  startDate?: string;    // YYYY-MM-DD
  endDate?: string;      // YYYY-MM-DD
  entityTypes?: EntityType[];
  forceRefresh?: boolean;
  includeToday?: boolean;
}

export interface SyncResult {
  success: boolean;
  entityType: EntityType;
  rowsWritten: number;
  rowsUpdated: number;
  duration: number;
  error?: string;
}

export interface SyncProgress {
  customerId: string;
  totalDays: number;
  completedDays: number;
  currentEntityType: EntityType;
  percentComplete: number;
  startedAt: Date;
  estimatedCompletion?: Date;
}

// Default sync configuration
const SYNC_CONFIG = {
  DEFAULT_BACKFILL_DAYS: 90,
  BATCH_SIZE_DAYS: 30,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
};

export class SyncService {
  /**
   * Sync metrics for an account
   */
  async syncAccount(
    accountId: string,
    customerId: string,
    refreshToken: string,
    options: SyncOptions = {}
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const entityTypes = options.entityTypes || [
      EntityType.CAMPAIGN,
      EntityType.AD_GROUP,
      EntityType.KEYWORD,
    ];

    // Calculate date range
    const endDate = options.endDate
      ? options.endDate
      : options.includeToday
        ? format(new Date(), 'yyyy-MM-dd')
        : format(subDays(new Date(), 1), 'yyyy-MM-dd');

    const startDate = options.startDate
      ? options.startDate
      : format(subDays(parseISO(endDate), SYNC_CONFIG.DEFAULT_BACKFILL_DAYS - 1), 'yyyy-MM-dd');

    // Mark sync as in progress
    for (const entityType of entityTypes) {
      await this.updateSyncStatus(accountId, customerId, entityType, SyncStatus.IN_PROGRESS);
    }

    try {
      // Sync each entity type
      for (const entityType of entityTypes) {
        const result = await this.syncEntityType(
          accountId,
          customerId,
          refreshToken,
          entityType,
          { startDate, endDate },
          options
        );
        results.push(result);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      // Mark failed
      for (const entityType of entityTypes) {
        await this.updateSyncStatus(
          accountId,
          customerId,
          entityType,
          SyncStatus.FAILED,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    return results;
  }

  /**
   * Sync a specific entity type for a date range
   */
  async syncEntityType(
    accountId: string,
    customerId: string,
    refreshToken: string,
    entityType: EntityType,
    dateRange: { startDate: string; endDate: string },
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let rowsWritten = 0;
    let rowsUpdated = 0;

    try {
      // This is where we would call the actual Google Ads API
      // For now, we just update the sync metadata
      // The actual GAQL calls will be integrated when we set up the background jobs

      const duration = Date.now() - startTime;

      // Update sync metadata
      await this.updateSyncStatus(accountId, customerId, entityType, SyncStatus.COMPLETED);

      return {
        success: true,
        entityType,
        rowsWritten,
        rowsUpdated,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.updateSyncStatus(accountId, customerId, entityType, SyncStatus.FAILED, errorMessage);

      return {
        success: false,
        entityType,
        rowsWritten,
        rowsUpdated,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Get sync status for an account
   */
  async getSyncStatus(customerId: string): Promise<{
    campaign: SyncStatus;
    adGroup: SyncStatus;
    keyword: SyncStatus;
    lastSync: Date | null;
    nextSync: Date | null;
  }> {
    const syncData = await prisma.syncMetadata.findMany({
      where: { customerId },
    });

    const getStatus = (type: EntityType): SyncStatus => {
      const meta = syncData.find(s => s.entityType === type);
      return meta?.lastSyncStatus || SyncStatus.PENDING;
    };

    const lastSync = syncData
      .map(s => s.lastSyncCompleted)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    return {
      campaign: getStatus(EntityType.CAMPAIGN),
      adGroup: getStatus(EntityType.AD_GROUP),
      keyword: getStatus(EntityType.KEYWORD),
      lastSync,
      nextSync: lastSync ? new Date(lastSync.getTime() + 15 * 60 * 1000) : null,
    };
  }

  /**
   * Check if account needs sync
   */
  async needsSync(customerId: string, options: { maxStaleMinutes?: number } = {}): Promise<boolean> {
    const maxStaleMinutes = options.maxStaleMinutes || 15;

    const syncData = await prisma.syncMetadata.findMany({
      where: { customerId },
    });

    if (syncData.length === 0) return true;

    const oldestSync = syncData
      .map(s => s.lastSyncCompleted)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    if (!oldestSync) return true;

    const minutesSinceSync = (Date.now() - oldestSync.getTime()) / (1000 * 60);
    return minutesSinceSync > maxStaleMinutes;
  }

  /**
   * Get backfill progress
   */
  async getBackfillProgress(customerId: string): Promise<{
    isBackfilling: boolean;
    progress: number;
    daysRemaining: number;
    estimatedCompletion: Date | null;
  }> {
    const syncData = await prisma.syncMetadata.findMany({
      where: { customerId },
    });

    const inProgress = syncData.filter(s => s.lastSyncStatus === SyncStatus.IN_PROGRESS);

    if (inProgress.length === 0) {
      return {
        isBackfilling: false,
        progress: 100,
        daysRemaining: 0,
        estimatedCompletion: null,
      };
    }

    const avgProgress = syncData.reduce((sum, s) => sum + Number(s.backfillProgress || 0), 0) / syncData.length;

    return {
      isBackfilling: true,
      progress: avgProgress,
      daysRemaining: Math.ceil((100 - avgProgress) / 10), // Rough estimate
      estimatedCompletion: new Date(Date.now() + (100 - avgProgress) * 60 * 1000), // Rough estimate
    };
  }

  /**
   * Cancel in-progress sync
   */
  async cancelSync(customerId: string): Promise<void> {
    await prisma.syncMetadata.updateMany({
      where: {
        customerId,
        lastSyncStatus: SyncStatus.IN_PROGRESS,
      },
      data: {
        lastSyncStatus: SyncStatus.FAILED,
        lastSyncError: 'Cancelled by user',
      },
    });
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private async updateSyncStatus(
    accountId: string,
    customerId: string,
    entityType: EntityType,
    status: SyncStatus,
    error?: string
  ): Promise<void> {
    await prisma.syncMetadata.upsert({
      where: {
        customerId_entityType: {
          customerId,
          entityType,
        },
      },
      create: {
        customerId,
        entityType,
        accountId,
        lastSyncStatus: status,
        lastSyncStarted: status === SyncStatus.IN_PROGRESS ? new Date() : undefined,
        lastSyncCompleted: status === SyncStatus.COMPLETED ? new Date() : undefined,
        lastSyncError: error,
      },
      update: {
        lastSyncStatus: status,
        lastSyncStarted: status === SyncStatus.IN_PROGRESS ? new Date() : undefined,
        lastSyncCompleted: status === SyncStatus.COMPLETED ? new Date() : undefined,
        lastSyncError: error,
      },
    });
  }
}

// Export singleton instance
export const syncService = new SyncService();
