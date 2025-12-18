import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  updateCampaignStatus,
  updateCampaignBudget,
  updateAdGroupStatus,
  updateKeywordStatus,
} from '@/lib/google-ads';
import { createAuditLog } from '@/lib/audit-log';

interface BulkOperation {
  entityType: 'campaign' | 'ad_group' | 'keyword';
  entityId: string;
  entityName: string;
  action: 'pause' | 'enable' | 'update_budget' | 'update_bid';
  value?: number;
  adGroupId?: string; // For keywords
}

interface BulkOperationResult {
  entityId: string;
  entityName: string;
  success: boolean;
  error?: string;
}

// POST /api/bulk-operations - Execute multiple operations at once
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        authAccounts: {
          where: { provider: 'google' },
          select: { refresh_token: true },
        },
        googleAdsAccounts: {
          select: {
            id: true,
            googleAccountId: true,
            isManager: true,
            parentManagerId: true,
          },
        },
      },
    });

    if (!user || !user.authAccounts[0]?.refresh_token) {
      return NextResponse.json(
        { error: 'Google account not connected' },
        { status: 400 }
      );
    }

    const refreshToken = user.authAccounts[0].refresh_token;

    const body = await request.json();
    const { accountId, operations } = body as {
      accountId: string;
      operations: BulkOperation[];
    };

    if (!accountId || !operations || operations.length === 0) {
      return NextResponse.json(
        { error: 'Account ID and operations are required' },
        { status: 400 }
      );
    }

    // Validate operation limit
    if (operations.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 operations per request' },
        { status: 400 }
      );
    }

    // Find the Google Ads account
    const googleAdsAccount = user.googleAdsAccounts.find(
      a => a.id === accountId || a.googleAccountId === accountId
    );

    if (!googleAdsAccount) {
      return NextResponse.json(
        { error: 'Google Ads account not found' },
        { status: 404 }
      );
    }

    const customerId = googleAdsAccount.googleAccountId;
    const loginCustomerId = googleAdsAccount.isManager
      ? googleAdsAccount.googleAccountId
      : googleAdsAccount.parentManagerId || undefined;

    // Execute operations
    const results: BulkOperationResult[] = [];

    for (const op of operations) {
      let result: { success: boolean; error?: string } = { success: false };

      try {
        switch (op.action) {
          case 'pause':
            if (op.entityType === 'campaign') {
              result = await updateCampaignStatus(
                refreshToken,
                customerId,
                op.entityId,
                'PAUSED',
                loginCustomerId
              );
            } else if (op.entityType === 'ad_group') {
              result = await updateAdGroupStatus(
                refreshToken,
                customerId,
                op.entityId,
                'PAUSED',
                loginCustomerId
              );
            } else if (op.entityType === 'keyword' && op.adGroupId) {
              result = await updateKeywordStatus(
                refreshToken,
                customerId,
                op.adGroupId,
                op.entityId,
                'PAUSED',
                loginCustomerId
              );
            }
            break;

          case 'enable':
            if (op.entityType === 'campaign') {
              result = await updateCampaignStatus(
                refreshToken,
                customerId,
                op.entityId,
                'ENABLED',
                loginCustomerId
              );
            } else if (op.entityType === 'ad_group') {
              result = await updateAdGroupStatus(
                refreshToken,
                customerId,
                op.entityId,
                'ENABLED',
                loginCustomerId
              );
            } else if (op.entityType === 'keyword' && op.adGroupId) {
              result = await updateKeywordStatus(
                refreshToken,
                customerId,
                op.adGroupId,
                op.entityId,
                'ENABLED',
                loginCustomerId
              );
            }
            break;

          case 'update_budget':
            if (op.entityType === 'campaign' && op.value !== undefined) {
              const budgetMicros = op.value * 1_000_000;
              result = await updateCampaignBudget(
                refreshToken,
                customerId,
                op.entityId,
                budgetMicros,
                loginCustomerId
              );
            }
            break;

          default:
            result = { success: false, error: `Unknown action: ${op.action}` };
        }

        // Log the action
        await createAuditLog({
          userId: user.id,
          accountId: googleAdsAccount.id,
          actionType: `bulk_${op.action}`,
          entityType: op.entityType,
          entityId: op.entityId,
          entityName: op.entityName,
          beforeValue: null,
          afterValue: op.value || op.action,
          status: result.success ? 'success' : 'failed',
          errorMessage: result.error,
          source: 'user',
        });
      } catch (error) {
        result = {
          success: false,
          error: error instanceof Error ? error.message : 'Operation failed',
        };
      }

      results.push({
        entityId: op.entityId,
        entityName: op.entityName,
        success: result.success,
        error: result.error,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      message: `${successCount} succeeded, ${failCount} failed`,
      successCount,
      failCount,
      results,
    });
  } catch (error) {
    console.error('Error in bulk operations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk operations failed' },
      { status: 500 }
    );
  }
}
