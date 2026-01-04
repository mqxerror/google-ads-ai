/**
 * Competitor DNA API
 *
 * POST /api/intelligence/[id]/competitor-dna - Discover and analyze competitors
 * GET  /api/intelligence/[id]/competitor-dna - Get competitor analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';
import { analyzeCompetitorDNA, isOpenRouterConfigured } from '@/lib/intelligence/competitor-dna';

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

// GET /api/intelligence/[id]/competitor-dna - Get competitors
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

    // Get all competitors for this project
    const competitorsResult = await db.query(
      `SELECT * FROM competitor_dna WHERE project_id = $1 ORDER BY position`,
      [id]
    );

    return NextResponse.json({
      competitors: competitorsResult.rows.map(row => ({
        id: row.id,
        position: row.position,
        competitorName: row.competitor_name,
        competitorDomain: row.competitor_domain,
        threatLevel: row.threat_level,
        brandPositioning: row.brand_positioning,
        uniqueValueProp: row.unique_value_prop,
        targetAudience: row.target_audience,
        contentStrategy: row.content_strategy?.summary || row.content_strategy || '',
        strengths: row.strengths,
        weaknesses: row.weaknesses,
        keyDifferentiators: row.key_differentiators,
        marketPosition: row.market_position,
        fullReport: row.full_report,
        status: row.status,
        apiCost: parseFloat(row.api_cost) || 0,
        modelUsed: row.model_used,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('[Competitor DNA API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competitors' },
      { status: 500 }
    );
  }
}

// POST /api/intelligence/[id]/competitor-dna - Analyze competitors
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
      `SELECT ip.*, bd.brand_positioning, bd.target_market,
              bd.unique_differentiators, bd.full_report,
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

    // Check if competitor DNA is already in progress
    if (project.competitor_dna_status === 'in_progress') {
      return NextResponse.json(
        { error: 'Competitor DNA analysis already in progress' },
        { status: 400 }
      );
    }

    // Update status to in_progress
    await db.query(
      `UPDATE intelligence_projects SET competitor_dna_status = 'in_progress', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Run analysis
    const result = await analyzeCompetitorDNA({
      projectId: id,
      brandName: project.brand_name,
      domain: project.domain || '',
      industry: project.industry || 'General',
      brandDna: {
        brandPositioning: project.brand_positioning,
        targetMarket: project.target_market,
        uniqueDifferentiators: project.unique_differentiators,
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
      competitorCount: result.competitors?.length || 0,
      competitors: result.competitors,
      cost: result.cost,
    });
  } catch (error) {
    console.error('[Competitor DNA API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze competitors', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
