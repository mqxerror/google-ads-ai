'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-surface to-surface2">
      <div className="card p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text mb-2">Quick Ads AI</h1>
          <p className="text-text2">Sign in to manage your Google Ads campaigns</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
            {error === 'OAuthAccountNotLinked'
              ? 'This email is already linked to another account.'
              : error === 'AccessDenied'
              ? 'Access denied. Make sure you grant all required permissions.'
              : 'Authentication failed. Please try again.'}
          </div>
        )}

        <div className="space-y-4">
          {/* Google Sign In */}
          <button
            onClick={() => signIn('google', { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-lg border border-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>

          {/* Demo Mode */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-divider"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface text-text3">or</span>
            </div>
          </div>

          <button
            onClick={() => signIn('demo', { callbackUrl })}
            className="w-full px-4 py-3 bg-surface2 hover:bg-divider text-text2 font-medium rounded-lg transition-colors"
          >
            Continue with Demo Mode
          </button>
        </div>

        <p className="mt-6 text-xs text-text3 text-center">
          By signing in, you agree to grant Quick Ads AI read access to your Google Ads account data.
          We never make changes without your explicit approval.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-surface to-surface2">
        <div className="text-text2">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
