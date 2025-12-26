import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

// Demo mode check
export const isDemoMode = process.env.DEMO_MODE === 'true';

// Demo user
export const DEMO_USER = {
  id: 'demo-user',
  name: 'Demo User',
  email: 'demo@quickads.ai',
  image: null,
};

export const DEMO_SESSION: Session = {
  user: DEMO_USER,
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  accessToken: 'demo-token',
};

interface ExtendedJWT extends JWT {
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
  error?: string;
}

async function refreshAccessToken(token: ExtendedJWT): Promise<ExtendedJWT> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken!,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

const providers = isDemoMode
  ? [
      Credentials({
        id: 'demo',
        name: 'Demo',
        credentials: {},
        async authorize() {
          return DEMO_USER;
        },
      }),
    ]
  : [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            scope: 'openid email profile https://www.googleapis.com/auth/adwords',
            access_type: 'offline',
            prompt: 'select_account consent', // Force account picker every time
          },
        },
      }),
    ];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  callbacks: {
    async jwt({ token, account }) {
      const extToken = token as ExtendedJWT;

      if (account) {
        extToken.accessToken = account.access_token;
        extToken.refreshToken = account.refresh_token;
        extToken.expiresAt = account.expires_at;
        return extToken;
      }

      if (extToken.expiresAt && Date.now() < extToken.expiresAt * 1000 - 60000) {
        return extToken;
      }

      if (extToken.refreshToken) {
        return await refreshAccessToken(extToken);
      }

      return extToken;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      // Google Ads API requires refresh token, not access token
      session.refreshToken = token.refreshToken as string;
      if (token.error) {
        session.error = token.error as string;
      }

      // Fetch user's Google Ads account to populate customerId
      if (session.user?.email) {
        try {
          const { Pool } = await import('pg');
          const pool = new Pool({
            host: process.env.POSTGRES_HOST || '38.97.60.181',
            port: parseInt(process.env.POSTGRES_PORT || '5433'),
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'postgres123',
            database: process.env.POSTGRES_DB || 'google_ads_manager',
          });

          // First get the userId from the User table
          const userResult = await pool.query(
            'SELECT id FROM "User" WHERE email = $1 LIMIT 1',
            [session.user.email]
          );

          if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;

            // Then get the first Google Ads account (prefer non-manager accounts)
            const accountResult = await pool.query(
              `SELECT "googleAccountId", "accountName", "isManager", "parentManagerId"
               FROM "GoogleAdsAccount"
               WHERE "userId" = $1 AND status = 'connected'
               ORDER BY "isManager" ASC, "lastSyncAt" DESC NULLS LAST
               LIMIT 1`,
              [userId]
            );

            if (accountResult.rows.length > 0) {
              const account = accountResult.rows[0];
              session.customerId = account.googleAccountId;
              session.customerName = account.accountName;

              // If this account has a parent manager, set loginCustomerId
              if (account.parentManagerId) {
                session.loginCustomerId = account.parentManagerId;
              }
            }
          }

          await pool.end();
        } catch (error) {
          console.error('[Auth] Failed to fetch Google Ads account:', error);
          // Don't fail auth if account lookup fails
        }
      }

      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});
