/**
 * Metrics Service
 *
 * DB-first strategy for metrics retrieval:
 * 1. Check MetricsFact table for cached data
 * 2. If cache hit and fresh, return from DB
 * 3. If cache miss or stale, fall back to GAQL
 * 4. Background sync updates DB asynchronously
 */

import { prisma } from '@/lib/prisma';
import { EntityType, DataFreshness, SyncStatus, Prisma } from '@prisma/client';
import { subDays, format, isToday, parseISO } from 'date-fns';

// Types
export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface MetricsResponse<T> {
  data: T[];
  meta: {
    source: 'cache' | 'live';
    freshness: {
      lastSyncedAt: Date | null;
      dataAsOf: string;
      hasPartialData: boolean;
      staleDays: number;
    };
    validation?: {
      hierarchyValid: boolean;
      discrepancies?: string[];
    };
  };
}

export interface CampaignMetrics {
  customerId: string;
  campaignId: string;
  campaignName: string;
  status: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionsValue: number;
  ctr: number;
  averageCpc: number;
}

export interface AdGroupMetrics {
  customerId: string;
  campaignId: string;
  adGroupId: string;
  adGroupName: string;
  status: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionsValue: number;
  ctr: number;
  averageCpc: number;
}

export interface AggregatedMetrics {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionsValue: number;
  ctr: number;
  averageCpc: number;
}

// Cache freshness thresholds (in hours)
const FRESHNESS_THRESHOLDS = {
  FRESH: 1,        // Less than 1 hour old
  ACCEPTABLE: 4,   // Less than 4 hours old
  STALE: 24,       // More than 24 hours = stale
};

export class MetricsService {
  /**
   * Get campaign metrics from cache or fallback to GAQL
   */
  async getCampaignMetrics(
    accountId: string,
    customerId: string,
    dateRange: DateRange
  ): Promise<MetricsResponse<CampaignMetrics>> {
    // Check sync metadata for this entity type
    const syncMeta = await this.getSyncMetadata(customerId, EntityType.CAMPAIGN);

    // Try to get from cache
    const cachedData = await this.getCachedMetrics(
      customerId,
      EntityType.CAMPAIGN,
      dateRange
    );

    if (cachedData.length > 0 && this.isFresh(syncMeta)) {
      // Cache hit - return from DB
      return {
        data: this.formatCampaignMetrics(cachedData),
        meta: {
          source: 'cache',
          freshness: this.getFreshnessInfo(syncMeta, dateRange),
        },
      };
    }

    // Cache miss or stale - caller should use GAQL directly
    // and optionally trigger a background sync
    return {
      data: [],
      meta: {
        source: 'cache',
        freshness: this.getFreshnessInfo(syncMeta, dateRange),
      },
    };
  }

  /**
   * Get ad group metrics for a specific campaign
   */
  async getAdGroupMetrics(
    accountId: string,
    customerId: string,
    campaignId: string,
    dateRange: DateRange
  ): Promise<MetricsResponse<AdGroupMetrics>> {
    const syncMeta = await this.getSyncMetadata(customerId, EntityType.AD_GROUP);

    const cachedData = await this.getCachedMetrics(
      customerId,
      EntityType.AD_GROUP,
      dateRange,
      campaignId
    );

    if (cachedData.length > 0 && this.isFresh(syncMeta)) {
      return {
        data: this.formatAdGroupMetrics(cachedData),
        meta: {
          source: 'cache',
          freshness: this.getFreshnessInfo(syncMeta, dateRange),
        },
      };
    }

    return {
      data: [],
      meta: {
        source: 'cache',
        freshness: this.getFreshnessInfo(syncMeta, dateRange),
      },
    };
  }

