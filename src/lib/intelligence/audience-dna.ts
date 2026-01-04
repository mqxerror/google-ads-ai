/**
 * Audience DNA Analyzer
 *
 * Generates 3 detailed customer personas based on Brand DNA.
 * Uses Claude Opus 4.5 via OpenRouter for comprehensive psychological profiling.
 * Cost: ~$0.08-0.15 per analysis
 */

import { Pool } from 'pg';
import { callAI, getDefaultModel, isOpenRouterConfigured } from './ai-models';

// Types
export interface PersonaDemographics {
  ageRange: string;
  gender: string;
  income: string;
  education: string;
  occupation: string;
  location: string;
  familyStatus: string;
}

export interface BehaviorPatterns {
  researchStyle: string;
  decisionTimeline: string;
  influencers: string;
  preferredChannels: string[];
}

export interface Persona {
  personaName: string;
  personaTitle: string;
  avatarEmoji: string;
  demographics: PersonaDemographics;
  lifeSituation: string;
  goalsAspirations: string[];
  painPoints: string[];
  fearsAnxieties: string[];
  valuesBeliefs: string[];
  behaviorPatterns: BehaviorPatterns;
  purchaseMotivations: string[];
  objections: string[];
  trustSignals: string[];
  awarenessLevel: string;
  keyMessages: string[];
  adCopyHooks: string[];
}

export interface AudienceDNAInput {
  projectId: string;
  brandName: string;
  brandDna: {
    missionVision?: string;
    brandPositioning?: string;
    targetMarket?: string;
    brandVoice?: string;
    uniqueDifferentiators?: string[];
    brandValues?: Array<{ value: string; description: string }>;
    fullReport?: string;
  };
}

export interface AudienceDNAResult {
  success: boolean;
  personas?: Persona[];
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
  message: string,
  stepsLog: StepLog[]
) {
  // Update audience_dna step tracking (we'll use first persona row or create temp tracking)
  // For now, update the project status
  await db.query(
    `UPDATE intelligence_projects SET
      audience_dna_status = CASE
        WHEN $2 = 'completed' THEN 'completed'
        WHEN $2 = 'failed' THEN 'failed'
        ELSE 'in_progress'
      END,
      updated_at = NOW()
    WHERE id = $1`,
    [projectId, step]
  );

  // Store step tracking in a temp table or project metadata
  // For simplicity, we'll track in the console and return in API
  console.log(`[Audience DNA] Step: ${step} (${progress}%) - ${message}`);
}

// Re-export for API
export { isOpenRouterConfigured };

/**
 * Main Audience DNA Analysis Function
 */
