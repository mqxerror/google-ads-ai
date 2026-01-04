/**
 * Unified Brand Intelligence Report Generator
 *
 * Combines Brand DNA, Audience DNA, and Competitor DNA into a comprehensive
 * report that can be used as an asset for ad creation.
 * Uses Claude Opus 4.5 via OpenRouter for report generation.
 */

import { Pool } from 'pg';
import { callAI, getDefaultModel, isOpenRouterConfigured } from './ai-models';

// Types
export interface BrandDNA {
  brandPositioning?: string;
  targetMarket?: string;
  brandVoice?: string;
  missionVision?: string;
  brandValues?: Array<{ value: string; description: string }>;
  uniqueDifferentiators?: string[];
  companyStory?: string;
  fullReport?: string;
}

export interface Persona {
  personaName: string;
  personaTitle: string;
  demographics: {
    ageRange: string;
    income: string;
    occupation: string;
    location: string;
  };
  lifeSituation: string;
  painPoints: string[];
  goalsAspirations: string[];
  purchaseMotivations: string[];
  objections: string[];
  trustSignals: string[];
  adCopyHooks?: string[];
}

export interface Competitor {
  competitorName: string;
  competitorDomain: string;
  threatLevel: string;
  brandPositioning: string;
  uniqueValueProp: string;
  strengths: string[];
  weaknesses: string[];
  keyDifferentiators: string[];
  marketPosition: string;
}

export interface UnifiedReportInput {
  projectId: string;
  brandName: string;
  domain?: string;
  industry?: string;
  brandDna: BrandDNA;
  personas: Persona[];
  competitors: Competitor[];
}

