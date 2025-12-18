import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import prisma from './prisma';

// Extended JWT type with our custom properties
interface ExtendedJWT extends JWT {
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
  error?: string;
}

// Helper function to refresh Google OAuth tokens
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

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
      // Keep existing refresh token if new one not provided
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            'openid email profile https://www.googleapis.com/auth/adwords',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      const extToken = token as ExtendedJWT;

      // Initial sign in - persist tokens
      if (account) {
        extToken.accessToken = account.access_token;
        extToken.refreshToken = account.refresh_token;
        extToken.expiresAt = account.expires_at;
        return extToken;
      }

      // Return token if not expired (with 60 second buffer)
      if (extToken.expiresAt && Date.now() < extToken.expiresAt * 1000 - 60000) {
        return extToken;
      }

      // Token expired - attempt refresh
      if (extToken.refreshToken) {
        return await refreshAccessToken(extToken);
      }

      return extToken;
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string;
      // Expose error to client if refresh failed
      if (token.error) {
        session.error = token.error as string;
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
