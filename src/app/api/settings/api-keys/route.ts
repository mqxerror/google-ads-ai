/**
 * API Keys Settings Endpoint
 *
 * GET: Retrieve configured API keys (masked)
 * POST: Save an API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase';

// Simple encryption for API keys (in production, use proper encryption like AES-256-GCM)
function encryptKey(key: string): string {
  return Buffer.from(key).toString('base64');
}

function decryptKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated', keys: {} }, { status: 401 });
    }

    const keys: Record<string, string> = {};

    // Try to get from database
    try {
      const supabase = getSupabaseClient();
      const { data: settings } = await supabase
        .from('user_settings')
        .select('api_keys')
        .eq('user_email', session.user.email)
        .single();

      if (settings?.api_keys) {
        const stored = settings.api_keys as Record<string, string>;
        // Return masked keys to indicate they're configured
        for (const [key, value] of Object.entries(stored)) {
          if (value) {
            keys[key] = maskKey(decryptKey(value));
          }
        }
      }
    } catch (dbError) {
      // Database might not have the table yet - continue with env vars
      console.log('[API Keys] Database not available, using env vars only');
    }

    // Also check environment variables
    const envKeys: Record<string, string | undefined> = {
      moz_access_id: process.env.MOZ_ACCESS_ID,
      moz_secret_key: process.env.MOZ_SECRET_KEY,
      dataforseo_login: process.env.DATAFORSEO_LOGIN,
      dataforseo_password: process.env.DATAFORSEO_PASSWORD,
      semrush_api_key: process.env.SEMRUSH_API_KEY,
      openai_api_key: process.env.OPENAI_API_KEY,
      anthropic_api_key: process.env.ANTHROPIC_API_KEY,
    };

    for (const [key, value] of Object.entries(envKeys)) {
      if (value && !keys[key]) {
        keys[key] = maskKey(value) + ' (env)';
      }
    }

    return NextResponse.json({ keys, success: true });

  } catch (error) {
    console.error('[API Keys] GET Error:', error);
    return NextResponse.json({ error: 'Failed to load API keys', keys: {} }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated', success: false }, { status: 401 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: 'Key name is required', success: false }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Get existing settings
    const { data: existing } = await supabase
      .from('user_settings')
      .select('api_keys')
      .eq('user_email', session.user.email)
      .single();

    const currentKeys = (existing?.api_keys as Record<string, string>) || {};

    // Update the specific key
    if (value) {
      currentKeys[key] = encryptKey(value);
    } else {
      delete currentKeys[key];
    }

    // Upsert settings
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_email: session.user.email,
        api_keys: currentKeys,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email',
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API Keys] POST Error:', error);
    return NextResponse.json({ error: 'Failed to save API key', success: false }, { status: 500 });
  }
}
