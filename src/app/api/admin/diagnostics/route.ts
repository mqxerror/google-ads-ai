/**
 * Diagnostics API - Comprehensive system health for debugging
 *
 * GET /api/admin/diagnostics - Full diagnostic report
 * POST /api/admin/diagnostics - Test specific components (redis, db)
 *
 * Returns actual database stats, Redis health, queue status
 */

// Force Node.js runtime (not Edge) for Prisma compatibility
// This fixes PrismaClientInitializationError with Turbopack
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { EntityType } from '@prisma/client';
import { isRedisAvailable, getRedisStatus, REDIS_CONFIG, getWorkerHeartbeat } from '@/lib/queue/redis';
import { isQueueReady, getQueueStats, getRecentJobs as getQueueJobs, initRefreshQueue } from '@/lib/queue';
import {
  getMetrics,
  getLockStatus,
  CACHE_TTL,
} from '@/lib/refresh-lock';
import { validateCampaignHierarchy, HierarchyValidationResult, getMismatchHistory } from '@/lib/validation/hierarchy-validation';
import { analyzeDateRange, DateRangeAnalysis } from '@/lib/cache/date-range-analyzer';
import {
  RETENTION_CAMPAIGNS_DAYS,
  RETENTION_ADGROUPS_DAYS,
  RETENTION_KEYWORDS_DAYS,
  MAX_INLINE_MISSING_DAYS,
  MAX_INLINE_CHUNKS,
} from '@/lib/cache/hybrid-fetch';
import { getAllFlags } from '@/lib/feature-flags';

