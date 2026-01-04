/**
 * Single Intelligence Project API
 *
 * GET    /api/intelligence/[id] - Get project with all DNA data
 * DELETE /api/intelligence/[id] - Delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';

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

// GET /api/intelligence/[id] - Get full project with all DNA
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

    // Get project
    const projectResult = await db.query(
      `SELECT * FROM intelligence_projects WHERE id = $1 AND user_id = $2`,
      [id, session.user.id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Get brand DNA
    const brandDnaResult = await db.query(
      `SELECT * FROM brand_dna WHERE project_id = $1`,
      [id]
    );
    const brandDna = brandDnaResult.rows[0] || null;

    // Get audience DNA (personas)
    const audienceDnaResult = await db.query(
      `SELECT * FROM audience_dna WHERE project_id = $1 ORDER BY position`,
      [id]
    );

    // Get competitor DNA
    const competitorDnaResult = await db.query(
      `SELECT * FROM competitor_dna WHERE project_id = $1 ORDER BY position`,
      [id]
    );

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        brandName: project.brand_name,
        domain: project.domain,
        industry: project.industry,
        businessModel: project.business_model,
        status: project.status,
        brandDnaStatus: project.brand_dna_status,
        audienceDnaStatus: project.audience_dna_status,
        competitorDnaStatus: project.competitor_dna_status,
        unifiedReportStatus: project.unified_report_status || 'pending',
        unifiedReport: project.unified_report || null,
        totalApiCost: parseFloat(project.total_api_cost) || 0,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      },
      brandDna: brandDna ? {
        id: brandDna.id,
        status: brandDna.status,
        currentStep: brandDna.current_step || 'idle',
        stepProgress: brandDna.step_progress || 0,
        stepMessage: brandDna.step_message || null,
        stepsLog: brandDna.steps_log || [],
        modelUsed: brandDna.model_used || null,
        missionVision: brandDna.mission_vision,
        brandValues: brandDna.brand_values,
        brandPositioning: brandDna.brand_positioning,
        uniqueDifferentiators: brandDna.unique_differentiators,
        targetMarket: brandDna.target_market,
        brandVoice: brandDna.brand_voice,
        companyStory: brandDna.company_story,
        keyMilestones: brandDna.key_milestones,
        brandKeywords: brandDna.brand_keywords,
        fullReport: brandDna.full_report,
        errorMessage: brandDna.error_message,
        apiCost: parseFloat(brandDna.api_cost) || 0,
        createdAt: brandDna.created_at,
        updatedAt: brandDna.updated_at,
      } : null,
      audienceDna: audienceDnaResult.rows.map(row => ({
        id: row.id,
        personaName: row.persona_name,
        personaTitle: row.persona_title,
        avatarEmoji: row.avatar_emoji,
        position: row.position,
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
      })),
      competitorDna: competitorDnaResult.rows.map(row => ({
        id: row.id,
        competitorName: row.competitor_name,
        competitorDomain: row.competitor_domain,
        threatLevel: row.threat_level,
        position: row.position,
        brandPositioning: row.brand_positioning,
        uniqueValueProp: row.unique_value_prop,
        targetAudience: row.target_audience,
        tagline: row.tagline,
        contentStrategy: row.content_strategy?.summary || row.content_strategy || '',
        pillarPages: row.pillar_pages,
        domainAuthority: row.domain_authority,
        monthlyTraffic: row.monthly_traffic,
        keywordOverlap: row.keyword_overlap,
        topKeywords: row.top_keywords,
        strengths: row.strengths,
        weaknesses: row.weaknesses,
        keyDifferentiators: row.key_differentiators,
        marketPosition: row.market_position,
        opportunities: row.opportunities,
        threats: row.threats,
        fullReport: row.full_report,
        status: row.status,
        apiCost: parseFloat(row.api_cost) || 0,
        modelUsed: row.model_used,
      })),
    });
  } catch (error) {
    console.error('[Intelligence API] GET [id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// DELETE /api/intelligence/[id] - Delete project
export async function DELETE(
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

    const result = await db.query(
      `DELETE FROM intelligence_projects WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Intelligence API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
