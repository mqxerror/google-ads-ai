import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listAccessibleAccounts, listMCCClientAccounts } from '@/lib/google-ads';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.refreshToken) {
      return NextResponse.json({
        accounts: [],
        error: 'Not authenticated or missing refresh token',
      });
    }

    // First, try to get directly accessible accounts
    const accessibleAccounts = await listAccessibleAccounts(session.refreshToken);

    // Filter to only client accounts (not manager accounts)
    const clientAccounts = accessibleAccounts.filter(acc => !acc.manager);

    // If we have client accounts, return them
    if (clientAccounts.length > 0) {
      console.log(`[Accounts API] Found ${clientAccounts.length} client accounts from accessible accounts`);
      return NextResponse.json({
        accounts: clientAccounts,
        count: clientAccounts.length,
        source: 'accessible',
      });
    }

    // No client accounts found directly - try to list client accounts under MCC
    console.log('[Accounts API] No client accounts found directly, trying MCC...');
    const mccClientAccounts = await listMCCClientAccounts(session.refreshToken);

    if (mccClientAccounts.length > 0) {
      console.log(`[Accounts API] Found ${mccClientAccounts.length} client accounts from MCC`);
      return NextResponse.json({
        accounts: mccClientAccounts,
        count: mccClientAccounts.length,
        source: 'mcc',
      });
    }

    // No accounts found at all
    console.log('[Accounts API] No client accounts found from any source');
    return NextResponse.json({
      accounts: [],
      count: 0,
      message: 'No client accounts found. Please ensure your Google account has access to Google Ads client accounts.',
    });
  } catch (error) {
    console.error('[Accounts API] Error:', error);
    return NextResponse.json({
      accounts: [],
      error: error instanceof Error ? error.message : 'Failed to fetch accounts',
    });
  }
}