// No admin check needed for diagnostics - read-only, useful for debugging
// But we still require authentication

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // ======================================
    // 1. Redis Health Check
    // ======================================
    let redisHealth: {
      available: boolean;
      status: string;
      host: string;
      port: number;
      error?: string;
    };

    try {
      const available = await isRedisAvailable();
      redisHealth = {
        available,
        status: getRedisStatus(),
        host: REDIS_CONFIG.host,
        port: REDIS_CONFIG.port,
      };
    } catch (err) {
      redisHealth = {
        available: false,
        status: 'error',
        host: REDIS_CONFIG.host,
        port: REDIS_CONFIG.port,
        error: (err as Error).message,
      };
    }

    // ======================================
    // 2. Queue Health Check
    // ======================================
    let queueHealth: {
      ready: boolean;
      stats: Awaited<ReturnType<typeof getQueueStats>> | null;
    } = { ready: false, stats: null };

    if (redisHealth.available) {
      try {
        // Auto-initialize queue if Redis is available
        if (!isQueueReady()) {
          await initRefreshQueue();
        }
        queueHealth = {
          ready: isQueueReady(),
          stats: await getQueueStats(),
        };
      } catch (err) {
        console.error('[Diagnostics] Queue stats error:', err);
      }
    }

    // ======================================
    // 2b. Worker Heartbeat
    // ======================================
    let workerHeartbeat: {
      workerId: string;
      lastSeen: string;
      jobsProcessed: number;
      status: 'active' | 'stale' | 'dead';
      ageSeconds: number;
    } | null = null;

    if (redisHealth.available) {
      try {
        workerHeartbeat = await getWorkerHeartbeat();
      } catch (err) {
        console.error('[Diagnostics] Worker heartbeat error:', err);
      }
    }

    // ======================================
    // 3. Database Cache Stats
    // ======================================
    let dbCacheStats: {
      totalRows: number;
      customerIds: number;
      oldestSync: string | null;
      newestSync: string | null;
      byEntityType: Record<string, number>;
      forCurrentQuery?: {
        rows: number;
        oldestDate: string | null;
        newestDate: string | null;
        lastSyncedAt: string | null;
        totalCostMicros: string;
      };
    } | null = null;
    let dbError: string | null = null;

    try {
      // Overall cache stats
      const [totalRows, distinctCustomers, oldestRow, newestRow] = await Promise.all([
        prisma.metricsFact.count(),
        prisma.metricsFact.groupBy({
          by: ['customerId'],
          _count: true,
        }),
        prisma.metricsFact.findFirst({
          orderBy: { syncedAt: 'asc' },
          select: { syncedAt: true },
        }),
        prisma.metricsFact.findFirst({
          orderBy: { syncedAt: 'desc' },
          select: { syncedAt: true },
        }),
      ]);

      // Count by entity type
      const byType = await prisma.metricsFact.groupBy({
        by: ['entityType'],
        _count: true,
      });
      const byEntityType: Record<string, number> = {};
      for (const row of byType) {
        byEntityType[row.entityType] = row._count;
      }

      dbCacheStats = {
        totalRows,
        customerIds: distinctCustomers.length,
        oldestSync: oldestRow?.syncedAt?.toISOString() || null,
        newestSync: newestRow?.syncedAt?.toISOString() || null,
        byEntityType,
      };

      // If customerId provided, get stats for that query
      if (customerId) {
        const whereClause: {
          customerId: string;
          entityType: EntityType;
          date?: { gte: Date; lte: Date };
        } = {
          customerId,
          entityType: EntityType.CAMPAIGN,
        };

        if (startDate && endDate) {
          whereClause.date = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        }

        const [queryRows, queryOldest, queryNewest, queryLastSync, querySum] = await Promise.all([
          prisma.metricsFact.count({ where: whereClause }),
          prisma.metricsFact.findFirst({
            where: whereClause,
            orderBy: { date: 'asc' },
            select: { date: true },
          }),
          prisma.metricsFact.findFirst({
            where: whereClause,
            orderBy: { date: 'desc' },
            select: { date: true },
          }),
          prisma.metricsFact.findFirst({
            where: whereClause,
            orderBy: { syncedAt: 'desc' },
            select: { syncedAt: true },
          }),
          prisma.metricsFact.aggregate({
            where: whereClause,
            _sum: { costMicros: true },
          }),
        ]);

        dbCacheStats.forCurrentQuery = {
          rows: queryRows,
          oldestDate: queryOldest?.date?.toISOString().split('T')[0] || null,
          newestDate: queryNewest?.date?.toISOString().split('T')[0] || null,
          lastSyncedAt: queryLastSync?.syncedAt?.toISOString() || null,
          totalCostMicros: querySum._sum.costMicros?.toString() || '0',
        };
      }
    } catch (err) {
      console.error('[Diagnostics] DB stats error:', err);
      dbError = String(err);
    }

    // ======================================
    // 4. Recent Job Logs from DB
    // ======================================
    let recentJobs: Array<{
      id: string;
      jobType: string;
      customerId: string;
      status: string;
      entityCount: number | null;
      durationMs: number | null;
      errorMessage: string | null;
      createdAt: string;
    }> = [];

    try {
      const jobs = await prisma.refreshJobLog.findMany({
        where: customerId ? { customerId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          jobType: true,
          customerId: true,
          status: true,
          entityCount: true,
          durationMs: true,
          errorMessage: true,
          createdAt: true,
        },
      });

      recentJobs = jobs.map(j => ({
        ...j,
        createdAt: j.createdAt.toISOString(),
      }));
    } catch (err) {
      console.error('[Diagnostics] Job logs error:', err);
    }

    // ======================================
    // 5. In-memory Lock/Metrics Status
    // ======================================
    let lockStatusData: {
      locks: Array<{ key: string; owner: string; age: number; expiresIn: number }>;
      backoffs: Array<{ key: string; expiresIn: number }>;
    } = { locks: [], backoffs: [] };
    let metrics: ReturnType<typeof getMetrics> | null = null;

    try {
      const fullLockStatus = getLockStatus();
      lockStatusData = { locks: fullLockStatus.locks, backoffs: fullLockStatus.backoffs };
      metrics = getMetrics(); // Call getMetrics directly for full type including activeLocks/activeBackoffs
    } catch (err) {
      console.error('[Diagnostics] Lock/metrics error:', err);
    }

    // ======================================
    // 5b. Hierarchy Validation (sampled)
    // Note: Disabled in diagnostics to avoid performance impact
    // Validation runs automatically on 5% of cache hits/refreshes
    // ======================================
    const hierarchyValidation: HierarchyValidationResult | null = null;
    // Skip validation in diagnostics - it runs automatically elsewhere
    // and the new table may not exist in all environments

    // ======================================
    // 6. TTL Configuration
    // ======================================
    const ttlConfig = {
      freshMinutes: Math.round(CACHE_TTL.FRESH / 60000),
      staleMinutes: Math.round(CACHE_TTL.STALE / 60000),
      expiredMinutes: Math.round(CACHE_TTL.EXPIRED / 60000),
    };

    // ======================================
    // 7. Per-Entity Coverage Analysis
    // ======================================
    interface EntityCoverage {
      entityType: string;
      coverage: DateRangeAnalysis | null;
      lastUpdated: string | null;
      lastRefreshOutcome: string | null;
      pendingJobs: number;
      retentionDays: number;
      // NEW: Granularity and overlap detection
      granularityCheck: {
        totalRows: number;
        uniqueDates: number;
        uniqueEntities: number;
        avgRowsPerDate: number;
        granularity: 'daily' | 'range-aggregate' | 'unknown';
        overlapDetected: boolean;
        duplicateDateEntityPairs: number;
      } | null;
    }

    const entityCoverage: EntityCoverage[] = [];
    let entityCoverageError: string | null = null;

    if (customerId && startDate && endDate) {
      try {
        // Get pending jobs from queue
        let pendingJobsByType: Record<string, number> = {};
        if (queueHealth.ready && queueHealth.stats) {
          try {
            const queueJobs = await getQueueJobs(20);
            for (const job of queueJobs) {
              const jobType = job.type || 'unknown';
              pendingJobsByType[jobType] = (pendingJobsByType[jobType] || 0) + 1;
            }
          } catch (err) {
            console.error('[Diagnostics] Queue jobs error:', err);
          }
        }

        // Get last refresh outcome per entity type (wrapped in try/catch)
        let outcomeMap = new Map<string, string | null>();
        try {
          const lastOutcomes = await prisma.refreshJobLog.groupBy({
            by: ['jobType'],
            where: { customerId },
            _max: { createdAt: true, status: true },
          });
          outcomeMap = new Map(lastOutcomes.map(o => [o.jobType, o._max.status]));
        } catch (err) {
          console.error('[Diagnostics] Refresh job log query error:', err);
        }

        // Analyze coverage for each entity type
        const entityTypes: Array<{ type: EntityType; name: string; retention: number }> = [
          { type: 'CAMPAIGN' as EntityType, name: 'campaigns', retention: RETENTION_CAMPAIGNS_DAYS },
          { type: 'AD_GROUP' as EntityType, name: 'ad-groups', retention: RETENTION_ADGROUPS_DAYS },
          { type: 'KEYWORD' as EntityType, name: 'keywords', retention: RETENTION_KEYWORDS_DAYS },
        ];

        for (const entity of entityTypes) {
          try {
            const analysis = await analyzeDateRange(
              customerId,
              entity.type,
              startDate,
              endDate
            );

            // Get last sync time for this entity type
            const lastSync = await prisma.metricsFact.findFirst({
              where: {
                customerId,
                entityType: entity.type,
              },
              orderBy: { syncedAt: 'desc' },
              select: { syncedAt: true },
            });

            // NEW: Granularity and overlap detection
            let granularityCheck: EntityCoverage['granularityCheck'] = null;
            try {
              // Count total rows, unique dates, unique entities for this query
              const whereClause = {
                customerId,
                entityType: entity.type,
                date: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              };

              const [totalRows, distinctDates, distinctEntities] = await Promise.all([
                prisma.metricsFact.count({ where: whereClause }),
                prisma.metricsFact.groupBy({
                  by: ['date'],
                  where: whereClause,
                }),
                prisma.metricsFact.groupBy({
                  by: ['entityId'],
                  where: whereClause,
                }),
              ]);

              const uniqueDates = distinctDates.length;
              const uniqueEntities = distinctEntities.length;
              const avgRowsPerDate = uniqueDates > 0 ? totalRows / uniqueDates : 0;

              // Check for duplicates: if totalRows > (uniqueDates * uniqueEntities), we have overlap
              const expectedRows = uniqueDates * uniqueEntities;
              const duplicateDateEntityPairs = totalRows - expectedRows;
              const overlapDetected = duplicateDateEntityPairs > 0;

              // Determine granularity:
              // - If avgRowsPerDate approx equals uniqueEntities, it's daily (one row per entity per day)
              // - If avgRowsPerDate is much higher, might be range-aggregate pollution
              let granularity: 'daily' | 'range-aggregate' | 'unknown' = 'unknown';
              if (totalRows > 0 && uniqueDates > 0 && uniqueEntities > 0) {
                const rowsPerEntityPerDate = totalRows / (uniqueDates * uniqueEntities);
                if (rowsPerEntityPerDate >= 0.9 && rowsPerEntityPerDate <= 1.1) {
                  granularity = 'daily';
                } else if (rowsPerEntityPerDate > 1.1) {
                  granularity = 'range-aggregate'; // Likely polluted
                }
              }

              granularityCheck = {
                totalRows,
                uniqueDates,
                uniqueEntities,
                avgRowsPerDate: Math.round(avgRowsPerDate * 100) / 100,
                granularity,
                overlapDetected,
                duplicateDateEntityPairs: Math.max(0, duplicateDateEntityPairs),
              };
            } catch (err) {
              console.error(`[Diagnostics] Granularity check error for ${entity.name}:`, err);
            }

            entityCoverage.push({
              entityType: entity.name,
              coverage: analysis,
              lastUpdated: lastSync?.syncedAt?.toISOString() || null,
              lastRefreshOutcome: outcomeMap.get(`refresh:${entity.name}`) || null,
              pendingJobs: pendingJobsByType[`refresh:${entity.name}`] || 0,
              retentionDays: entity.retention,
              granularityCheck,
            });
          } catch (err) {
            console.error(`[Diagnostics] Coverage analysis error for ${entity.name}:`, err);
            entityCoverage.push({
              entityType: entity.name,
              coverage: null,
              lastUpdated: null,
              lastRefreshOutcome: null,
              pendingJobs: 0,
              retentionDays: entity.retention,
              granularityCheck: null,
            });
          }
        }
      } catch (err) {
        console.error('[Diagnostics] Entity coverage section error:', err);
        entityCoverageError = String(err);
      }
    }

    // ======================================
    // 8. Quota Guardrails Config
    // ======================================
    const quotaGuardrails = {
      maxInlineMissingDays: MAX_INLINE_MISSING_DAYS,
      maxInlineChunks: MAX_INLINE_CHUNKS,
      retentionDays: {
        campaigns: RETENTION_CAMPAIGNS_DAYS,
        adGroups: RETENTION_ADGROUPS_DAYS,
        keywords: RETENTION_KEYWORDS_DAYS,
      },
    };

    // ======================================
    // 9. Mismatch History (30 days)
    // Note: May fail if HierarchyMismatchEvent table doesn't exist
    // ======================================
    let mismatchHistory = null;
    let mismatchHistoryError: string | null = null;
    if (customerId) {
      try {
        mismatchHistory = await getMismatchHistory(customerId, 30, 50);
      } catch (err) {
        const errMsg = String(err);
        // Check if table doesn't exist
        if (errMsg.includes('does not exist') || errMsg.includes('P2021') || errMsg.includes('relation')) {
          mismatchHistoryError = 'Table not created. Run: npx prisma db push';
        } else {
          mismatchHistoryError = errMsg;
        }
        console.warn('[Diagnostics] Mismatch history error:', err);
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      redis: redisHealth,
      queue: queueHealth,
      worker: workerHeartbeat,
      database: dbCacheStats,
      dbError,
      recentJobs,
      locks: lockStatusData.locks,
      backoffs: lockStatusData.backoffs,
      metrics,
      ttlConfig,
      quotaGuardrails,
      entityCoverage,
      entityCoverageError,
      hierarchyValidation,
      mismatchHistory,
      mismatchHistoryError,
      featureFlags: getAllFlags(),
      query: customerId ? { customerId, startDate, endDate } : null,
    });
  } catch (error) {
    console.error('[Diagnostics] Error:', error);
    return NextResponse.json(
      { error: 'Diagnostics failed', details: String(error) },
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

    switch (action) {
      case 'test_redis': {
        // Detailed Redis test with timing
        const startTime = Date.now();
        try {
          const available = await isRedisAvailable();
          const duration = Date.now() - startTime;

          return NextResponse.json({
            success: available,
            action: 'test_redis',
            status: getRedisStatus(),
            host: REDIS_CONFIG.host,
            port: REDIS_CONFIG.port,
            durationMs: duration,
            message: available
              ? `Connected to Redis at ${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`
              : 'Redis ping failed - check REDIS_URL environment variable',
          });
        } catch (err) {
          const duration = Date.now() - startTime;
          const error = err as Error;

          // Parse error for helpful message
          let helpMessage = error.message;
          if (error.message.includes('ECONNREFUSED')) {
            helpMessage = `Connection refused - Redis not running at ${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`;
          } else if (error.message.includes('ENOTFOUND')) {
            helpMessage = `DNS lookup failed - host "${REDIS_CONFIG.host}" not found`;
          } else if (error.message.includes('timeout')) {
            helpMessage = 'Connection timeout - Redis may be slow or unreachable';
          } else if (error.message.includes('NOAUTH')) {
            helpMessage = 'Authentication failed - check Redis password in REDIS_URL';
          }

          return NextResponse.json({
            success: false,
            action: 'test_redis',
            status: 'error',
            host: REDIS_CONFIG.host,
            port: REDIS_CONFIG.port,
            durationMs: duration,
            error: error.message,
            message: helpMessage,
          });
        }
      }

      case 'test_db': {
        // Database connectivity test
        const startTime = Date.now();
        try {
          const result = await prisma.$queryRaw`SELECT 1 as ok`;
          const duration = Date.now() - startTime;

          return NextResponse.json({
            success: true,
            action: 'test_db',
            durationMs: duration,
            message: 'Database connected successfully',
          });
        } catch (err) {
          const duration = Date.now() - startTime;
          return NextResponse.json({
            success: false,
            action: 'test_db',
            durationMs: duration,
            error: (err as Error).message,
            message: 'Database connection failed - check DATABASE_URL',
          });
        }
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: test_redis, test_db' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Diagnostics] POST error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: String(error) },
      { status: 500 }
    );
  }
}
