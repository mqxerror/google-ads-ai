import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchKeywords, createKeywords, removeKeyword, updateKeyword } from '@/lib/google-ads';

// GET /api/google-ads/keywords?accountId=xxx&adGroupId=xxx - Fetch keywords for an ad group
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const adGroupId = searchParams.get('adGroupId');

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  if (!adGroupId) {
    return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
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
        googleAdsAccounts: {
          where: { id: accountId },
          select: {
            id: true,
            googleAccountId: true,
            parentManagerId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const googleOAuthAccount = user.authAccounts[0];
    if (!googleOAuthAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'No Google OAuth token found. Please re-authenticate.' },
        { status: 400 }
      );
    }

    const googleAdsAccount = user.googleAdsAccounts[0];
    if (!googleAdsAccount) {
      return NextResponse.json({ error: 'Google Ads account not found' }, { status: 404 });
    }

    // Fetch keywords from Google Ads API
    const keywords = await fetchKeywords(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      adGroupId,
      googleAdsAccount.parentManagerId || undefined
    );

    return NextResponse.json({ keywords });
  } catch (error) {
    console.error('Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/google-ads/keywords - Create new keywords in an ad group
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId, adGroupId, keywords } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!adGroupId) {
      return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'keywords array is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        authAccounts: {
          where: { provider: 'google' },
          select: { refresh_token: true },
        },
        googleAdsAccounts: {
          where: { id: accountId },
          select: {
            id: true,
            googleAccountId: true,
            parentManagerId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const googleOAuthAccount = user.authAccounts[0];
    if (!googleOAuthAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'No Google OAuth token found. Please re-authenticate.' },
        { status: 400 }
      );
    }

    const googleAdsAccount = user.googleAdsAccounts[0];
    if (!googleAdsAccount) {
      return NextResponse.json({ error: 'Google Ads account not found' }, { status: 404 });
    }

    const result = await createKeywords(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      adGroupId,
      keywords,
      googleAdsAccount.parentManagerId || undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, keywordIds: result.keywordIds });
  } catch (error) {
    console.error('Error creating keywords:', error);
    return NextResponse.json(
      { error: 'Failed to create keywords', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/google-ads/keywords - Update an existing keyword
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId, adGroupId, keywordId, updates } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!adGroupId) {
      return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
    }

    if (!keywordId) {
      return NextResponse.json({ error: 'keywordId is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        authAccounts: {
          where: { provider: 'google' },
          select: { refresh_token: true },
        },
        googleAdsAccounts: {
          where: { id: accountId },
          select: {
            id: true,
            googleAccountId: true,
            parentManagerId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const googleOAuthAccount = user.authAccounts[0];
    if (!googleOAuthAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'No Google OAuth token found. Please re-authenticate.' },
        { status: 400 }
      );
    }

    const googleAdsAccount = user.googleAdsAccounts[0];
    if (!googleAdsAccount) {
      return NextResponse.json({ error: 'Google Ads account not found' }, { status: 404 });
    }

    const result = await updateKeyword(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      adGroupId,
      keywordId,
      updates,
      googleAdsAccount.parentManagerId || undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating keyword:', error);
    return NextResponse.json(
      { error: 'Failed to update keyword', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/google-ads/keywords - Remove a keyword
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const adGroupId = searchParams.get('adGroupId');
    const keywordId = searchParams.get('keywordId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!adGroupId) {
      return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
    }

    if (!keywordId) {
      return NextResponse.json({ error: 'keywordId is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        authAccounts: {
          where: { provider: 'google' },
          select: { refresh_token: true },
        },
        googleAdsAccounts: {
          where: { id: accountId },
          select: {
            id: true,
            googleAccountId: true,
            parentManagerId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const googleOAuthAccount = user.authAccounts[0];
    if (!googleOAuthAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'No Google OAuth token found. Please re-authenticate.' },
        { status: 400 }
      );
    }

    const googleAdsAccount = user.googleAdsAccounts[0];
    if (!googleAdsAccount) {
      return NextResponse.json({ error: 'Google Ads account not found' }, { status: 404 });
    }

    const result = await removeKeyword(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      adGroupId,
      keywordId,
      googleAdsAccount.parentManagerId || undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing keyword:', error);
    return NextResponse.json(
      { error: 'Failed to remove keyword', details: String(error) },
      { status: 500 }
    );
  }
}
