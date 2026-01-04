/**
 * Brand DNA API
 *
 * POST /api/intelligence/[id]/brand-dna - Start brand DNA analysis
 * GET  /api/intelligence/[id]/brand-dna - Get brand DNA report
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';
import { analyzeBrandDNA, isOpenRouterConfigured, isCrawl4AIConfigured } from '@/lib/intelligence/brand-dna';

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

// GET /api/intelligence/[id]/brand-dna - Get brand DNA report
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
      `SELECT id, brand_name, domain, industry FROM intelligence_projects
       WHERE id = $1 AND user_id = $2`,
      [id, session.user.id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get brand DNA
    const brandDnaResult = await db.query(
      `SELECT * FROM brand_dna WHERE project_id = $1`,
      [id]
    );

    if (brandDnaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Brand DNA not found' }, { status: 404 });
    }

    const row = brandDnaResult.rows[0];

    return NextResponse.json({
      brandDna: {
        id: row.id,
        projectId: row.project_id,
        status: row.status,
        missionVision: row.mission_vision,
        brandValues: row.brand_values,
        brandPositioning: row.brand_positioning,
        uniqueDifferentiators: row.unique_differentiators,
        targetMarket: row.target_market,
        brandVoice: row.brand_voice,
        companyStory: row.company_story,
        keyMilestones: row.key_milestones,
        brandKeywords: row.brand_keywords,
        fullReport: row.full_report,
        errorMessage: row.error_message,
        apiCost: parseFloat(row.api_cost) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('[Brand DNA API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brand DNA' },
      { status: 500 }
    );
  }
}

// POST /api/intelligence/[id]/brand-dna - Start brand DNA analysis
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if OpenRouter is configured
    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        {
          error: 'OpenRouter API key not configured',
          details: 'Please add OPENROUTER_API_KEY to your .env.local file. Get your key at https://openrouter.ai/keys',
        },
        { status: 400 }
      );
    }

    const { id } = await params;
    const db = getPool();

    // Get project
    const projectResult = await db.query(
      `SELECT id, brand_name, domain, industry FROM intelligence_projects
       WHERE id = $1 AND user_id = $2`,
      [id, session.user.id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Check if analysis is already in progress
    const existingResult = await db.query(
      `SELECT status FROM brand_dna WHERE project_id = $1`,
      [id]
    );

    if (existingResult.rows.length > 0) {
      const status = existingResult.rows[0].status;
      if (status === 'researching' || status === 'scraping' || status === 'analyzing') {
        return NextResponse.json(
          { error: 'Analysis already in progress', status },
          { status: 400 }
        );
      }
    }

    // Reset status and start analysis
    await db.query(
      `UPDATE brand_dna SET status = 'pending', error_message = NULL WHERE project_id = $1`,
      [id]
    );

    // Run analysis (this will take a few seconds)
    const result = await analyzeBrandDNA({
      projectId: id,
      brandName: project.brand_name,
      domain: project.domain,
      industry: project.industry,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, cost: result.cost },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      brandDnaId: result.brandDnaId,
      report: result.report,
      cost: result.cost,
    });
  } catch (error) {
    console.error('[Brand DNA API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to start brand DNA analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