  /**
   * Upsert metrics from GAQL response into cache
   */
  async cacheMetrics(
    accountId: string,
    customerId: string,
    entityType: EntityType,
    metrics: Array<{
      entityId: string;
      parentEntityId?: string;
      date: string;
      impressions: number;
      clicks: number;
      costMicros: bigint;
      conversions: number;
      conversionsValue: number;
    }>,
    options: {
      dataFreshness?: DataFreshness;
      currencyCode?: string;
    } = {}
  ): Promise<{ upserted: number; updated: number }> {
    const { dataFreshness = DataFreshness.FINAL, currencyCode = 'USD' } = options;

    let upserted = 0;
    let updated = 0;

    // Batch upsert for performance
    for (const metric of metrics) {
      const ctr = metric.impressions > 0
        ? (metric.clicks / metric.impressions)
        : 0;
      const averageCpc = metric.clicks > 0
        ? Number(metric.costMicros) / metric.clicks / 1_000_000
        : 0;

      try {
        const result = await prisma.metricsFact.upsert({
          where: {
            customerId_entityType_entityId_date: {
              customerId,
              entityType,
              entityId: metric.entityId,
              date: new Date(metric.date),
            },
          },
          create: {
            customerId,
            entityType,
            entityId: metric.entityId,
            parentEntityType: metric.parentEntityId ? this.getParentEntityType(entityType) : null,
            parentEntityId: metric.parentEntityId,
            date: new Date(metric.date),
            impressions: BigInt(metric.impressions),
            clicks: BigInt(metric.clicks),
            costMicros: metric.costMicros,
            conversions: new Prisma.Decimal(metric.conversions),
            conversionsValue: new Prisma.Decimal(metric.conversionsValue),
            ctr: new Prisma.Decimal(ctr),
            averageCpc: new Prisma.Decimal(averageCpc),
            currencyCode,
            accountId,
            dataFreshness,
          },
          update: {
            impressions: BigInt(metric.impressions),
            clicks: BigInt(metric.clicks),
            costMicros: metric.costMicros,
            conversions: new Prisma.Decimal(metric.conversions),
            conversionsValue: new Prisma.Decimal(metric.conversionsValue),
            ctr: new Prisma.Decimal(ctr),
            averageCpc: new Prisma.Decimal(averageCpc),
            dataFreshness,
            syncedAt: new Date(),
          },
        });

        upserted++;
      } catch (error) {
        console.error(`Failed to upsert metric for ${metric.entityId}:`, error);
      }
    }

    // Update sync metadata
    await this.updateSyncMetadata(accountId, customerId, entityType, {
      status: SyncStatus.COMPLETED,
      rowsWritten: upserted,
    });

    return { upserted, updated };
  }

  /**
   * Get aggregated metrics for a date range
   */
  async getAggregatedMetrics(
    customerId: string,
    entityType: EntityType,
    dateRange: DateRange,
    parentEntityId?: string
  ): Promise<AggregatedMetrics> {
    const where: Prisma.MetricsFactWhereInput = {
      customerId,
      entityType,
      date: {
        gte: new Date(dateRange.startDate),
        lte: new Date(dateRange.endDate),
      },
    };

    if (parentEntityId) {
      where.parentEntityId = parentEntityId;
    }

    const result = await prisma.metricsFact.aggregate({
      where,
      _sum: {
        impressions: true,
        clicks: true,
        costMicros: true,
        conversions: true,
        conversionsValue: true,
      },
    });

    const impressions = Number(result._sum.impressions || 0);
    const clicks = Number(result._sum.clicks || 0);
    const costMicros = Number(result._sum.costMicros || 0);
    const conversions = Number(result._sum.conversions || 0);
    const conversionsValue = Number(result._sum.conversionsValue || 0);

    return {
      impressions,
      clicks,
      cost: costMicros / 1_000_000,
      conversions,
      conversionsValue,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      averageCpc: clicks > 0 ? costMicros / clicks / 1_000_000 : 0,
    };
  }

  /**
   * Check if we have cached data for a date range
   */
  async hasCachedData(
    customerId: string,
    entityType: EntityType,
    dateRange: DateRange
  ): Promise<{ hasFull: boolean; missingDates: string[] }> {
    const startDate = parseISO(dateRange.startDate);
    const endDate = parseISO(dateRange.endDate);
    const dates: string[] = [];

    // Generate all dates in range
    let current = startDate;
    while (current <= endDate) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }

    // Check which dates have data
    const existingDates = await prisma.metricsFact.findMany({
      where: {
        customerId,
        entityType,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
      },
      distinct: ['date'],
    });

    const existingDateSet = new Set(
      existingDates.map(d => format(d.date, 'yyyy-MM-dd'))
    );

    const missingDates = dates.filter(d => !existingDateSet.has(d));

