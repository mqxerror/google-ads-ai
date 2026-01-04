/**
 * Unified Report API
 *
 * POST /api/intelligence/[id]/unified-report - Generate unified Brand Intelligence Report
 * GET  /api/intelligence/[id]/unified-report - Get existing report
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';
import { generateUnifiedReport, isOpenRouterConfigured } from '@/lib/intelligence/unified-report';

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

// GET /api/intelligence/[id]/unified-report - Get existing report
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

    // Get project with unified report
    const result = await db.query(
      `SELECT id, unified_report, unified_report_status
       FROM intelligence_projects
       WHERE id = $1 AND user_id = $2`,
      [id, session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = result.rows[0];

    return NextResponse.json({
      report: project.unified_report,
      status: project.unified_report_status || 'pending',
    });
  } catch (error) {
    console.error('[Unified Report API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

// POST /api/intelligence/[id]/unified-report - Generate unified report
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

    // Get project with all DNA data
    const projectResult = await db.query(
      `SELECT ip.*,
              bd.brand_positioning, bd.target_market, bd.brand_voice,
              bd.mission_vision, bd.brand_values, bd.unique_differentiators,
              bd.company_story, bd.full_report as brand_full_report
       FROM intelligence_projects ip
       LEFT JOIN brand_dna bd ON bd.project_id = ip.id
       WHERE ip.id = $1 AND ip.user_id = $2`,
      [id, session.user.id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Check prerequisites
    if (project.brand_dna_status !== 'completed') {
      return NextResponse.json(
        { error: 'Brand DNA must be completed first' },
        { status: 400 }
      );
    }

    if (project.audience_dna_status !== 'completed') {
      return NextResponse.json(
        { error: 'Audience DNA must be completed first' },
        { status: 400 }
      );
    }

    if (project.competitor_dna_status !== 'completed') {
      return NextResponse.json(
        { error: 'Competitor DNA must be completed first' },
        { status: 400 }
      );
    }

    // Get audience personas
    const audienceResult = await db.query(
      `SELECT * FROM audience_dna WHERE project_id = $1 ORDER BY position`,
      [id]
    );

    // Get competitors
    const competitorResult = await db.query(
      `SELECT * FROM competitor_dna WHERE project_id = $1 ORDER BY position`,
      [id]
    );

    // Update status to in_progress
    await db.query(
      `UPDATE intelligence_projects SET unified_report_status = 'in_progress', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Generate the unified report
    const result = await generateUnifiedReport({
      projectId: id,
      brandName: project.brand_name,
      domain: project.domain,
      industry: project.industry,
      brandDna: {
        brandPositioning: project.brand_positioning,
        targetMarket: project.target_market,
        brandVoice: project.brand_voice,
        missionVision: project.mission_vision,
        brandValues: project.brand_values,
        uniqueDifferentiators: project.unique_differentiators,
        companyStory: project.company_story,
        fullReport: project.brand_full_report,
      },
      personas: audienceResult.rows.map(row => ({
        personaName: row.persona_name,
        personaTitle: row.persona_title,
        demographics: row.demographics || {},
        lifeSituation: row.life_situation,
        painPoints: row.pain_points || [],
        goalsAspirations: row.goals_aspirations || [],
        purchaseMotivations: row.purchase_motivations || [],
        objections: row.objections || [],
        trustSignals: row.trust_signals || [],
        adCopyHooks: row.decision_factors?.adCopyHooks || [],
      })),
      competitors: competitorResult.rows.map(row => ({
        competitorName: row.competitor_name,
        competitorDomain: row.competitor_domain,
        threatLevel: row.threat_level,
        brandPositioning: row.brand_positioning,
        uniqueValueProp: row.unique_value_prop,
        strengths: row.strengths || [],
        weaknesses: row.weaknesses || [],
        keyDifferentiators: row.key_differentiators || [],
        marketPosition: row.market_position,
      })),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, cost: result.cost },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      report: result.report,
      executiveSummary: result.executiveSummary,
      cost: result.cost,
    });
  } catch (error) {
    console.error('[Unified Report API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
