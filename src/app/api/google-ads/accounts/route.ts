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

    // Separate manager accounts (MCCs) from client accounts
    const clientAccounts = accessibleAccounts.filter(acc => !acc.manager);
    const managerAccounts = accessibleAccounts.filter(acc => acc.manager);

    console.log(`[Accounts API] Found ${clientAccounts.length} client accounts and ${managerAccounts.length} manager accounts`);

    // If we have client accounts, return them
    if (clientAccounts.length > 0) {
      console.log(`[Accounts API] Returning ${clientAccounts.length} client accounts from accessible accounts`);
      return NextResponse.json({
        accounts: clientAccounts,
        count: clientAccounts.length,
        source: 'accessible',
      });
    }

    // No client accounts found directly - try to list client accounts under each MCC
    console.log('[Accounts API] No client accounts found directly, trying MCC accounts...');

    // Auto-detect MCC: Use manager accounts from accessible accounts, or fall back to env var
    const mccIds = managerAccounts.length > 0
      ? managerAccounts.map(acc => acc.customerId)
      : (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || process.env.GOOGLE_ADS_MCC_ID ?
          [process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || process.env.GOOGLE_ADS_MCC_ID] :
          []);

    if (mccIds.length === 0) {
      console.log('[Accounts API] No MCC accounts found and no MCC ID configured');
      return NextResponse.json({
        accounts: [],
        count: 0,
        message: 'No Google Ads accounts found. Please ensure your Google account has access to Google Ads accounts.',
      });
    }

    // Try each MCC to find client accounts
    for (const mccId of mccIds) {
      if (!mccId) continue;

      console.log(`[Accounts API] Trying MCC ${mccId}...`);
      const mccClientAccounts = await listMCCClientAccounts(session.refreshToken, mccId);

      if (mccClientAccounts.length > 0) {
        console.log(`[Accounts API] Found ${mccClientAccounts.length} client accounts from MCC ${mccId}`);
        return NextResponse.json({
          accounts: mccClientAccounts,
          count: mccClientAccounts.length,
          source: 'mcc',
          loginCustomerId: mccId, // MCC ID for API calls
        });
      }
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
