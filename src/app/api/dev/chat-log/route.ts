/**
 * Dev Chat Log API
 * Parses the GPT conversation log for display in the dev chat UI
 *
 * NOTE: This endpoint is for development only and should be removed
 * before production deployment.
 */

import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CONVERSATION_FILE = join(
  process.cwd(),
  'logs',
  'gpt-conversations',
  'gpt-advisor-conversation.md'
);

interface ParsedMessage {
  id: number;
  timestamp: string;
  sender: 'claude' | 'gpt';
  content: string;
}

function parseConversationLog(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  // Split by message markers
  const messageBlocks = content.split(/---\s*\n\s*## Message #\d+/);

  messageBlocks.forEach((block, index) => {
    if (index === 0) return; // Skip header

    // Extract timestamp
    const timestampMatch = block.match(/— (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/);
    const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();

    // Extract Claude Code message
    const claudeMatch = block.match(/### Claude Code:\s*([\s\S]*?)(?=### Google Ads Designer GPT:|$)/);
    if (claudeMatch && claudeMatch[1].trim()) {
      messages.push({
        id: messages.length + 1,
        timestamp,
        sender: 'claude',
        content: claudeMatch[1].trim(),
      });
    }

    // Extract GPT response
    const gptMatch = block.match(/### Google Ads Designer GPT:\s*([\s\S]*?)$/);
    if (gptMatch && gptMatch[1].trim()) {
      messages.push({
        id: messages.length + 1,
        timestamp,
        sender: 'gpt',
        content: gptMatch[1].trim(),
      });
    }
  });

  return messages;
}

export async function GET() {
  try {
    if (!existsSync(CONVERSATION_FILE)) {
      return NextResponse.json({
        messages: [],
        fileExists: false,
        path: CONVERSATION_FILE,
      });
    }

    const content = readFileSync(CONVERSATION_FILE, 'utf-8');
    const messages = parseConversationLog(content);

    return NextResponse.json({
      messages,
      fileExists: true,
      path: CONVERSATION_FILE,
      totalMessages: messages.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to read log',
        messages: [],
      },
      { status: 500 }
    );
  }
}
