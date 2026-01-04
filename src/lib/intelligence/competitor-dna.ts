/**
 * Competitor DNA Analyzer
 *
 * Discovers and analyzes top 3 competitors based on Brand DNA.
 * Uses Claude via OpenRouter for comprehensive competitive intelligence.
 * Cost: ~$0.15-0.25 per analysis
 */

import { Pool } from 'pg';
import { callAI, getDefaultModel, isOpenRouterConfigured } from './ai-models';

// Types
export interface Competitor {
  name: string;
  website: string;
  domain: string;
  rationale: string;
  threatLevel: 'direct' | 'indirect' | 'emerging';
  position: number;
}

export interface CompetitorIntelligence {
  contentStrategy: string;
  brandPositioning: string;
  uniqueValueProp: string;
  targetAudience: string;
  strengths: string[];
  weaknesses: string[];
  keyDifferentiators: string[];
  marketPosition: string;
}

export interface CompetitorAnalysis {
  competitor: Competitor;
  intelligence: CompetitorIntelligence;
  seoMetrics?: {
    estimatedTraffic: number;
    domainAuthority: number;
    topKeywords: string[];
  };
}

export interface CompetitorDNAInput {
  projectId: string;
  brandName: string;
  domain: string;
  industry: string;
  brandDna: {
    brandPositioning?: string;
    targetMarket?: string;
    uniqueDifferentiators?: string[];
    fullReport?: string;
  };
}

export interface CompetitorDNAResult {
  success: boolean;
  competitors?: CompetitorAnalysis[];
  fullReport?: string;
  error?: string;
  cost: number;
}

// Database connection
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || '38.97.60.181',
      port: parseInt(process.env.POSTGRES_PORT || '5433'),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres123',
      database: process.env.POSTGRES_DB || 'google_ads_manager',
    });
  }
  return pool;
}

// Step tracking
interface StepLog {
  step: string;
  status: 'started' | 'completed' | 'failed';
  message: string;
  timestamp: string;
  duration_ms?: number;
}

function logStep(
  stepsLog: StepLog[],
  step: string,
  status: 'started' | 'completed' | 'failed',
  message: string,
  startTime?: number
): StepLog[] {
  const entry: StepLog = {
    step,
    status,
    message,
    timestamp: new Date().toISOString(),
  };
  if (startTime && status !== 'started') {
    entry.duration_ms = Date.now() - startTime;
  }
  return [...stepsLog.filter(s => !(s.step === step && s.status === 'started')), entry];
}

async function updateStep(
  db: Pool,
  projectId: string,
  step: string,
  progress: number,
  message: string
) {
  await db.query(
    `UPDATE intelligence_projects SET
      competitor_dna_status = CASE
        WHEN $2 = 'completed' THEN 'completed'
        WHEN $2 = 'failed' THEN 'failed'
        ELSE 'in_progress'
      END,
      updated_at = NOW()
    WHERE id = $1`,
    [projectId, step]
  );
  console.log(`[Competitor DNA] Step: ${step} (${progress}%) - ${message}`);
}

// Re-export for API
export { isOpenRouterConfigured };

/**
 * Main Competitor DNA Analysis Function
 */
