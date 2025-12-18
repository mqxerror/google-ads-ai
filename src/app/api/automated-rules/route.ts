import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import type { AutomatedRule } from '@/types/rules';
import { validateRule, calculateNextRun } from '@/lib/rules-engine';

// In-memory storage for demo purposes (fallback if database fails)
// In production with proper database schema, this would not be needed
const rulesStore = new Map<string, AutomatedRule[]>();

// GET /api/automated-rules?accountId=xxx - Get all rules for an account
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  try {
    // Try to fetch from in-memory store first (for demo)
    const memoryRules = rulesStore.get(accountId);
    if (memoryRules) {
      return NextResponse.json({ rules: memoryRules });
    }

    // Fallback to empty array for demo
    return NextResponse.json({ rules: [] });
  } catch (error) {
    console.error('Error fetching automated rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rules', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/automated-rules - Create a new rule
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId, rule } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!rule) {
      return NextResponse.json({ error: 'Rule data is required' }, { status: 400 });
    }

    // Validate rule
    const validation = validateRule(rule);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid rule configuration', details: validation.errors },
        { status: 400 }
      );
    }

    // Create new rule with ID and timestamps
    const now = new Date().toISOString();
    const newRule: AutomatedRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountId,
      createdAt: now,
      updatedAt: now,
      nextRun: calculateNextRun(rule.schedule).toISOString(),
      executionHistory: [],
    };

    // Store rule in memory
    const accountRules = rulesStore.get(accountId) || [];
    accountRules.push(newRule);
    rulesStore.set(accountId, accountRules);

    return NextResponse.json({
      success: true,
      rule: newRule,
    });
  } catch (error) {
    console.error('Error creating automated rule:', error);
    return NextResponse.json(
      { error: 'Failed to create rule', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/automated-rules - Update a rule
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId, ruleId, updates } = body;

    if (!accountId || !ruleId) {
      return NextResponse.json({ error: 'accountId and ruleId are required' }, { status: 400 });
    }

    const accountRules = rulesStore.get(accountId);
    if (!accountRules) {
      return NextResponse.json({ error: 'No rules found for this account' }, { status: 404 });
    }

    const ruleIndex = accountRules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Update rule
    const updatedRule: AutomatedRule = {
      ...accountRules[ruleIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // If schedule changed, recalculate next run
    if (updates.schedule) {
      updatedRule.nextRun = calculateNextRun(
        updates.schedule,
        updatedRule.lastRun
      ).toISOString();
    }

    // Validate updated rule
    const validation = validateRule(updatedRule);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid rule configuration', details: validation.errors },
        { status: 400 }
      );
    }

    accountRules[ruleIndex] = updatedRule;
    rulesStore.set(accountId, accountRules);

    return NextResponse.json({
      success: true,
      rule: updatedRule,
    });
  } catch (error) {
    console.error('Error updating automated rule:', error);
    return NextResponse.json(
      { error: 'Failed to update rule', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/automated-rules?accountId=xxx&ruleId=xxx
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const ruleId = searchParams.get('ruleId');

  if (!accountId || !ruleId) {
    return NextResponse.json({ error: 'accountId and ruleId are required' }, { status: 400 });
  }

  try {
    const accountRules = rulesStore.get(accountId);
    if (!accountRules) {
      return NextResponse.json({ error: 'No rules found for this account' }, { status: 404 });
    }

    const filteredRules = accountRules.filter((r) => r.id !== ruleId);

    if (filteredRules.length === accountRules.length) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    rulesStore.set(accountId, filteredRules);

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting automated rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete rule', details: String(error) },
      { status: 500 }
    );
  }
}
