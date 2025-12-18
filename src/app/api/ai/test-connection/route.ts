import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// POST /api/ai/test-connection - Test LLM provider connection
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, apiKey } = body as {
      provider: 'anthropic' | 'openai';
      apiKey: string;
    };

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    // Don't test with masked keys
    if (apiKey.includes('••••')) {
      return NextResponse.json(
        { error: 'Please enter a valid API key (not masked)' },
        { status: 400 }
      );
    }

    let result: { success: boolean; message: string; model?: string };

    if (provider === 'anthropic') {
      result = await testAnthropicConnection(apiKey);
    } else if (provider === 'openai') {
      result = await testOpenAIConnection(apiKey);
    } else {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection test failed' },
      { status: 500 }
    );
  }
}

async function testAnthropicConnection(apiKey: string): Promise<{
  success: boolean;
  message: string;
  model?: string;
}> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'Say "connected" in one word.' },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Successfully connected to Anthropic API',
        model: data.model || 'claude-3-5-sonnet-20241022',
      };
    }

    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

    if (response.status === 401) {
      return {
        success: false,
        message: 'Invalid API key. Please check your Anthropic API key.',
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        message: 'Rate limited. Please try again in a moment.',
      };
    }

    return {
      success: false,
      message: `Anthropic API error: ${errorMessage}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function testOpenAIConnection(apiKey: string): Promise<{
  success: boolean;
  message: string;
  model?: string;
}> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'Say "connected" in one word.' },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Successfully connected to OpenAI API',
        model: data.model || 'gpt-4o',
      };
    }

    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

    if (response.status === 401) {
      return {
        success: false,
        message: 'Invalid API key. Please check your OpenAI API key.',
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        message: 'Rate limited. Please try again in a moment.',
      };
    }

    return {
      success: false,
      message: `OpenAI API error: ${errorMessage}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