    return {
      hasFull: missingDates.length === 0,
      missingDates,
    };
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private async getCachedMetrics(
    customerId: string,
    entityType: EntityType,
    dateRange: DateRange,
    parentEntityId?: string
  ) {
    const where: Prisma.MetricsFactWhereInput = {
      customerId,
      entityType,
      date: {
        gte: new Date(dateRange.startDate),
        lte: new Date(dateRange.endDate),
      },
    };

    if (parentEntityId) {
      where.parentEntityId = parentEntityId;
    }

    return prisma.metricsFact.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  private async getSyncMetadata(customerId: string, entityType: EntityType) {
    return prisma.syncMetadata.findUnique({
      where: {
        customerId_entityType: {
          customerId,
          entityType,
        },
      },
    });
  }

  private async updateSyncMetadata(
    accountId: string,
    customerId: string,
    entityType: EntityType,
    update: {
      status: SyncStatus;
      rowsWritten?: number;
      error?: string;
    }
  ) {
    return prisma.syncMetadata.upsert({
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
        lastSyncStatus: update.status,
        lastSyncCompleted: new Date(),
        rowsWritten: update.rowsWritten || 0,
        lastSyncError: update.error,
      },
      update: {
        lastSyncStatus: update.status,
        lastSyncCompleted: new Date(),
        rowsWritten: update.rowsWritten || 0,
        lastSyncError: update.error,
      },
    });
  }

  private isFresh(syncMeta: { lastSyncCompleted: Date | null } | null): boolean {
    if (!syncMeta?.lastSyncCompleted) return false;

    const hoursSinceSync =
      (Date.now() - syncMeta.lastSyncCompleted.getTime()) / (1000 * 60 * 60);

    return hoursSinceSync < FRESHNESS_THRESHOLDS.ACCEPTABLE;
  }

  private getFreshnessInfo(
    syncMeta: { lastSyncCompleted: Date | null; lastSyncedDate: Date | null } | null,
    dateRange: DateRange
  ) {
    const hasPartialData = isToday(parseISO(dateRange.endDate));

    const staleDays = syncMeta?.lastSyncedDate
      ? Math.floor(
          (Date.now() - syncMeta.lastSyncedDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 999;

    return {
      lastSyncedAt: syncMeta?.lastSyncCompleted || null,
      dataAsOf: syncMeta?.lastSyncedDate
        ? format(syncMeta.lastSyncedDate, 'yyyy-MM-dd')
        : 'never',
      hasPartialData,
      staleDays,
    };
  }

  private getParentEntityType(entityType: EntityType): EntityType | null {
    switch (entityType) {
      case EntityType.AD_GROUP:
        return EntityType.CAMPAIGN;
      case EntityType.KEYWORD:
      case EntityType.AD:
        return EntityType.AD_GROUP;
      default:
        return null;
    }
  }

  private formatCampaignMetrics(facts: Prisma.MetricsFactGetPayload<{}>[]): CampaignMetrics[] {
    return facts.map(f => ({
      customerId: f.customerId,
      campaignId: f.entityId,
      campaignName: '', // Would need to join with EntityHierarchy
      status: '',       // Would need to join with EntityHierarchy
      date: format(f.date, 'yyyy-MM-dd'),
      impressions: Number(f.impressions),
      clicks: Number(f.clicks),
      cost: Number(f.costMicros) / 1_000_000,
      conversions: Number(f.conversions),
      conversionsValue: Number(f.conversionsValue),
      ctr: Number(f.ctr) * 100,
      averageCpc: Number(f.averageCpc),
    }));
  }

  private formatAdGroupMetrics(facts: Prisma.MetricsFactGetPayload<{}>[]): AdGroupMetrics[] {
    return facts.map(f => ({
      customerId: f.customerId,
      campaignId: f.parentEntityId || '',
      adGroupId: f.entityId,
      adGroupName: '', // Would need to join with EntityHierarchy
      status: '',      // Would need to join with EntityHierarchy
      date: format(f.date, 'yyyy-MM-dd'),
      impressions: Number(f.impressions),
      clicks: Number(f.clicks),
      cost: Number(f.costMicros) / 1_000_000,
      conversions: Number(f.conversions),
      conversionsValue: Number(f.conversionsValue),
      ctr: Number(f.ctr) * 100,
      averageCpc: Number(f.averageCpc),
    }));
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