export async function analyzeCompetitorDNA(input: CompetitorDNAInput): Promise<CompetitorDNAResult> {
  const db = getPool();
  let totalCost = 0;
  let stepsLog: StepLog[] = [];
  let stepStartTime = Date.now();
  let modelUsed = '';

  console.log(`[Competitor DNA] Starting analysis for project ${input.projectId}`);

  try {
    // ========== STEP 1: INITIALIZING ==========
    stepsLog = logStep(stepsLog, 'initializing', 'started', 'Preparing competitor discovery');
    await updateStep(db, input.projectId, 'initializing', 5, 'Initializing...');

    if (!isOpenRouterConfigured()) {
      throw new Error('OpenRouter API key not configured. Please add OPENROUTER_API_KEY to .env.local');
    }

    // Delete existing competitors for this project
    await db.query('DELETE FROM competitor_dna WHERE project_id = $1', [input.projectId]);

    stepsLog = logStep(stepsLog, 'initializing', 'completed', 'Ready to discover', stepStartTime);
    await updateStep(db, input.projectId, 'initializing', 10, 'Initialization complete');

    // ========== STEP 2: DISCOVER COMPETITORS ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'discovering', 'started', 'Finding competitors');
    await updateStep(db, input.projectId, 'discovering', 15, 'Discovering competitors...');

    const model = getDefaultModel('competitorDna');
    modelUsed = model.name;

    // Build discovery prompt
    const discoveryPrompt = buildDiscoveryPrompt(input);
    console.log(`[Competitor DNA] Calling ${model.name} for competitor discovery...`);

    const discoveryResponse = await callAI(model.id, discoveryPrompt, { maxTokens: 4000 });
    totalCost += discoveryResponse.cost;

    // Parse competitors
    const competitors = parseCompetitors(discoveryResponse.text);
    console.log(`[Competitor DNA] Discovered ${competitors.length} competitors`);

    stepsLog = logStep(stepsLog, 'discovering', 'completed', `Found ${competitors.length} competitors`, stepStartTime);
    await updateStep(db, input.projectId, 'discovering', 35, `Discovered ${competitors.length} competitors`);

    // ========== STEP 3: ANALYZE EACH COMPETITOR ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'analyzing', 'started', 'Analyzing competitors');
    await updateStep(db, input.projectId, 'analyzing', 40, 'Analyzing competitor intelligence...');

    const competitorAnalyses: CompetitorAnalysis[] = [];

    for (let i = 0; i < competitors.length; i++) {
      const competitor = competitors[i];
      console.log(`[Competitor DNA] Analyzing ${competitor.name} (${i + 1}/${competitors.length})...`);

      const analysisPrompt = buildAnalysisPrompt(input, competitor);
      const analysisResponse = await callAI(model.id, analysisPrompt, { maxTokens: 3000 });
      totalCost += analysisResponse.cost;

      const intelligence = parseIntelligence(analysisResponse.text);

      competitorAnalyses.push({
        competitor,
        intelligence,
      });

      const progress = 40 + Math.round((i + 1) / competitors.length * 30);
      await updateStep(db, input.projectId, 'analyzing', progress, `Analyzed ${competitor.name}`);
    }

    stepsLog = logStep(stepsLog, 'analyzing', 'completed', 'All competitors analyzed', stepStartTime);
    await updateStep(db, input.projectId, 'analyzing', 70, 'Competitor analysis complete');

    // ========== STEP 4: GENERATE REPORT ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'generating_report', 'started', 'Creating competitive report');
    await updateStep(db, input.projectId, 'generating_report', 75, 'Generating competitive intelligence report...');

    const reportPrompt = buildReportPrompt(input, competitorAnalyses);
    const reportResponse = await callAI(model.id, reportPrompt, { maxTokens: 6000 });
    totalCost += reportResponse.cost;

    const fullReport = reportResponse.text;

    stepsLog = logStep(stepsLog, 'generating_report', 'completed', 'Report generated', stepStartTime);
    await updateStep(db, input.projectId, 'generating_report', 85, 'Report generated');

    // ========== STEP 5: SAVE TO DATABASE ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'saving', 'started', 'Saving to database');
    await updateStep(db, input.projectId, 'saving', 90, 'Saving competitor data...');

    // Save each competitor
    for (let i = 0; i < competitorAnalyses.length; i++) {
      const { competitor, intelligence } = competitorAnalyses[i];
      await db.query(
        `INSERT INTO competitor_dna (
          project_id, position, competitor_name, competitor_domain, threat_level,
          brand_positioning, unique_value_prop, target_audience,
          content_strategy, strengths, weaknesses, key_differentiators,
          market_position, full_report, status, api_cost, model_used
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          'completed', $15, $16
        )`,
        [
          input.projectId,
          i + 1,
          competitor.name,
          competitor.domain,
          competitor.threatLevel,
          intelligence.brandPositioning,
          intelligence.uniqueValueProp,
          intelligence.targetAudience,
          JSON.stringify({ summary: intelligence.contentStrategy }), // content_strategy is JSONB
          JSON.stringify(intelligence.strengths),
          JSON.stringify(intelligence.weaknesses),
          JSON.stringify(intelligence.keyDifferentiators),
          intelligence.marketPosition,
          i === 0 ? fullReport : null, // Store full report only on first competitor
          totalCost / competitorAnalyses.length,
          modelUsed,
        ]
      );
    }

    // Update project status
    await db.query(
      `UPDATE intelligence_projects SET
        competitor_dna_status = 'completed',
        total_api_cost = total_api_cost + $2,
        updated_at = NOW()
      WHERE id = $1`,
      [input.projectId, totalCost]
    );

    stepsLog = logStep(stepsLog, 'saving', 'completed', 'Competitors saved', stepStartTime);
    stepsLog = logStep(stepsLog, 'completed', 'completed', 'Competitor DNA complete');
    await updateStep(db, input.projectId, 'completed', 100, 'Competitor DNA complete');

    console.log(`[Competitor DNA] Analysis complete. Analyzed ${competitorAnalyses.length} competitors. Total cost: $${totalCost.toFixed(4)}`);

    return {
      success: true,
      competitors: competitorAnalyses,
      fullReport,
      cost: totalCost,
    };

  } catch (error) {
    console.error('[Competitor DNA] Error:', error);

    await db.query(
      `UPDATE intelligence_projects SET
        competitor_dna_status = 'failed',
        updated_at = NOW()
      WHERE id = $1`,
      [input.projectId]
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      cost: totalCost,
    };
  }
}