export async function analyzeAudienceDNA(input: AudienceDNAInput): Promise<AudienceDNAResult> {
  const db = getPool();
  let totalCost = 0;
  let stepsLog: StepLog[] = [];
  let stepStartTime = Date.now();
  let modelUsed = '';

  console.log(`[Audience DNA] Starting analysis for project ${input.projectId}`);

  try {
    // ========== STEP 1: INITIALIZING ==========
    stepsLog = logStep(stepsLog, 'initializing', 'started', 'Preparing persona generation');
    await updateStep(db, input.projectId, 'initializing', 10, 'Initializing...', stepsLog);

    // Check for Brand DNA
    if (!input.brandDna.fullReport && !input.brandDna.brandPositioning) {
      throw new Error('Brand DNA must be completed before generating audience personas');
    }

    // Check OpenRouter is configured
    if (!isOpenRouterConfigured()) {
      throw new Error('OpenRouter API key not configured. Please add OPENROUTER_API_KEY to .env.local');
    }

    // Delete existing personas for this project
    await db.query('DELETE FROM audience_dna WHERE project_id = $1', [input.projectId]);

    stepsLog = logStep(stepsLog, 'initializing', 'completed', 'Ready to generate', stepStartTime);
    await updateStep(db, input.projectId, 'initializing', 15, 'Initialization complete', stepsLog);

    // ========== STEP 2: LOADING BRAND DNA ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'loading_brand', 'started', 'Reading brand context');
    await updateStep(db, input.projectId, 'loading_brand', 25, 'Loading Brand DNA context...', stepsLog);

    // Build the prompt with brand context
    const prompt = buildAudiencePrompt(input);

    stepsLog = logStep(stepsLog, 'loading_brand', 'completed', 'Brand context loaded', stepStartTime);
    await updateStep(db, input.projectId, 'loading_brand', 35, 'Brand DNA loaded', stepsLog);

    // ========== STEP 3: AI GENERATION (Claude Opus 4.5 via OpenRouter) ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'generating', 'started', 'Creating personas with Claude Opus 4.5');
    await updateStep(db, input.projectId, 'generating', 40, 'AI generating 3 detailed personas...', stepsLog);

    // Get the model configuration
    const model = getDefaultModel('audienceDna');
    modelUsed = model.name;

    console.log(`[Audience DNA] Calling ${model.name}...`);

    // Call AI via OpenRouter
    const aiResponse = await callAI(model.id, prompt, { maxTokens: 8000 });
    totalCost = aiResponse.cost;

    stepsLog = logStep(stepsLog, 'generating', 'completed', `Generated with ${model.name}`, stepStartTime);
    await updateStep(db, input.projectId, 'generating', 70, `AI generation complete (${aiResponse.outputTokens} tokens)`, stepsLog);

    // ========== STEP 4: PARSING RESULTS ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'parsing', 'started', 'Parsing persona data');
    await updateStep(db, input.projectId, 'parsing', 75, 'Processing AI response...', stepsLog);

    // Extract personas from response
    const personas = extractPersonasFromResponse(aiResponse.text);

    if (!personas || personas.length === 0) {
      throw new Error('Failed to parse personas from AI response');
    }

    console.log(`[Audience DNA] Parsed ${personas.length} personas`);

    stepsLog = logStep(stepsLog, 'parsing', 'completed', `Parsed ${personas.length} personas`, stepStartTime);
    await updateStep(db, input.projectId, 'parsing', 85, `Parsed ${personas.length} personas`, stepsLog);

    // ========== STEP 5: SAVING TO DATABASE ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'saving', 'started', 'Saving personas to database');
    await updateStep(db, input.projectId, 'saving', 90, 'Saving personas...', stepsLog);

    // Save each persona
    for (let i = 0; i < personas.length; i++) {
      const persona = personas[i];
      await db.query(
        `INSERT INTO audience_dna (
          project_id, position, persona_name, persona_title, avatar_emoji,
          demographics, life_situation, goals_aspirations, pain_points,
          fears_anxieties, values_beliefs, behavior_patterns, decision_factors,
          purchase_motivations, objections, trust_signals, awareness_level,
          channels, full_profile, status, api_cost, model_used,
          current_step, step_progress, step_message
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
          'completed', $20, $21, 'completed', 100, 'Persona generated'
        )`,
        [
          input.projectId,
          i + 1,
          persona.personaName,
          persona.personaTitle,
          persona.avatarEmoji,
          JSON.stringify(persona.demographics),
          persona.lifeSituation,
          JSON.stringify(persona.goalsAspirations),
          JSON.stringify(persona.painPoints),
          JSON.stringify(persona.fearsAnxieties),
          JSON.stringify(persona.valuesBeliefs),
          JSON.stringify(persona.behaviorPatterns),
          JSON.stringify({ keyMessages: persona.keyMessages, adCopyHooks: persona.adCopyHooks }),
          JSON.stringify(persona.purchaseMotivations),
          JSON.stringify(persona.objections),
          JSON.stringify(persona.trustSignals),
          persona.awarenessLevel,
          JSON.stringify(persona.behaviorPatterns.preferredChannels),
          JSON.stringify(persona), // Full profile as JSON
          totalCost / personas.length, // Split cost among personas
          modelUsed,
        ]
      );
    }

    // Update project status
    await db.query(
      `UPDATE intelligence_projects SET
        audience_dna_status = 'completed',
        total_api_cost = total_api_cost + $2,
        updated_at = NOW()
      WHERE id = $1`,
      [input.projectId, totalCost]
    );

    stepsLog = logStep(stepsLog, 'saving', 'completed', 'Personas saved successfully', stepStartTime);
    stepsLog = logStep(stepsLog, 'completed', 'completed', 'Audience DNA complete');
    await updateStep(db, input.projectId, 'completed', 100, 'Audience DNA complete', stepsLog);

    console.log(`[Audience DNA] Analysis complete. Generated ${personas.length} personas. Total cost: $${totalCost.toFixed(4)}`);

    return {
      success: true,
      personas,
      cost: totalCost,
    };

  } catch (error) {
    console.error('[Audience DNA] Error:', error);

    // Update project with failure
    await db.query(
      `UPDATE intelligence_projects SET
        audience_dna_status = 'failed',
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
 * Build the STOK prompt for persona generation
 */
function buildAudiencePrompt(input: AudienceDNAInput): string {
  const brandValues = input.brandDna.brandValues
    ?.map(v => `- ${v.value}: ${v.description}`)
    .join('\n') || 'Not specified';

  const differentiators = input.brandDna.uniqueDifferentiators?.join('\n- ') || 'Not specified';

  return `## SITUATION
You are an expert customer research analyst with 20+ years creating detailed buyer personas for marketing teams. You specialize in psychological profiling and understanding customer motivations at a deep level. You've helped Fortune 500 companies and startups alike understand their customers.

## TASK
Create 3 distinct, detailed customer personas for "${input.brandName}" based on their Brand DNA. Each persona should represent a DIFFERENT segment of their target audience with unique characteristics, motivations, and behaviors.

The 3 personas should cover:
1. **Primary Persona** - The ideal, most likely customer (highest volume)
2. **Secondary Persona** - A valuable segment with different characteristics
3. **Aspirational Persona** - A high-value segment they want to attract more of

## OBJECTIVE
Generate comprehensive, actionable personas that can be used to:
- Write highly targeted ad copy that resonates emotionally
- Design landing pages that address specific pain points
- Create content that speaks directly to each segment's needs
- Develop offers that overcome each persona's specific objections
- Build Google Ads campaigns with persona-specific messaging

## KNOWLEDGE PROVIDED

### Brand DNA Summary:
${input.brandDna.fullReport?.slice(0, 3000) || 'Not available'}

### Brand Positioning:
${input.brandDna.brandPositioning || 'Not specified'}

### Target Market:
${input.brandDna.targetMarket || 'Not specified'}

### Brand Voice:
${input.brandDna.brandVoice || 'Not specified'}

### Core Values:
${brandValues}

### Unique Differentiators:
- ${differentiators}

## OUTPUT FORMAT
Return ONLY a valid JSON array with exactly 3 persona objects. No markdown, no explanation, just the JSON array.

Each persona must follow this exact structure:
[
  {
    "personaName": "First name only (e.g., 'Sarah')",
    "personaTitle": "Descriptive archetype (e.g., 'The Cautious First-Timer')",
    "avatarEmoji": "Single emoji that represents this persona",
    "demographics": {
      "ageRange": "e.g., 35-50",
      "gender": "Any/Male/Female/Primarily Male/Primarily Female",
      "income": "Annual income range (e.g., $150K-500K)",
      "education": "Education level",
      "occupation": "Job title or industry",
      "location": "Geographic focus",
      "familyStatus": "Family situation"
    },
    "lifeSituation": "2-3 sentences describing their current life context and what brought them to consider this product/service",
    "goalsAspirations": ["Primary goal", "Secondary goal", "Tertiary goal"],
    "painPoints": ["Main pain point", "Secondary pain", "Third pain"],
    "fearsAnxieties": ["Primary fear", "Secondary fear", "Third fear"],
    "valuesBeliefs": ["Core value 1", "Core value 2", "Core value 3"],
    "behaviorPatterns": {
      "researchStyle": "How they research before making decisions",
      "decisionTimeline": "Fast/Medium/Slow - and why",
      "influencers": "Who/what influences their decisions",
      "preferredChannels": ["Channel 1", "Channel 2", "Channel 3"]
    },
    "purchaseMotivations": ["Primary motivation", "Secondary motivation"],
    "objections": ["Main objection/hesitation", "Second objection", "Third objection"],
    "trustSignals": ["What builds trust 1", "What builds trust 2", "What builds trust 3"],
    "awarenessLevel": "One of: unaware/problem_aware/solution_aware/product_aware/most_aware",
    "keyMessages": ["Message that would resonate deeply 1", "Message 2", "Message 3"],
    "adCopyHooks": ["Attention-grabbing hook 1", "Hook 2", "Hook 3"]
  }
]

IMPORTANT:
- Make each persona DISTINCTLY different from the others
- Be specific and avoid generic descriptions
- Include real psychological insights, not surface-level traits
- The ad copy hooks should be ready to use in Google Ads headlines
- Base everything on the Brand DNA provided - don't make up unrelated details

Return ONLY the JSON array, starting with [ and ending with ]`;
}

/**
 * Normalize awareness level to match database constraint
 */
function normalizeAwarenessLevel(level: string): string {
  const normalized = level.toLowerCase().replace(/-/g, '_').replace(/ /g, '_');

  // Map common variations to exact database values
  const mapping: Record<string, string> = {
    'unaware': 'unaware',
    'problem_aware': 'problem_aware',
    'problemaware': 'problem_aware',
    'solution_aware': 'solution_aware',
    'solutionaware': 'solution_aware',
    'product_aware': 'product_aware',
    'productaware': 'product_aware',
    'most_aware': 'most_aware',
    'mostaware': 'most_aware',
  };

  return mapping[normalized] || 'problem_aware'; // Default to problem_aware if unknown
}

/**
 * Extract personas from Claude's response
 */
function extractPersonasFromResponse(responseText: string): Persona[] {
  try {
    // Try to find JSON array in the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[Audience DNA] No JSON array found in response');
      throw new Error('No JSON array found in response');
    }

    const personas = JSON.parse(jsonMatch[0]) as Persona[];

    if (!Array.isArray(personas) || personas.length === 0) {
      throw new Error('Invalid personas array');
    }

    // Validate and normalize each persona
    for (const persona of personas) {
      if (!persona.personaName || !persona.personaTitle) {
        throw new Error('Persona missing required fields');
      }
      // Normalize awareness level to match database constraint
      if (persona.awarenessLevel) {
        persona.awarenessLevel = normalizeAwarenessLevel(persona.awarenessLevel);
      } else {
        persona.awarenessLevel = 'problem_aware';
      }
    }

    return personas;
  } catch (error) {
    console.error('[Audience DNA] Failed to parse personas:', error);
    console.error('[Audience DNA] Response text:', responseText.slice(0, 500));
    throw new Error('Failed to parse AI response into personas');
  }
}
