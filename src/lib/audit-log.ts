import { prisma } from './prisma';
import { ActionType, EntityType } from '@/types/action-queue';

export interface AuditLogEntry {
  userId: string;
  accountId: string;
  actionType: ActionType | string;
  entityType: EntityType | string;
  entityId: string;
  entityName: string;
  beforeValue?: string | number | boolean | object | null;
  afterValue?: string | number | boolean | object | null;
  status: 'success' | 'failed';
  errorMessage?: string;
  source?: 'user' | 'ai' | 'system';
}

// Create a new audit log entry
export async function createAuditLog(entry: AuditLogEntry) {
  try {
    const log = await prisma.activityLog.create({
      data: {
        userId: entry.userId,
        accountId: entry.accountId,
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityName: entry.entityName,
        beforeValue: entry.beforeValue !== undefined ? JSON.parse(JSON.stringify(entry.beforeValue)) : null,
        afterValue: entry.afterValue !== undefined ? JSON.parse(JSON.stringify(entry.afterValue)) : null,
        status: entry.status,
        errorMessage: entry.errorMessage,
        source: entry.source || 'user',
      },
    });
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main flow
    return null;
  }
}

// Fetch audit logs with pagination and filtering
export async function getAuditLogs(options: {
  userId: string;
  accountId?: string;
  entityType?: string;
  actionType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const {
    userId,
    accountId,
    entityType,
    actionType,
    status,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  const where: Record<string, unknown> = { userId };

  if (accountId) where.accountId = accountId;
  if (entityType) where.entityType = entityType;
  if (actionType) where.actionType = actionType;
  if (status) where.status = status;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        account: {
          select: {
            accountName: true,
            googleAccountId: true,
          },
        },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    logs,
    total,
    hasMore: offset + logs.length < total,
  };
}

// Get recent activity summary
export async function getRecentActivitySummary(userId: string, accountId?: string) {
  const where: Record<string, unknown> = {
    userId,
    createdAt: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    },
  };

  if (accountId) where.accountId = accountId;

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const summary = {
    totalActions: logs.length,
    successCount: logs.filter(l => l.status === 'success').length,
    failedCount: logs.filter(l => l.status === 'failed').length,
    byActionType: {} as Record<string, number>,
    byEntityType: {} as Record<string, number>,
    recentLogs: logs.slice(0, 10),
  };

  logs.forEach(log => {
    summary.byActionType[log.actionType] = (summary.byActionType[log.actionType] || 0) + 1;
    summary.byEntityType[log.entityType] = (summary.byEntityType[log.entityType] || 0) + 1;
  });

  return summary;
}
