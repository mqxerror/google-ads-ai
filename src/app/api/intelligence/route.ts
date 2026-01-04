/**
 * Intelligence Projects API
 *
 * GET  /api/intelligence - List all projects
 * POST /api/intelligence - Create new project
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

// GET /api/intelligence - List all projects
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getPool();

    const result = await db.query(
      `SELECT
        ip.*,
        bd.status as brand_dna_detail_status,
        bd.full_report IS NOT NULL as has_brand_report,
        (SELECT COUNT(*) FROM audience_dna WHERE project_id = ip.id) as persona_count,
        (SELECT COUNT(*) FROM competitor_dna WHERE project_id = ip.id) as competitor_count
      FROM intelligence_projects ip
      LEFT JOIN brand_dna bd ON bd.project_id = ip.id
      WHERE ip.user_id = $1
      ORDER BY ip.created_at DESC`,
      [session.user.id]
    );

    return NextResponse.json({
      projects: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        brandName: row.brand_name,
        domain: row.domain,
        industry: row.industry,
        businessModel: row.business_model,
        status: row.status,
        brandDnaStatus: row.brand_dna_status,
        audienceDnaStatus: row.audience_dna_status,
        competitorDnaStatus: row.competitor_dna_status,
        hasBrandReport: row.has_brand_report,
        personaCount: parseInt(row.persona_count) || 0,
        competitorCount: parseInt(row.competitor_count) || 0,
        totalApiCost: parseFloat(row.total_api_cost) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Intelligence API] GET error:', error.message, error.stack);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/intelligence - Create new project
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, brandName, domain, industry, businessModel } = body;

    if (!name || !brandName) {
      return NextResponse.json(
        { error: 'Name and brandName are required' },
        { status: 400 }
      );
    }

    const db = getPool();

    // Create project
    const projectResult = await db.query(
      `INSERT INTO intelligence_projects (user_id, name, brand_name, domain, industry, business_model)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [session.user.id, name, brandName, domain || null, industry || null, businessModel || null]
    );

    const project = projectResult.rows[0];

    // Create empty brand_dna record
    await db.query(
      `INSERT INTO brand_dna (project_id)
       VALUES ($1)`,
      [project.id]
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
        createdAt: project.created_at,
      },
    });
  } catch (error: any) {
    console.error('[Intelligence API] POST error:', error);

    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A project with this name already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
