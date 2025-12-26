/**
 * Google Ads Designer GPT - Advisor Integration
 *
 * Provides ongoing conversation with the Google Ads Designer GPT
 * for UX feedback, AI integration ideas, and product strategy.
 *
 * Features:
 * - Persistent conversation threads
 * - Full conversation history logging
 * - App context awareness
 */

import OpenAI from 'openai';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Paths
const LOG_DIR = join(process.cwd(), 'logs', 'gpt-conversations');
const CONVERSATION_FILE = join(LOG_DIR, 'gpt-advisor-conversation.md');
const THREAD_STATE_FILE = join(LOG_DIR, 'thread-state.json');

// The Google Ads Designer GPT System Prompt + App Context
const SYSTEM_PROMPT = `You are an expert SaaS UX evaluator and AI product strategist focused on analyzing visual interfaces for advertising technology. Your purpose is to review provided screenshots of a Google Ads–related SaaS product and deliver concrete, highly creative, and actionable recommendations that elevate the product into a category-defining, AI-native platform. You analyze only what is visible or clearly implied in the screenshots and avoid generic advice.

You emphasize inventive interaction patterns, expressive yet usable design systems, and deep AI integration across workflows. You treat AI not as a background automation layer but as an active creative partner embedded into decision-making, ideation, and execution. You translate advanced AI capabilities—such as generative systems, predictive intelligence, adaptive interfaces, and conversational guidance—into practical UX and product design recommendations.

Your feedback is structured, explicit, and grounded in the actual UI elements shown (layout, hierarchy, copy, controls, states, navigation, and visual emphasis). You identify missed opportunities, friction points, and moments where creativity or clarity could be amplified. When proposing ideas, you explain how they would appear and behave in the interface.

You balance ambition with usability. Even when proposing advanced AI-driven features, you ensure flows remain intuitive, progressive, and confidence-building for users. You favor progressive disclosure, contextual intelligence, and visual explanation over complexity.

If screenshots lack sufficient clarity, you make reasonable design assumptions and clearly label them as such. You do not request additional clarification unless absolutely necessary and instead bias toward constructive interpretation.

Your tone is confident, insightful, and product-focused, suitable for founders, product leaders, and senior designers seeking world-class differentiation.

---

## APP CONTEXT: Quick Ads AI

You are reviewing "Quick Ads AI" - a Google Ads management SaaS with the following characteristics:

**Core Value Prop:** "Stop wasting spend. Grow what works."

**Two Modes:**
- Monitor Mode (default): Single-page dashboard + AI assistant + one-click toggles
- Build Mode (optional): Smart Campaign Creator + keyword tools

**Current Features:**
- Campaign dashboard with AI Scores (0-100)
- Claude AI chat assistant for analysis
- One-click pause/enable campaigns
- Stats summary (Spend, Conversions, Active, Avg Score)

**Planned Features (v2):**
- Vector-powered semantic keyword search (pgvector)
- Savings-first negative keywords manager
- Smart Campaign Creator with landing page scanner
- Keyword clustering by semantic similarity

**Tech Stack:** Next.js 16, TypeScript, Tailwind, Supabase pgvector, Claude AI, OpenAI embeddings

**Design Philosophy:**
- Lead with savings/ROI, not technical features
- Progressive disclosure
- AI recommends, humans approve
- Smart without adding UI clutter

When Claude Code (the AI developer) shares work with you, provide feedback on:
1. UX/UI implications
2. AI integration opportunities
3. Creative differentiation ideas
4. Potential user friction points
5. How to make features feel "AI-native" not just "AI-powered"
`;

// Conversation message type
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

// Thread state
interface ThreadState {
  messages: Message[];
  lastUpdated: string;
  messageCount: number;
}

// Ensure directories exist
function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

// Load thread state
function loadThreadState(): ThreadState {
  ensureLogDir();
  if (existsSync(THREAD_STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(THREAD_STATE_FILE, 'utf-8'));
    } catch {
      // Corrupted file, start fresh
    }
  }
  return {
    messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    lastUpdated: new Date().toISOString(),
    messageCount: 0,
  };
}

// Save thread state
function saveThreadState(state: ThreadState): void {
  ensureLogDir();
  writeFileSync(THREAD_STATE_FILE, JSON.stringify(state, null, 2));
}

// Append to conversation log (Markdown)
function appendToConversationLog(
  userMessage: string,
  assistantResponse: string,
  messageNum: number
): void {
  ensureLogDir();

  const timestamp = new Date().toISOString();
  const entry = `
---

## Message #${messageNum} — ${timestamp}

### Claude Code:
${userMessage}

### Google Ads Designer GPT:
${assistantResponse}

`;

  // Create file with header if it doesn't exist
  if (!existsSync(CONVERSATION_FILE)) {
    const header = `# Google Ads Designer GPT — Conversation Log

**App:** Quick Ads AI
**Purpose:** UX feedback, AI integration ideas, product strategy
**Started:** ${timestamp}

---
`;
    writeFileSync(CONVERSATION_FILE, header);
  }

  // Append the new message
  const existing = readFileSync(CONVERSATION_FILE, 'utf-8');
  writeFileSync(CONVERSATION_FILE, existing + entry);
}

export interface GPTResponse {
  success: boolean;
  message: string;
  messageNumber: number;
  conversationLogPath: string;
}

/**
 * Send a message to the Google Ads Designer GPT
 * Maintains conversation context across calls
 */
export async function chatWithGPTAdvisor(message: string): Promise<GPTResponse> {
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      message: 'OpenAI API key not configured',
      messageNumber: 0,
      conversationLogPath: '',
    };
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Load existing conversation
  const state = loadThreadState();

  // Add user message
  state.messages.push({
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  });

  try {
    // Call OpenAI with full conversation history
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: state.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.7,
      max_tokens: 2000,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'No response';

    // Add assistant response to state
    state.messages.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: new Date().toISOString(),
    });

    state.messageCount++;
    state.lastUpdated = new Date().toISOString();

    // Save state
    saveThreadState(state);

    // Log to markdown file
    appendToConversationLog(message, assistantMessage, state.messageCount);

    return {
      success: true,
      message: assistantMessage,
      messageNumber: state.messageCount,
      conversationLogPath: CONVERSATION_FILE,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: errorMsg,
      messageNumber: state.messageCount,
      conversationLogPath: CONVERSATION_FILE,
    };
  }
}

/**
 * Reset the conversation (start fresh)
 */
export function resetConversation(): void {
  ensureLogDir();
  const freshState: ThreadState = {
    messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    lastUpdated: new Date().toISOString(),
    messageCount: 0,
  };
  saveThreadState(freshState);

  // Archive old conversation if exists
  if (existsSync(CONVERSATION_FILE)) {
    const archivePath = CONVERSATION_FILE.replace('.md', `-archived-${Date.now()}.md`);
    const content = readFileSync(CONVERSATION_FILE, 'utf-8');
    writeFileSync(archivePath, content);
  }
}

/**
 * Get conversation summary
 */
export function getConversationSummary(): {
  messageCount: number;
  lastUpdated: string;
  logPath: string;
} {
  const state = loadThreadState();
  return {
    messageCount: state.messageCount,
    lastUpdated: state.lastUpdated,
    logPath: CONVERSATION_FILE,
  };
}

// Export for API route
export { CONVERSATION_FILE };
