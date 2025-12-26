/**
 * Google Ads Designer GPT - API Endpoint
 *
 * Provides ongoing conversation with the GPT advisor.
 * All conversations are logged to logs/gpt-conversations/
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  chatWithGPTAdvisor,
  resetConversation,
  getConversationSummary,
  CONVERSATION_FILE,
} from '@/lib/gpt-advisor';

// POST: Send a message to the GPT advisor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, action } = body;

    // Handle special actions
    if (action === 'reset') {
      resetConversation();
      return NextResponse.json({
        success: true,
        message: 'Conversation reset. Starting fresh.',
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'summary') {
      const summary = getConversationSummary();
      return NextResponse.json({
        success: true,
        ...summary,
      });
    }

    // Regular message
    if (!message) {
      return NextResponse.json(
        { error: 'Missing message in request body' },
        { status: 400 }
      );
    }

    const result = await chatWithGPTAdvisor(message);

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[GPT Advisor] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET: Get conversation status
export async function GET() {
  const summary = getConversationSummary();

  return NextResponse.json({
    service: 'Google Ads Designer GPT',
    description: 'UX feedback and AI product strategy advisor',
    conversation: summary,
    usage: {
      send_message: {
        method: 'POST',
        body: { message: 'Your message here' },
      },
      reset_conversation: {
        method: 'POST',
        body: { action: 'reset' },
      },
      get_summary: {
        method: 'POST',
        body: { action: 'summary' },
      },
    },
    log_file: CONVERSATION_FILE,
  });
}
