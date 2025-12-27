/**
 * API Keys Test Endpoint
 *
 * POST: Test API connection for configured keys
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchSearchIntent, fetchUrlMetrics } from '@/lib/moz';

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { apiId } = body;

    let result: TestResult;

    switch (apiId) {
      case 'moz':
        result = await testMozApi();
        break;
      case 'openai':
        result = await testOpenAiApi();
        break;
      case 'anthropic':
        result = await testAnthropicApi();
        break;
      case 'dataforseo':
        result = await testDataForSeoApi();
        break;
      case 'deepseek':
        result = await testDeepSeekApi();
        break;
      default:
        result = { success: false, message: `Unknown API: ${apiId}` };
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('[API Test] Error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Test failed',
    }, { status: 500 });
  }
}

async function testMozApi(): Promise<TestResult> {
  try {
    const token = process.env.MOZ_API_TOKEN;
    if (!token) {
      return { success: false, message: 'Moz API token not configured' };
    }

    // Test keyword intent endpoint
    const intentResult = await fetchSearchIntent('running shoes', { token });

    if (intentResult.error) {
      // Try URL metrics as fallback
      const urlResult = await fetchUrlMetrics(['moz.com'], token);
      if (urlResult && urlResult.length > 0) {
        return {
          success: true,
          message: `URL Metrics working! DA: ${urlResult[0].domain_authority}. Intent endpoint: ${intentResult.error}`,
          data: { urlMetrics: urlResult[0], intent: intentResult },
        };
      }
      return { success: false, message: intentResult.error };
    }

    return {
      success: true,
      message: `Intent API working! "running shoes" → ${intentResult.primaryIntent} (${Math.round(intentResult.confidence * 100)}% confidence)`,
      data: intentResult,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Moz API test failed',
    };
  }
}

async function testOpenAiApi(): Promise<TestResult> {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return { success: false, message: 'OpenAI API key not configured' };
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'test',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'OpenAI API error' };
    }

    const data = await response.json();
    return {
      success: true,
      message: `Embeddings working! Vector dimension: ${data.data[0].embedding.length}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'OpenAI API test failed',
    };
  }
}

async function testAnthropicApi(): Promise<TestResult> {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return { success: false, message: 'Anthropic API key not configured' };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say OK' }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Anthropic API error' };
    }

    return {
      success: true,
      message: 'Claude API working!',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Anthropic API test failed',
    };
  }
}

async function testDataForSeoApi(): Promise<TestResult> {
  try {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return { success: false, message: 'DataForSEO credentials not configured' };
    }

    const auth = Buffer.from(`${login}:${password}`).toString('base64');

    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        keyword: 'test',
        location_code: 2840,
        language_code: 'en',
        depth: 1,
      }]),
    });

    const data = await response.json();

    if (data.status_code !== 20000) {
      return { success: false, message: data.status_message || 'DataForSEO API error' };
    }

    return {
      success: true,
      message: `DataForSEO working! Credits: ${data.cost || 'N/A'}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'DataForSEO API test failed',
    };
  }
}

async function testDeepSeekApi(): Promise<TestResult> {
  try {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      return { success: false, message: 'DeepSeek API key not configured' };
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'DeepSeek API error' };
    }

    return {
      success: true,
      message: 'DeepSeek API working!',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'DeepSeek API test failed',
    };
  }
}