/**
 * Build the discovery prompt to find top 3 competitors
 */
function buildDiscoveryPrompt(input: CompetitorDNAInput): string {
  const differentiators = input.brandDna.uniqueDifferentiators?.join('\n- ') || 'Not specified';

  return `## SITUATION
You are an expert competitive intelligence analyst with deep expertise in market research and competitor identification. You specialize in finding the most relevant competitors for businesses.

## TASK
Identify the TOP 3 most relevant competitors for "${input.brandName}" (${input.domain}) in the ${input.industry} industry.

## OBJECTIVE
Find competitors that:
1. Have similar business models
2. Target the same or overlapping customer segments
3. Compete for similar keywords and market share
4. Pose the most significant competitive threat

## KNOWLEDGE PROVIDED

### Brand Positioning:
${input.brandDna.brandPositioning || 'Not specified'}

### Target Market:
${input.brandDna.targetMarket || 'Not specified'}

### Unique Differentiators:
- ${differentiators}

### Brand DNA Summary (first 2000 chars):
${input.brandDna.fullReport?.slice(0, 2000) || 'Not available'}

## OUTPUT FORMAT
Return ONLY a valid JSON array with exactly 3 competitor objects. No markdown, no explanation, just the JSON array.

[
  {
    "name": "Company Name",
    "website": "https://example.com",
    "rationale": "Detailed explanation of why they are a relevant competitor (2-3 sentences)",
    "threatLevel": "direct" | "indirect" | "emerging"
  }
]

## SELECTION CRITERIA
1. **Direct competitors** (threatLevel: "direct"): Same products/services, same target market
2. **Indirect competitors** (threatLevel: "indirect"): Different approach but solving same problem
3. **Emerging competitors** (threatLevel: "emerging"): New players disrupting the market

IMPORTANT:
- Each competitor must be unique (no duplicates)
- Provide real, verifiable companies with actual websites
- Focus on competitors most likely to appear in the same search results
- Consider both local and global competitors relevant to this market

Return ONLY the JSON array, starting with [ and ending with ]`;
}

/**
 * Build prompt to analyze a specific competitor
 */
function buildAnalysisPrompt(input: CompetitorDNAInput, competitor: Competitor): string {
  return `## SITUATION
You are an expert competitive intelligence analyst performing deep analysis on a specific competitor.

## TASK
Analyze "${competitor.name}" (${competitor.website}) as a competitor to "${input.brandName}" in the ${input.industry} industry.

## COMPETITOR CONTEXT
- Threat Level: ${competitor.threatLevel}
- Selection Rationale: ${competitor.rationale}

## ANALYSIS REQUIRED
Provide comprehensive intelligence on this competitor covering:

1. **Brand Positioning**: How do they position themselves in the market?
2. **Unique Value Proposition**: What's their main selling point?
3. **Target Audience**: Who are they targeting?
4. **Content Strategy**: What type of content do they create?
5. **Strengths**: What do they do well? (list 3-5)
6. **Weaknesses**: Where are their gaps? (list 3-5)
7. **Key Differentiators**: What makes them unique? (list 3-5)
8. **Market Position**: Leader/Challenger/Niche/Emerging

## OUR BRAND CONTEXT
Brand: ${input.brandName}
Positioning: ${input.brandDna.brandPositioning || 'Not specified'}
Target Market: ${input.brandDna.targetMarket || 'Not specified'}

## OUTPUT FORMAT
Return ONLY a valid JSON object with this structure:

{
  "brandPositioning": "Their market positioning statement",
  "uniqueValueProp": "Their main value proposition",
  "targetAudience": "Description of their target audience",
  "contentStrategy": "Overview of their content approach",
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
  "keyDifferentiators": ["Differentiator 1", "Differentiator 2", "Differentiator 3"],
  "marketPosition": "Leader/Challenger/Niche/Emerging"
}

Return ONLY the JSON object, starting with { and ending with }`;
}

/**
 * Build prompt for the final competitive intelligence report
 */
