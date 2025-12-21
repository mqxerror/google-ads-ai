import { NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { listAccessibleAccounts, listClientAccounts } from '@/lib/google-ads';
import { DEMO_ACCOUNT } from '@/lib/demo-data';

// Force Node.js runtime (not Edge) for Prisma compatibility
export const runtime = 'nodejs';

// Error codes for typed error responses
type ErrorCode =
  | 'UNAUTHORIZED'
  | 'USER_NOT_FOUND'
  | 'NO_OAUTH_TOKEN'
  | 'GOOGLE_AUTH_EXPIRED'
  | 'GOOGLE_PERMISSION_DENIED'
  | 'GOOGLE_MCC_ACCESS_DENIED'
  | 'GOOGLE_API_ERROR'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

interface TypedError {
  error: string;
  code: ErrorCode;
  details?: string;
  correlationId: string;
  action?: string;
}

function generateCorrelationId(): string {
  return `acc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseGoogleAdsError(error: unknown): { code: ErrorCode; message: string; action: string } {
  const errStr = String(error);

  if (errStr.includes('PERMISSION_DENIED') || errStr.includes('403')) {
    return {
      code: 'GOOGLE_PERMISSION_DENIED',
      message: 'Permission denied by Google Ads API',
      action: 'Check that your Google account has access to Google Ads. Go to Settings → Reconnect Google.',
    };
  }

  if (errStr.includes('UNAUTHENTICATED') || errStr.includes('401') || errStr.includes('invalid_grant')) {
    return {
      code: 'GOOGLE_AUTH_EXPIRED',
      message: 'Google authentication expired or revoked',
      action: 'Your Google session has expired. Please sign out and sign in again.',
    };
  }

  if (errStr.includes('CUSTOMER_NOT_FOUND') || errStr.includes('NO_CUSTOMER_FOUND')) {
    return {
      code: 'GOOGLE_MCC_ACCESS_DENIED',
      message: 'No Google Ads accounts found or MCC access denied',
      action: 'Ensure your Google account has access to at least one Google Ads account.',
    };
  }

  if (errStr.includes('QUERY_ERROR') || errStr.includes('INVALID_')) {
    return {
      code: 'GOOGLE_API_ERROR',
      message: 'Google Ads API returned an error',
      action: 'This may be a temporary issue. Try again in a few minutes.',
    };
  }

  return {
    code: 'GOOGLE_API_ERROR',
    message: 'Failed to communicate with Google Ads API',
    action: 'Check your internet connection and try again.',
  };
}

function errorResponse(
  code: ErrorCode,
  message: string,
  correlationId: string,
  status: number,
  details?: string,
  action?: string
): NextResponse<TypedError> {
  return NextResponse.json(
    { error: message, code, correlationId, details, action },
    { status }
  );
}

// GET /api/google-ads/accounts - List accessible Google Ads accounts and sync to database
export async function GET() {
  const correlationId = generateCorrelationId();
  const logContext: Record<string, string> = { correlationId, endpoint: '/api/google-ads/accounts' };

  const session = await auth();

  if (!session?.user?.email) {
    console.warn('[Accounts API] Unauthorized request', logContext);
    return errorResponse('UNAUTHORIZED', 'Not authenticated', correlationId, 401, undefined, 'Please sign in to continue.');
  }

  logContext.email = session.user.email;

  // Demo mode - return mock account
  if (isDemoMode) {
    return NextResponse.json({
      accounts: [DEMO_ACCOUNT],
      synced: 1,
      summary: {
        totalAccounts: 1,
        managerAccounts: 0,
        clientAccounts: 1,
      },
    });
  }

  try {
    // Get user with their OAuth account (to get refresh token)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        authAccounts: {
          where: { provider: 'google' },
          select: { refresh_token: true },
        },
      },
    });

    if (!user) {
      console.error('[Accounts API] User not found in database', logContext);
      return errorResponse('USER_NOT_FOUND', 'User not found', correlationId, 404, undefined, 'Please sign out and sign in again.');
    }

    const googleAccount = user.authAccounts[0];
    if (!googleAccount?.refresh_token) {
      console.warn('[Accounts API] No OAuth token found', { ...logContext, userId: user.id });
      return errorResponse(
        'NO_OAUTH_TOKEN',
        'No Google OAuth token found',
        correlationId,
        400,
        'Your Google authentication is missing or incomplete.',
        'Go to Settings and reconnect your Google account.'
      );
    }

    // Fetch accessible accounts from Google Ads API
    console.log('[Accounts API] Fetching accessible accounts from Google Ads', logContext);
    let accessibleAccounts;
    try {
      accessibleAccounts = await listAccessibleAccounts(googleAccount.refresh_token);
      console.log('[Accounts API] Found accessible accounts', { ...logContext, count: accessibleAccounts.length });
    } catch (googleErr) {
      const parsed = parseGoogleAdsError(googleErr);
      console.error('[Accounts API] Google Ads API error', { ...logContext, error: String(googleErr), code: parsed.code });
      return errorResponse(parsed.code, parsed.message, correlationId, 502, String(googleErr), parsed.action);
    }

    // For each manager account, also fetch client accounts
    const allAccounts: Array<{
      customerId: string;
      descriptiveName: string;
      isManager: boolean;
      parentManagerId?: string;
      parentManagerName?: string;
    }> = [];

    for (const account of accessibleAccounts) {
      if (account.manager) {
        // This is an MCC - first add the MCC itself, then fetch its client accounts
        allAccounts.push({
          customerId: account.customerId,
          descriptiveName: account.descriptiveName,
          isManager: true,
        });

        try {
          const clientAccounts = await listClientAccounts(googleAccount.refresh_token, account.customerId);
          console.log(`Client accounts for MCC ${account.customerId}:`, JSON.stringify(clientAccounts, null, 2));

          for (const client of clientAccounts) {
            allAccounts.push({
              customerId: client.customerId,
              descriptiveName: client.descriptiveName,
              isManager: false,
              parentManagerId: account.customerId,
              parentManagerName: account.descriptiveName,
            });
          }
        } catch (err) {
          console.error(`Error fetching clients for MCC ${account.customerId}:`, err);
        }
      } else {
        // Regular account (not under MCC)
        allAccounts.push({
          customerId: account.customerId,
          descriptiveName: account.descriptiveName,
          isManager: false,
        });
      }
    }

    console.log('All accounts to sync:', JSON.stringify(allAccounts, null, 2));

    // If no accounts found, return helpful message
    if (allAccounts.length === 0) {
      return NextResponse.json({
        accounts: [],
        synced: 0,
        message: 'No accessible Google Ads accounts found.',
      });
    }

    // Sync accounts to database
    const syncedAccounts = await Promise.all(
      allAccounts.map(async (account) => {
        // Upsert: create or update
        const existing = await prisma.googleAdsAccount.findFirst({
          where: {
            userId: user.id,
            googleAccountId: account.customerId,
          },
        });

        if (existing) {
          // Update existing
          return prisma.googleAdsAccount.update({
            where: { id: existing.id },
            data: {
              accountName: account.descriptiveName,
              status: 'connected',
              isManager: account.isManager,
              parentManagerId: account.parentManagerId || null,
            },
          });
        } else {
          // Create new
          return prisma.googleAdsAccount.create({
            data: {
              userId: user.id,
              googleAccountId: account.customerId,
              accountName: account.descriptiveName,
              accessToken: 'oauth',
              refreshToken: 'oauth',
              tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              status: 'connected',
              isManager: account.isManager,
              parentManagerId: account.parentManagerId || null,
            },
          });
        }
      })
    );

    // Group accounts by manager for better display
    const managerAccounts = syncedAccounts.filter(a => a.isManager);
    const clientAccounts = syncedAccounts.filter(a => !a.isManager);

    console.log('[Accounts API] Successfully synced accounts', { ...logContext, synced: syncedAccounts.length });
    return NextResponse.json({
      accounts: syncedAccounts.map((a) => ({
        id: a.id,
        googleAccountId: a.googleAccountId,
        accountName: a.accountName,
        status: a.status,
        lastSyncAt: a.lastSyncAt,
        isManager: a.isManager,
        parentManagerId: a.parentManagerId,
      })),
      synced: syncedAccounts.length,
      summary: {
        totalAccounts: syncedAccounts.length,
        managerAccounts: managerAccounts.length,
        clientAccounts: clientAccounts.length,
      },
      correlationId,
    });
  } catch (error) {
    // Check if it's a Prisma/database error
    const errStr = String(error);
    if (errStr.includes('Prisma') || errStr.includes('database') || errStr.includes('connect')) {
      console.error('[Accounts API] Database error', { ...logContext, error: errStr });
      return errorResponse(
        'DATABASE_ERROR',
        'Database connection error',
        correlationId,
        503,
        errStr,
        'This is a server issue. Please try again in a few moments.'
      );
    }

    // Generic internal error
    console.error('[Accounts API] Internal error', { ...logContext, error: errStr });
    return errorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch Google Ads accounts',
      correlationId,
      500,
      errStr,
      'An unexpected error occurred. Please try again.'
    );
  }
}
