import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  updateCampaignStatus,
  updateAdGroupStatus,
  updateKeywordStatus,
  updateCampaignBudget,
  updateKeyword,
  updateAdGroupBid,
} from '@/lib/google-ads';
import { createAuditLog } from '@/lib/audit-log';

// Action types we support
type ActionType =
  | 'pause_campaign'
  | 'enable_campaign'
  | 'pause_ad_group'
  | 'enable_ad_group'
  | 'pause_keyword'
  | 'enable_keyword'
  | 'update_budget'
  | 'update_bid';

interface ActionPayload {
  id: string;
  actionType: ActionType;
  entityType: 'campaign' | 'ad_group' | 'keyword';
  entityId: string;
  entityName: string;
  currentValue: string | number | boolean;
  newValue: string | number | boolean;
  accountId?: string; // Google Ads account ID (customer ID)
  adGroupId?: string; // For keywords, the parent ad group ID
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user session
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the action payload
    const action: ActionPayload = await request.json();

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

    // Get Google Ads accounts
    const googleAdsAccounts = await prisma.googleAdsAccount.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        googleAccountId: true,
        isManager: true,
        parentManagerId: true,
      },
    });

    if (!authAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'Google account not connected or refresh token missing' },
        { status: 400 }
      );
    }

    const refreshToken = authAccount.refresh_token;

    // Find the Google Ads account for this action
    // Use the accountId from the action payload, or fall back to header/first account
    const accountIdFromAction = action.accountId;
    const accountIdHeader = request.headers.get('x-google-ads-account-id');
    const accountIdToFind = accountIdFromAction || accountIdHeader;

    // Find the matching Google Ads account
    let googleAdsAccount = googleAdsAccounts[0];
    if (accountIdToFind) {
      const found = googleAdsAccounts.find(
        (a) => a.id === accountIdToFind || a.googleAccountId === accountIdToFind
      );
      if (found) googleAdsAccount = found;
    }

    if (!googleAdsAccount) {
      return NextResponse.json(
        { error: 'No Google Ads account found' },
        { status: 400 }
      );
    }

    const customerId = googleAdsAccount.googleAccountId;
    const loginCustomerId = googleAdsAccount.isManager
      ? googleAdsAccount.googleAccountId
      : googleAdsAccount.parentManagerId || undefined;

    // Execute the action based on type
    let result: { success: boolean; error?: string };

    switch (action.actionType) {
      case 'pause_campaign':
        result = await updateCampaignStatus(
          refreshToken,
          customerId,
          action.entityId,
          'PAUSED',
          loginCustomerId
        );
        break;

      case 'enable_campaign':
        result = await updateCampaignStatus(
          refreshToken,
          customerId,
          action.entityId,
          'ENABLED',
          loginCustomerId
        );
        break;

      case 'pause_ad_group':
        result = await updateAdGroupStatus(
          refreshToken,
          customerId,
          action.entityId,
          'PAUSED',
          loginCustomerId
        );
        break;

      case 'enable_ad_group':
        result = await updateAdGroupStatus(
          refreshToken,
          customerId,
          action.entityId,
          'ENABLED',
          loginCustomerId
        );
        break;

      case 'pause_keyword':
        if (!action.adGroupId) {
          return NextResponse.json(
            { error: 'adGroupId is required for keyword actions' },
            { status: 400 }
          );
        }
        result = await updateKeywordStatus(
          refreshToken,
          customerId,
          action.adGroupId,
          action.entityId,
          'PAUSED',
          loginCustomerId
        );
        break;

      case 'enable_keyword':
        if (!action.adGroupId) {
          return NextResponse.json(
            { error: 'adGroupId is required for keyword actions' },
            { status: 400 }
          );
        }
        result = await updateKeywordStatus(
          refreshToken,
          customerId,
          action.adGroupId,
          action.entityId,
          'ENABLED',
          loginCustomerId
        );
        break;

      case 'update_budget':
        // Convert dollar amount to micros (1 dollar = 1,000,000 micros)
        const budgetMicros = Number(action.newValue) * 1_000_000;
        result = await updateCampaignBudget(
          refreshToken,
          customerId,
          action.entityId,
          budgetMicros,
          loginCustomerId
        );
        break;

      case 'update_bid':
        // Convert dollar amount to micros (1 dollar = 1,000,000 micros)
        const bidMicros = Number(action.newValue) * 1_000_000;

        if (action.entityType === 'keyword') {
          // Update keyword bid
          if (!action.adGroupId) {
            return NextResponse.json(
              { error: 'adGroupId is required for keyword bid updates' },
              { status: 400 }
            );
          }
          result = await updateKeyword(
            refreshToken,
            customerId,
            action.adGroupId,
            action.entityId,
            { cpcBidMicros: bidMicros },
            loginCustomerId
          );
        } else if (action.entityType === 'ad_group') {
          // Update ad group bid
          result = await updateAdGroupBid(
            refreshToken,
            customerId,
            action.entityId,
            bidMicros,
            loginCustomerId
          );
        } else {
          result = { success: false, error: 'Bid updates are only supported for ad groups and keywords' };
        }
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action type: ${action.actionType}` },
          { status: 400 }
        );
    }

    // Log the action to audit trail
    await createAuditLog({
      userId: user.id,
      accountId: googleAdsAccount.id,
      actionType: action.actionType,
      entityType: action.entityType,
      entityId: action.entityId,
      entityName: action.entityName,
      beforeValue: action.currentValue,
      afterValue: action.newValue,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      source: 'user',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Action failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      actionId: action.id,
      message: `Successfully executed ${action.actionType} on ${action.entityName}`,
    });
  } catch (error) {
    console.error('Error executing action:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to execute action',
      },
      { status: 500 }
    );
  }
}