function buildReportPrompt(input: CompetitorDNAInput, analyses: CompetitorAnalysis[]): string {
  const competitorSummaries = analyses.map((a, i) => `
### Competitor ${i + 1}: ${a.competitor.name}
- Website: ${a.competitor.website}
- Threat Level: ${a.competitor.threatLevel}
- Positioning: ${a.intelligence.brandPositioning}
- Value Prop: ${a.intelligence.uniqueValueProp}
- Strengths: ${a.intelligence.strengths.join(', ')}
- Weaknesses: ${a.intelligence.weaknesses.join(', ')}
`).join('\n');

  return `## SITUATION
You are an elite competitive intelligence strategist creating a comprehensive competitor analysis report.

## TASK
Create a strategic Competitor DNA report for "${input.brandName}" based on analysis of their top 3 competitors.

## COMPETITOR INTELLIGENCE
${competitorSummaries}

## OUR BRAND CONTEXT
Brand: ${input.brandName}
Industry: ${input.industry}
Positioning: ${input.brandDna.brandPositioning || 'Not specified'}
Target Market: ${input.brandDna.targetMarket || 'Not specified'}

## REPORT REQUIREMENTS
Create a comprehensive markdown report with these sections:

# Competitor DNA Report for ${input.brandName}

## Executive Summary
Brief overview of competitive landscape and key findings.

## Competitive Landscape Overview
- Market positioning map
- Threat assessment summary
- Key competitive dynamics

## Competitor Profiles

### [Competitor 1 Name]
- **Threat Level**: Direct/Indirect/Emerging
- **Brand Positioning**: ...
- **Unique Value Proposition**: ...
- **Target Audience**: ...
- **Content Strategy**: ...
- **Key Strengths**: (bullet points)
- **Key Weaknesses**: (bullet points)

(Repeat for each competitor)

## Competitive Gap Analysis
- Where competitors are strong that we're weak
- Where we're strong that competitors are weak
- Untapped opportunities

## Strategic Recommendations
1. **Differentiation Opportunities**: How to stand out
2. **Content Gaps to Exploit**: Topics competitors miss
3. **Positioning Adjustments**: How to better position against competitors
4. **Competitive Advantages**: Our unique strengths to emphasize

## Key Takeaways
- Top 3-5 actionable insights

---
*Generated with Competitor DNA Analysis*

IMPORTANT:
- Use bullet points and clear formatting
- Be specific and actionable
- Focus on strategic insights, not just descriptions
- Highlight opportunities for ${input.brandName}`;
}

/**
 * Parse competitors from AI response
 */
function parseCompetitors(responseText: string): Competitor[] {
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid competitors array');
    }

    return parsed.map((c: any, i: number) => ({
      name: c.name || 'Unknown',
      website: c.website || '',
      domain: extractDomain(c.website || ''),
      rationale: c.rationale || '',
      threatLevel: normalizeThreatLevel(c.threatLevel || c.threat_level),
      position: i + 1,
    }));
  } catch (error) {
    console.error('[Competitor DNA] Failed to parse competitors:', error);
    throw new Error('Failed to parse competitor discovery response');
  }
}

/**
 * Parse intelligence from AI response
 */
function parseIntelligence(responseText: string): CompetitorIntelligence {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      brandPositioning: parsed.brandPositioning || parsed.brand_positioning || '',
      uniqueValueProp: parsed.uniqueValueProp || parsed.unique_value_prop || '',
      targetAudience: parsed.targetAudience || parsed.target_audience || '',
      contentStrategy: parsed.contentStrategy || parsed.content_strategy || '',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      keyDifferentiators: Array.isArray(parsed.keyDifferentiators || parsed.key_differentiators)
        ? (parsed.keyDifferentiators || parsed.key_differentiators)
        : [],
      marketPosition: parsed.marketPosition || parsed.market_position || 'Unknown',
    };
  } catch (error) {
    console.error('[Competitor DNA] Failed to parse intelligence:', error);
    return {
      brandPositioning: '',
      uniqueValueProp: '',
      targetAudience: '',
      contentStrategy: '',
      strengths: [],
      weaknesses: [],
      keyDifferentiators: [],
      marketPosition: 'Unknown',
    };
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    return domain || url;
  } catch {
    return url;
  }
}

/**
 * Normalize threat level to database constraint values
 */
function normalizeThreatLevel(level: string): 'direct' | 'indirect' | 'emerging' {
  const normalized = level?.toLowerCase().trim();
  if (normalized === 'direct' || normalized === 'primary') return 'direct';
  if (normalized === 'indirect' || normalized === 'secondary') return 'indirect';
  if (normalized === 'emerging' || normalized === 'new') return 'emerging';
  return 'indirect'; // Default
}
