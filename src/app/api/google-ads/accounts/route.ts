import { NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { listAccessibleAccounts, listClientAccounts } from '@/lib/google-ads';
import { DEMO_ACCOUNT } from '@/lib/demo-data';

// GET /api/google-ads/accounts - List accessible Google Ads accounts and sync to database
export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const googleAccount = user.authAccounts[0];
    if (!googleAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'No Google OAuth token found. Please re-authenticate.' },
        { status: 400 }
      );
    }

    // Fetch accessible accounts from Google Ads API
    const accessibleAccounts = await listAccessibleAccounts(googleAccount.refresh_token);
    console.log('Accessible accounts:', JSON.stringify(accessibleAccounts, null, 2));

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
    });
  } catch (error) {
    console.error('Error fetching Google Ads accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Google Ads accounts', details: String(error) },
      { status: 500 }
    );
  }
}
