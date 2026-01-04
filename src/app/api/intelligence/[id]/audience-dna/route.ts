/**
 * Audience DNA API
 *
 * POST /api/intelligence/[id]/audience-dna - Generate audience personas
 * GET  /api/intelligence/[id]/audience-dna - Get audience personas
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';
import { analyzeAudienceDNA, isOpenRouterConfigured } from '@/lib/intelligence/audience-dna';

// PostgreSQL connection
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || '38.97.60.181',
      port: parseInt(process.env.POSTGRES_PORT || '5433'),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres123',
      database: process.env.POSTGRES_DATABASE || 'google_ads_manager',
    });
  }
  return pool;
}

// GET /api/intelligence/[id]/audience-dna - Get audience personas
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const db = getPool();

    // Verify project ownership
    const projectResult = await db.query(
      `SELECT id FROM intelligence_projects WHERE id = $1 AND user_id = $2`,
      [id, session.user.id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all personas for this project
    const personasResult = await db.query(
      `SELECT * FROM audience_dna WHERE project_id = $1 ORDER BY position`,
      [id]
    );

    return NextResponse.json({
      personas: personasResult.rows.map(row => ({
        id: row.id,
        position: row.position,
        personaName: row.persona_name,
        personaTitle: row.persona_title,
        avatarEmoji: row.avatar_emoji,
        demographics: row.demographics,
        lifeSituation: row.life_situation,
        goalsAspirations: row.goals_aspirations,
        painPoints: row.pain_points,
        fearsAnxieties: row.fears_anxieties,
        valuesBeliefs: row.values_beliefs,
        behaviorPatterns: row.behavior_patterns,
        decisionFactors: row.decision_factors,
        purchaseMotivations: row.purchase_motivations,
        objections: row.objections,
        trustSignals: row.trust_signals,
        awarenessLevel: row.awareness_level,
        channels: row.channels,
        fullProfile: row.full_profile,
        status: row.status,
        apiCost: parseFloat(row.api_cost) || 0,
        modelUsed: row.model_used,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('[Audience DNA API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audience personas' },
      { status: 500 }
    );
  }
}

// POST /api/intelligence/[id]/audience-dna - Generate audience personas
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if OpenRouter API is configured
    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        {
          error: 'OpenRouter API key not configured',
          details: 'Please add OPENROUTER_API_KEY to your .env.local file',
        },
        { status: 400 }
      );
    }

    const { id } = await params;
    const db = getPool();

    // Get project with Brand DNA
    const projectResult = await db.query(
      `SELECT ip.*, bd.mission_vision, bd.brand_positioning, bd.target_market,
              bd.brand_voice, bd.unique_differentiators, bd.brand_values, bd.full_report,
              bd.status as brand_dna_status
       FROM intelligence_projects ip
       LEFT JOIN brand_dna bd ON bd.project_id = ip.id
       WHERE ip.id = $1 AND ip.user_id = $2`,
      [id, session.user.id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Check if Brand DNA is completed
    if (project.brand_dna_status !== 'completed') {
      return NextResponse.json(
        { error: 'Brand DNA must be completed first', brandDnaStatus: project.brand_dna_status },
        { status: 400 }
      );
    }

    // Check if audience DNA is already in progress
    if (project.audience_dna_status === 'in_progress') {
      return NextResponse.json(
        { error: 'Audience DNA analysis already in progress' },
        { status: 400 }
      );
    }

    // Update status to in_progress
    await db.query(
      `UPDATE intelligence_projects SET audience_dna_status = 'in_progress', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Run analysis
    const result = await analyzeAudienceDNA({
      projectId: id,
      brandName: project.brand_name,
      brandDna: {
        missionVision: project.mission_vision,
        brandPositioning: project.brand_positioning,
        targetMarket: project.target_market,
        brandVoice: project.brand_voice,
        uniqueDifferentiators: project.unique_differentiators,
        brandValues: project.brand_values,
        fullReport: project.full_report,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, cost: result.cost },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      personaCount: result.personas?.length || 0,
      personas: result.personas,
      cost: result.cost,
    });
  } catch (error) {
    console.error('[Audience DNA API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate audience personas', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
