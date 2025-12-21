/**
 * Cache Cleanup API - Manages MetricsFact retention
 *
 * Uses entity-specific retention policies:
 * - Campaigns: 395 days (~13 months for YoY comparisons)
 * - Ad Groups: 395 days (~13 months for YoY comparisons)
 * - Keywords/Ads: 90 days (on-demand entities)
 *
 * POST /api/admin/cache/cleanup
 *   - action: 'preview' - shows what would be deleted
 *   - action: 'cleanup' - actually deletes old data
 *
 * GET /api/admin/cache/cleanup
 *   - Returns retention policy and current stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { EntityType } from '@prisma/client';
import {
  RETENTION_CAMPAIGNS_DAYS,
  RETENTION_ADGROUPS_DAYS,
  RETENTION_KEYWORDS_DAYS,
} from '@/lib/cache/hybrid-fetch';

// Entity-specific retention policies
const RETENTION_BY_ENTITY: Record<string, number> = {
  CAMPAIGN: RETENTION_CAMPAIGNS_DAYS,
  AD_GROUP: RETENTION_ADGROUPS_DAYS,
  KEYWORD: RETENTION_KEYWORDS_DAYS,
  AD: RETENTION_KEYWORDS_DAYS,
};

// Default retention for unknown entity types
const DEFAULT_RETENTION_DAYS = RETENTION_KEYWORDS_DAYS;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate entity-specific cutoff dates
    const now = new Date();
    const cutoffs: Record<string, Date> = {};
    for (const [entityType, days] of Object.entries(RETENTION_BY_ENTITY)) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      cutoffs[entityType] = cutoff;
    }

    // Get stats per entity type
    const entityTypes = ['CAMPAIGN', 'AD_GROUP', 'KEYWORD', 'AD'] as const;
    const entityStats: Record<string, { total: number; toDelete: number; retentionDays: number }> = {};

    for (const entityType of entityTypes) {
      const cutoff = cutoffs[entityType] || cutoffs['KEYWORD'];
      const [total, toDelete] = await Promise.all([
        prisma.metricsFact.count({
          where: { entityType: entityType as EntityType },
        }),
        prisma.metricsFact.count({
          where: {
            entityType: entityType as EntityType,
            syncedAt: { lt: cutoff },
          },
        }),
      ]);
      entityStats[entityType] = {
        total,
        toDelete,
        retentionDays: RETENTION_BY_ENTITY[entityType] || DEFAULT_RETENTION_DAYS,
      };
    }

    // Overall stats
    const [totalRows, oldestRecord, newestRecord] = await Promise.all([
      prisma.metricsFact.count(),
      prisma.metricsFact.findFirst({
        orderBy: { date: 'asc' },
        select: { date: true, syncedAt: true },
      }),
      prisma.metricsFact.findFirst({
        orderBy: { date: 'desc' },
        select: { date: true, syncedAt: true },
      }),
    ]);

    const totalToDelete = Object.values(entityStats).reduce((sum, s) => sum + s.toDelete, 0);

    return NextResponse.json({
      policy: {
        retentionByEntity: RETENTION_BY_ENTITY,
        defaultRetentionDays: DEFAULT_RETENTION_DAYS,
        note: 'Campaigns/AdGroups: 13 months for YoY. Keywords/Ads: 90 days.',
      },
      stats: {
        totalRows,
        rowsToDelete: totalToDelete,
        rowsToKeep: totalRows - totalToDelete,
        percentageToDelete: totalRows > 0 ? Math.round((totalToDelete / totalRows) * 100) : 0,
        oldestRecord: oldestRecord?.date?.toISOString() || null,
        newestRecord: newestRecord?.date?.toISOString() || null,
        oldestSync: oldestRecord?.syncedAt?.toISOString() || null,
        newestSync: newestRecord?.syncedAt?.toISOString() || null,
        byEntity: entityStats,
      },
    });
  } catch (error) {
    console.error('[CacheCleanup] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get retention stats', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // Calculate entity-specific cutoff dates
    const now = new Date();
    const cutoffs: Record<string, Date> = {};
    for (const [entityType, days] of Object.entries(RETENTION_BY_ENTITY)) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      cutoffs[entityType] = cutoff;
    }

    switch (action) {
      case 'preview': {
        // Count rows that would be deleted per entity type
        const entityTypes = ['CAMPAIGN', 'AD_GROUP', 'KEYWORD', 'AD'] as const;
        const breakdown: Record<string, { toDelete: number; retentionDays: number }> = {};
        let totalToDelete = 0;

        for (const entityType of entityTypes) {
          const cutoff = cutoffs[entityType] || cutoffs['KEYWORD'];
          const count = await prisma.metricsFact.count({
            where: {
              entityType: entityType as EntityType,
              syncedAt: { lt: cutoff },
            },
          });
          breakdown[entityType] = {
            toDelete: count,
            retentionDays: RETENTION_BY_ENTITY[entityType] || DEFAULT_RETENTION_DAYS,
          };
          totalToDelete += count;
        }

        return NextResponse.json({
          action: 'preview',
          retentionPolicy: RETENTION_BY_ENTITY,
          rowsToDelete: totalToDelete,
          breakdown,
          message: `Would delete ${totalToDelete.toLocaleString()} rows using entity-specific retention`,
        });
      }

      case 'cleanup': {
        // Delete old data per entity type with their respective retention policies
        const startTime = Date.now();
        const entityTypes = ['CAMPAIGN', 'AD_GROUP', 'KEYWORD', 'AD'] as const;
        const deletedByEntity: Record<string, number> = {};
        let totalDeleted = 0;

        for (const entityType of entityTypes) {
          const cutoff = cutoffs[entityType] || cutoffs['KEYWORD'];

          // Delete in batches
          let entityDeleted = 0;
          let batchCount = 0;
          const BATCH_SIZE = 10000;

          while (batchCount < 50) { // Max 50 batches per entity
            const result = await prisma.metricsFact.deleteMany({
              where: {
                entityType: entityType as EntityType,
                syncedAt: { lt: cutoff },
              },
            });

            entityDeleted += result.count;
            batchCount++;

            if (result.count < BATCH_SIZE) break;
          }

          deletedByEntity[entityType] = entityDeleted;
          totalDeleted += entityDeleted;
        }

        const duration = Date.now() - startTime;

        console.log(`[CacheCleanup] Deleted ${totalDeleted} rows in ${duration}ms`, deletedByEntity);

        return NextResponse.json({
          action: 'cleanup',
          success: true,
          retentionPolicy: RETENTION_BY_ENTITY,
          rowsDeleted: totalDeleted,
          deletedByEntity,
          durationMs: duration,
          message: `Deleted ${totalDeleted.toLocaleString()} rows using entity-specific retention`,
        });
      }

      case 'vacuum': {
        // Run VACUUM to reclaim space (PostgreSQL)
        try {
          await prisma.$executeRaw`VACUUM ANALYZE "MetricsFact"`;
          return NextResponse.json({
            action: 'vacuum',
            success: true,
            message: 'VACUUM ANALYZE completed on MetricsFact table',
          });
        } catch (err) {
          return NextResponse.json({
            action: 'vacuum',
            success: false,
            error: (err as Error).message,
            message: 'VACUUM failed - may require superuser permissions',
          });
        }
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: preview, cleanup, vacuum' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[CacheCleanup] POST error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: String(error) },
      { status: 500 }
    );
  }
}