export interface UnifiedReportResult {
  success: boolean;
  report?: string;
  executiveSummary?: string;
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

// Re-export for API
export { isOpenRouterConfigured };

/**
 * Generate Unified Brand Intelligence Report
 */
export async function generateUnifiedReport(input: UnifiedReportInput): Promise<UnifiedReportResult> {
  const db = getPool();
  let totalCost = 0;

  console.log(`[Unified Report] Generating report for ${input.brandName}`);

  try {
    // Check OpenRouter is configured
    if (!isOpenRouterConfigured()) {
      throw new Error('OpenRouter API key not configured');
    }

    // Build the comprehensive prompt
    const prompt = buildUnifiedReportPrompt(input);

    // Get the model configuration - use Opus for best quality report
    const model = getDefaultModel('brandDna'); // Use same model as Brand DNA for quality

    console.log(`[Unified Report] Calling ${model.name}...`);

    // Call AI via OpenRouter
    const aiResponse = await callAI(model.id, prompt, { maxTokens: 8000 });
    totalCost = aiResponse.cost;

    // Extract the report
    const report = aiResponse.text;

    // Extract executive summary (first major section)
    const executiveSummary = extractExecutiveSummary(report);

    // Update project with the unified report
    await db.query(
      `UPDATE intelligence_projects SET
        unified_report = $2,
        unified_report_status = 'completed',
        total_api_cost = total_api_cost + $3,
        updated_at = NOW()
      WHERE id = $1`,
      [input.projectId, report, totalCost]
    );

    console.log(`[Unified Report] Complete. Cost: $${totalCost.toFixed(4)}`);

    return {
      success: true,
      report,
      executiveSummary,
      cost: totalCost,
    };

  } catch (error) {
    console.error('[Unified Report] Error:', error);

    // Update project with failure
    await db.query(
      `UPDATE intelligence_projects SET
        unified_report_status = 'failed',
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
 * Build the comprehensive prompt for unified report generation
 */
function buildUnifiedReportPrompt(input: UnifiedReportInput): string {
  // Format Brand DNA
  const brandValues = input.brandDna.brandValues
    ?.map(v => `- ${v.value}: ${v.description}`)
    .join('\n') || 'Not specified';

  const differentiators = input.brandDna.uniqueDifferentiators?.join('\n- ') || 'Not specified';

  // Format Personas
  const personasSummary = input.personas.map((p, i) => `
### Persona ${i + 1}: ${p.personaName} - "${p.personaTitle}"
**Demographics:** ${p.demographics.ageRange}, ${p.demographics.income}, ${p.demographics.occupation}
**Life Situation:** ${p.lifeSituation}
**Pain Points:** ${p.painPoints.slice(0, 3).join('; ')}
**Purchase Motivations:** ${p.purchaseMotivations.slice(0, 3).join('; ')}
**Objections:** ${p.objections.slice(0, 3).join('; ')}
**Trust Signals:** ${p.trustSignals.slice(0, 3).join('; ')}
**Ad Copy Hooks:** ${p.adCopyHooks?.slice(0, 3).join('; ') || 'N/A'}
`).join('\n');

  // Format Competitors
  const competitorsSummary = input.competitors.map((c, i) => `
### Competitor ${i + 1}: ${c.competitorName} (${c.competitorDomain})
**Threat Level:** ${c.threatLevel}
**Positioning:** ${c.brandPositioning}
**Unique Value Prop:** ${c.uniqueValueProp}
**Strengths:** ${c.strengths.slice(0, 3).join('; ')}
**Weaknesses:** ${c.weaknesses.slice(0, 3).join('; ')}
**Market Position:** ${c.marketPosition}
`).join('\n');

  return `## SITUATION
You are an elite brand strategist creating a comprehensive Brand Intelligence Report for "${input.brandName}". This report will serve as the foundational asset for all marketing and advertising efforts. It combines deep brand analysis, customer psychology, and competitive intelligence into actionable marketing guidance.

## TASK
Create a unified Brand Intelligence Report that synthesizes the following research into a strategic marketing document:

1. **Brand DNA** - Core identity, positioning, and differentiation
2. **Audience DNA** - Customer personas with psychological profiling
3. **Competitor DNA** - Competitive landscape and market positioning

## OBJECTIVE
The report should:
- Provide an executive summary for quick stakeholder briefings
- Highlight strategic marketing opportunities
- Deliver ready-to-use messaging themes and copy direction
- Identify competitive advantages to emphasize in ads
- Map customer psychology to messaging strategies
- Be usable directly by ad copywriters and campaign managers

## KNOWLEDGE PROVIDED

### BRAND DNA

**Brand Name:** ${input.brandName}
**Domain:** ${input.domain || 'N/A'}
**Industry:** ${input.industry || 'N/A'}

**Brand Positioning:**
${input.brandDna.brandPositioning || 'Not specified'}

**Target Market:**
${input.brandDna.targetMarket || 'Not specified'}

**Brand Voice:**
${input.brandDna.brandVoice || 'Not specified'}

**Mission & Vision:**
${input.brandDna.missionVision || 'Not specified'}

**Core Values:**
${brandValues}

**Unique Differentiators:**
- ${differentiators}

**Brand Story:**
${input.brandDna.companyStory || 'Not specified'}

---

### AUDIENCE DNA (Customer Personas)
${personasSummary}

---

### COMPETITOR DNA (Competitive Intelligence)
${competitorsSummary}

---

## OUTPUT FORMAT

Create a well-structured markdown report. Use proper markdown formatting throughout:
- Use ## for main sections and ### for subsections
- Use bullet points (- ) for lists
- Use **bold** for emphasis on key terms
- Add blank lines between sections for readability
- Use horizontal rules (---) between major sections

# Brand Intelligence Report: ${input.brandName}

---

## Executive Summary

Write 3-4 paragraphs covering:
- The brand's unique market position
- Key strategic opportunities identified
- Primary marketing direction recommended

---

## Brand Identity & Positioning

### Core Brand Essence
- What the brand fundamentally represents
- The emotional connection it creates

### Market Positioning Statement
- Clear positioning statement (1-2 sentences)

### Key Differentiators vs Competition
- **Differentiator 1:** Description
- **Differentiator 2:** Description
- **Differentiator 3:** Description

---

## Target Audience Insights

### Primary Audience: [Name]
- **Profile:** Demographics and psychographics
- **Primary Motivation:** What drives them
- **Key Pain Points:** What frustrates them
- **Emotional Triggers:** What resonates

### Secondary Audiences
Brief overview of other personas

### Cross-Persona Messaging Themes
- Theme 1: Description
- Theme 2: Description
- Theme 3: Description

---

## Competitive Advantage Analysis

### Market Position
Description of where brand sits relative to competitors

### Competitor Weaknesses to Exploit
- **[Competitor 1]:** Their weakness we can exploit
- **[Competitor 2]:** Their weakness we can exploit

### Our Unique Strengths
- Strength 1
- Strength 2
- Strength 3

---

## Strategic Messaging Framework

### Primary Value Propositions (Ranked)
1. **[Main Value Prop]:** Description
2. **[Secondary Value Prop]:** Description
3. **[Tertiary Value Prop]:** Description

### Headline Themes
- Theme 1: Example hook
- Theme 2: Example hook
- Theme 3: Example hook

### Trust-Building Claims
- Claim with proof point
- Claim with proof point

---

## Objection Handling Guide

### Common Objections & Counter-Messages

| Objection | Counter-Message |
|-----------|-----------------|
| "Too expensive" | Value-focused response |
| "Not sure if..." | Trust-building response |

---

## Ad Campaign Direction

### Recommended Campaign Themes
1. **Theme Name:** Brief description
2. **Theme Name:** Brief description

### Persona-Specific Angles
- **For [Persona 1]:** Messaging angle
- **For [Persona 2]:** Messaging angle

### Competitive Positioning
- Against [Competitor 1]: How to position
- Against [Competitor 2]: How to position

---

## Ready-to-Use Ad Copy Elements

### Headlines (30 characters max)
1. "Headline example here"
2. "Another headline option"
3. "Third headline choice"
4. "Fourth headline option"
5. "Fifth headline example"

### Descriptions (90 characters max)
1. "Description example that fits within ninety character limit for ads"
2. "Another description option with compelling copy that converts"
3. "Third description focusing on key benefit and call to action"

### Long Headlines (90 characters max)
1. "Longer headline with more detail about the value proposition"
2. "Alternative long headline emphasizing different benefit"

---

## Appendix: Quick Reference

### Brand Voice Guidelines
- **Tone:** Description
- **Style:** Description
- **Do's:** What to include
- **Don'ts:** What to avoid

### Key Phrases to Use
- "Phrase 1"
- "Phrase 2"
- "Phrase 3"

### Phrases to Avoid
- "Phrase 1" (why to avoid)
- "Phrase 2" (why to avoid)

### Competitive Watch-Outs
- Don't mention [competitor] directly
- Avoid comparing on [topic]

---

*Generated with Brand Intelligence Analysis*

## CRITICAL FORMATTING RULES:
1. Always use proper markdown headings (## and ###)
2. Always use bullet points with proper spacing
3. Add horizontal rules (---) between major sections
4. Use **bold** for key terms and labels
5. Include specific, actionable copy examples
6. Ensure ad copy fits character limits (30/90 chars)
7. Make every section scannable with clear structure`;
}

/**
 * Extract executive summary from the full report
 */
function extractExecutiveSummary(report: string): string {
  // Try to find the Executive Summary section
  const summaryMatch = report.match(/## Executive Summary\n+([\s\S]*?)(?=\n## [A-Z]|$)/i);
  if (summaryMatch) {
    return summaryMatch[1].trim().slice(0, 1000);
  }

  // Fallback: take the first 500 characters after the title
  const titleMatch = report.match(/# Brand Intelligence Report[^\n]*\n+([\s\S]{0,500})/);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  return report.slice(0, 500);
}
