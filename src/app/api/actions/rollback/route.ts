import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  updateCampaignStatus,
  updateAdGroupStatus,
  updateKeywordStatus,
  updateCampaignBudget,
} from '@/lib/google-ads';
import { createAuditLog } from '@/lib/audit-log';

interface RollbackPayload {
  auditLogId: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user session
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the rollback payload
    const { auditLogId }: RollbackPayload = await request.json();

    if (!auditLogId) {
      return NextResponse.json({ error: 'auditLogId is required' }, { status: 400 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get OAuth account with refresh token
    const authAccount = await prisma.account.findFirst({
      where: { userId: user.id, provider: 'google' },
      select: { refresh_token: true },
    });

    if (!authAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'Google account not connected or refresh token missing' },
        { status: 400 }
      );
    }

    const refreshToken = authAccount.refresh_token;

    // Get the audit log entry to rollback
    const auditLog = await prisma.activityLog.findUnique({
      where: { id: auditLogId },
      include: {
        account: {
          select: {
            id: true,
            googleAccountId: true,
            isManager: true,
            parentManagerId: true,
          },
        },
      },
    });

    if (!auditLog) {
      return NextResponse.json({ error: 'Audit log entry not found' }, { status: 404 });
    }

    // Verify the audit log belongs to this user
    if (auditLog.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Can only rollback successful actions
    if (auditLog.status !== 'success') {
      return NextResponse.json(
        { error: 'Can only rollback successful actions' },
        { status: 400 }
      );
    }

    const customerId = auditLog.account.googleAccountId;
    const loginCustomerId = auditLog.account.isManager
      ? auditLog.account.googleAccountId
      : auditLog.account.parentManagerId || undefined;

    // Determine the rollback action based on the original action
    let result: { success: boolean; error?: string };
    const beforeValue = auditLog.beforeValue;
    const actionType = auditLog.actionType;

    switch (actionType) {
      case 'pause_campaign':
        // Rollback: enable the campaign
        result = await updateCampaignStatus(
          refreshToken,
          customerId,
          auditLog.entityId,
          'ENABLED',
          loginCustomerId
        );
        break;

      case 'enable_campaign':
        // Rollback: pause the campaign
        result = await updateCampaignStatus(
          refreshToken,
          customerId,
          auditLog.entityId,
          'PAUSED',
          loginCustomerId
        );
        break;

      case 'pause_ad_group':
        // Rollback: enable the ad group
        result = await updateAdGroupStatus(
          refreshToken,
          customerId,
          auditLog.entityId,
          'ENABLED',
          loginCustomerId
        );
        break;

      case 'enable_ad_group':
        // Rollback: pause the ad group
        result = await updateAdGroupStatus(
          refreshToken,
          customerId,
          auditLog.entityId,
          'PAUSED',
          loginCustomerId
        );
        break;

      case 'pause_keyword':
        // Need to parse the ad group ID from the entity context
        // For now, we'll return an error if we can't determine it
        result = { success: false, error: 'Keyword rollback requires ad group context' };
        break;

      case 'enable_keyword':
        result = { success: false, error: 'Keyword rollback requires ad group context' };
        break;

      case 'update_budget':
        // Rollback: restore the previous budget
        if (beforeValue !== null && beforeValue !== undefined) {
          const previousBudget = typeof beforeValue === 'number'
            ? beforeValue
            : Number(beforeValue);
          const budgetMicros = previousBudget * 1_000_000;
          result = await updateCampaignBudget(
            refreshToken,
            customerId,
            auditLog.entityId,
            budgetMicros,
            loginCustomerId
          );
        } else {
          result = { success: false, error: 'Cannot determine previous budget value' };
        }
        break;

      default:
        return NextResponse.json(
          { error: `Rollback not supported for action type: ${actionType}` },
          { status: 400 }
        );
    }

    // Log the rollback action
    await createAuditLog({
      userId: user.id,
      accountId: auditLog.account.id,
      actionType: `rollback_${actionType}`,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      entityName: auditLog.entityName,
      beforeValue: auditLog.afterValue,
      afterValue: auditLog.beforeValue,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      source: 'user',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Rollback failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully rolled back ${actionType} on ${auditLog.entityName}`,
    });
  } catch (error) {
    console.error('Error rolling back action:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to rollback action',
      },
      { status: 500 }
    );
  }
}
