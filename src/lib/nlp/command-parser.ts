// Natural Language Command Parser
// Hybrid approach: Rule-based first, with structure for LLM fallback

export type CommandIntent =
  | 'filter'
  | 'action'
  | 'analysis'
  | 'forecast'
  | 'navigation'
  | 'unknown';

export type EntityType =
  | 'campaign'
  | 'ad_group'
  | 'keyword'
  | 'metric'
  | 'time_range'
  | 'value'
  | 'comparison';

export interface ParsedEntity {
  type: EntityType;
  value: string;
  normalized?: string | number;
  confidence: number;
}

export interface ParsedCommand {
  intent: CommandIntent;
  action?: string;
  entities: ParsedEntity[];
  confidence: number;
  originalQuery: string;
  suggestedAction?: {
    type: string;
    params: Record<string, unknown>;
  };
  humanReadable: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
}

// Metric aliases for normalization
const METRIC_ALIASES: Record<string, string> = {
  // Spend
  spend: 'spend',
  spending: 'spend',
  cost: 'spend',
  budget: 'budget',
  // Conversions
  conversions: 'conversions',
  conv: 'conversions',
  converts: 'conversions',
  sales: 'conversions',
  // CPA
  cpa: 'cpa',
  'cost per acquisition': 'cpa',
  'cost per conversion': 'cpa',
  // CTR
  ctr: 'ctr',
  'click through rate': 'ctr',
  'click-through rate': 'ctr',
  'click rate': 'ctr',
  // ROAS
  roas: 'roas',
  'return on ad spend': 'roas',
  return: 'roas',
  // Clicks
  clicks: 'clicks',
  // Impressions
  impressions: 'impressions',
  impr: 'impressions',
  views: 'impressions',
  // AI Score / Health
  score: 'aiScore',
  'ai score': 'aiScore',
  health: 'health',
  'health score': 'health',
};

// Time range patterns
const TIME_PATTERNS: Array<{ pattern: RegExp; days: number; label: string }> = [
  { pattern: /last\s*(\d+)\s*days?/i, days: -1, label: 'last X days' },
  { pattern: /past\s*(\d+)\s*days?/i, days: -1, label: 'past X days' },
  { pattern: /last\s*week/i, days: 7, label: 'last week' },
  { pattern: /past\s*week/i, days: 7, label: 'past week' },
  { pattern: /last\s*month/i, days: 30, label: 'last month' },
  { pattern: /past\s*month/i, days: 30, label: 'past month' },
  { pattern: /last\s*quarter/i, days: 90, label: 'last quarter' },
  { pattern: /today/i, days: 1, label: 'today' },
  { pattern: /yesterday/i, days: 1, label: 'yesterday' },
  { pattern: /this\s*week/i, days: 7, label: 'this week' },
  { pattern: /this\s*month/i, days: 30, label: 'this month' },
];

// Action keywords
const ACTION_PATTERNS: Array<{ pattern: RegExp; action: string; intent: CommandIntent }> = [
  // Pause/Enable
  { pattern: /pause\s+(.+)/i, action: 'pause', intent: 'action' },
  { pattern: /stop\s+(.+)/i, action: 'pause', intent: 'action' },
  { pattern: /enable\s+(.+)/i, action: 'enable', intent: 'action' },
  { pattern: /start\s+(.+)/i, action: 'enable', intent: 'action' },
  { pattern: /resume\s+(.+)/i, action: 'enable', intent: 'action' },
  // Budget
  { pattern: /increase\s+budget\s+(?:by\s+)?(\d+%?)/i, action: 'increase_budget', intent: 'action' },
  { pattern: /raise\s+budget\s+(?:by\s+)?(\d+%?)/i, action: 'increase_budget', intent: 'action' },
  { pattern: /decrease\s+budget\s+(?:by\s+)?(\d+%?)/i, action: 'decrease_budget', intent: 'action' },
  { pattern: /lower\s+budget\s+(?:by\s+)?(\d+%?)/i, action: 'decrease_budget', intent: 'action' },
  { pattern: /set\s+budget\s+(?:to\s+)?\$?(\d+)/i, action: 'set_budget', intent: 'action' },
  // Filters
  { pattern: /show\s+(.+)/i, action: 'filter', intent: 'filter' },
  { pattern: /filter\s+(.+)/i, action: 'filter', intent: 'filter' },
  { pattern: /find\s+(.+)/i, action: 'filter', intent: 'filter' },
  { pattern: /list\s+(.+)/i, action: 'filter', intent: 'filter' },
  // Analysis
  { pattern: /why\s+(did|is|are|has|have)\s+(.+)/i, action: 'explain', intent: 'analysis' },
  { pattern: /explain\s+(.+)/i, action: 'explain', intent: 'analysis' },
  { pattern: /analyze\s+(.+)/i, action: 'analyze', intent: 'analysis' },
  { pattern: /what('s| is)\s+(wrong|happening|going on)\s+(?:with\s+)?(.+)/i, action: 'diagnose', intent: 'analysis' },
  // Forecast
  { pattern: /what\s+if\s+(.+)/i, action: 'forecast', intent: 'forecast' },
  { pattern: /predict\s+(.+)/i, action: 'forecast', intent: 'forecast' },
  { pattern: /forecast\s+(.+)/i, action: 'forecast', intent: 'forecast' },
  // Navigation
  { pattern: /go\s+to\s+(.+)/i, action: 'navigate', intent: 'navigation' },
  { pattern: /open\s+(.+)/i, action: 'navigate', intent: 'navigation' },
];

// Filter keywords
const FILTER_KEYWORDS: Array<{ pattern: RegExp; filter: string; operator: string }> = [
  // Performance issues
  { pattern: /wast(ed|ing)\s*spend/i, filter: 'wastedSpend', operator: 'eq' },
  { pattern: /no\s*conversions?/i, filter: 'conversions', operator: 'eq' },
  { pattern: /zero\s*conversions?/i, filter: 'conversions', operator: 'eq' },
  { pattern: /low\s*ctr/i, filter: 'ctr', operator: 'lt' },
  { pattern: /high\s*cpa/i, filter: 'cpa', operator: 'gt' },
  { pattern: /low\s*roas/i, filter: 'roas', operator: 'lt' },
  { pattern: /poor\s*performance/i, filter: 'aiScore', operator: 'lt' },
  // Status
  { pattern: /paused/i, filter: 'status', operator: 'eq' },
  { pattern: /active/i, filter: 'status', operator: 'eq' },
  { pattern: /enabled/i, filter: 'status', operator: 'eq' },
  // Performance
  { pattern: /top\s*perform(ers?|ing)/i, filter: 'aiScore', operator: 'gt' },
  { pattern: /best\s*perform(ers?|ing)/i, filter: 'aiScore', operator: 'gt' },
  { pattern: /worst\s*perform(ers?|ing)/i, filter: 'aiScore', operator: 'lt' },
  { pattern: /underperform(ers?|ing)/i, filter: 'aiScore', operator: 'lt' },
  // Scaling
  { pattern: /scal(e|ing)\s*candidates?/i, filter: 'scalingCandidate', operator: 'eq' },
  { pattern: /ready\s*to\s*scale/i, filter: 'scalingCandidate', operator: 'eq' },
  // Types
  { pattern: /search\s*campaigns?/i, filter: 'type', operator: 'eq' },
  { pattern: /pmax|performance\s*max/i, filter: 'type', operator: 'eq' },
  { pattern: /shopping\s*campaigns?/i, filter: 'type', operator: 'eq' },
  { pattern: /display\s*campaigns?/i, filter: 'type', operator: 'eq' },
  { pattern: /video\s*campaigns?/i, filter: 'type', operator: 'eq' },
];

export function parseCommand(query: string): ParsedCommand {
  const normalizedQuery = query.trim().toLowerCase();
  const entities: ParsedEntity[] = [];
  let intent: CommandIntent = 'unknown';
  let action: string | undefined;
  let suggestedAction: ParsedCommand['suggestedAction'];
  let confidence = 0;
  let humanReadable = '';

  // Try to match action patterns
  for (const { pattern, action: matchAction, intent: matchIntent } of ACTION_PATTERNS) {
    const match = normalizedQuery.match(pattern);
    if (match) {
      intent = matchIntent;
      action = matchAction;
      confidence = 0.8;

      // Extract entities from the match
      if (match[1]) {
        entities.push({
          type: 'campaign',
          value: match[1],
          confidence: 0.7,
        });
      }
      break;
    }
  }

  // Extract time ranges
  for (const { pattern, days, label } of TIME_PATTERNS) {
    const match = normalizedQuery.match(pattern);
    if (match) {
      const actualDays = days === -1 ? parseInt(match[1], 10) : days;
      entities.push({
        type: 'time_range',
        value: label,
        normalized: actualDays,
        confidence: 0.9,
      });
      break;
    }
  }

  // Extract metrics
  for (const [alias, normalized] of Object.entries(METRIC_ALIASES)) {
    if (normalizedQuery.includes(alias)) {
      entities.push({
        type: 'metric',
        value: alias,
        normalized,
        confidence: 0.85,
      });
    }
  }

  // Parse filter keywords
  for (const { pattern, filter, operator } of FILTER_KEYWORDS) {
    if (pattern.test(normalizedQuery)) {
      if (intent === 'unknown') {
        intent = 'filter';
        action = 'filter';
      }

      suggestedAction = {
        type: 'filter',
        params: {
          field: filter,
          operator,
          value: getDefaultFilterValue(filter, operator),
        },
      };
      confidence = Math.max(confidence, 0.75);
      break;
    }
  }

  // Extract numeric values
  const numberMatch = normalizedQuery.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*%?/g);
  if (numberMatch) {
    for (const num of numberMatch) {
      const cleanNum = num.replace(/[$,]/g, '');
      const isPercent = num.includes('%');
      entities.push({
        type: 'value',
        value: num,
        normalized: parseFloat(cleanNum),
        confidence: 0.9,
      });
    }
  }

  // Build human-readable interpretation
  humanReadable = buildHumanReadable(intent, action, entities, query);

  // If still unknown, check if it's a campaign name search
  if (intent === 'unknown' && normalizedQuery.length > 2) {
    intent = 'filter';
    action = 'search';
    suggestedAction = {
      type: 'search',
      params: {
        query: query.trim(),
      },
    };
    confidence = 0.5;
    humanReadable = `Search for campaigns matching "${query.trim()}"`;
  }

  return {
    intent,
    action,
    entities,
    confidence,
    originalQuery: query,
    suggestedAction,
    humanReadable,
    needsClarification: confidence < 0.6,
    clarificationQuestion: confidence < 0.6 ? buildClarificationQuestion(query, intent) : undefined,
  };
}

function getDefaultFilterValue(filter: string, operator: string): unknown {
  switch (filter) {
    case 'conversions':
      return operator === 'eq' ? 0 : undefined;
    case 'ctr':
      return operator === 'lt' ? 1.0 : 3.0;
    case 'cpa':
      return operator === 'gt' ? 50 : 20;
    case 'roas':
      return operator === 'lt' ? 2.0 : 4.0;
    case 'aiScore':
      return operator === 'lt' ? 50 : 75;
    case 'status':
      return operator === 'eq' ? 'PAUSED' : undefined;
    case 'type':
      return 'SEARCH';
    case 'wastedSpend':
    case 'scalingCandidate':
      return true;
    default:
      return undefined;
  }
}

function buildHumanReadable(
  intent: CommandIntent,
  action: string | undefined,
  entities: ParsedEntity[],
  originalQuery: string
): string {
  const timeEntity = entities.find((e) => e.type === 'time_range');
  const metricEntity = entities.find((e) => e.type === 'metric');
  const valueEntity = entities.find((e) => e.type === 'value');
  const campaignEntity = entities.find((e) => e.type === 'campaign');

  switch (intent) {
    case 'filter':
      if (action === 'filter') {
        return `Filter campaigns${timeEntity ? ` for ${timeEntity.value}` : ''}`;
      }
      return `Show matching campaigns`;
    case 'action':
      if (action === 'pause' && campaignEntity) {
        return `Pause campaign "${campaignEntity.value}"`;
      }
      if (action === 'enable' && campaignEntity) {
        return `Enable campaign "${campaignEntity.value}"`;
      }
      if (action?.includes('budget') && valueEntity) {
        return `${action.replace('_', ' ')} by ${valueEntity.value}`;
      }
      return `Perform action on campaign`;
    case 'analysis':
      if (metricEntity) {
        return `Analyze ${metricEntity.normalized || metricEntity.value} changes`;
      }
      return `Analyze campaign performance`;
    case 'forecast':
      return `Forecast impact of changes`;
    case 'navigation':
      return `Navigate to ${campaignEntity?.value || 'location'}`;
    default:
      return originalQuery;
  }
}

function buildClarificationQuestion(query: string, intent: CommandIntent): string {
  switch (intent) {
    case 'filter':
      return 'Would you like to filter campaigns by status, type, or performance metrics?';
    case 'action':
      return 'Which campaign would you like to modify?';
    case 'unknown':
    default:
      return `I'm not sure what you want to do. Would you like to:\n• Search for campaigns\n• Filter by performance\n• Take an action`;
  }
}

// Utility to check if a string might be a natural language command
export function mightBeNaturalLanguage(input: string): boolean {
  const nlPatterns = [
    /^(show|find|list|filter|pause|enable|start|stop|why|what|increase|decrease|set|go to|open)/i,
    /campaigns?\s+(with|that|where|having)/i,
    /spending|wasting|performing|converting/i,
    /\s+(last|past|this)\s+(week|month|day|quarter)/i,
  ];

  return nlPatterns.some((pattern) => pattern.test(input));
}

// Get suggestions based on partial input
export function getSuggestions(input: string): string[] {
  const suggestions: string[] = [];
  const lower = input.toLowerCase();

  // Common command starters
  const starters = [
    'Show campaigns wasting spend',
    'Show campaigns with low CTR',
    'Show top performers',
    'Show paused campaigns',
    'Pause {campaign name}',
    'Why did CPA spike?',
    'What if I increase budget 20%?',
  ];

  for (const starter of starters) {
    if (starter.toLowerCase().includes(lower) || lower.length < 3) {
      suggestions.push(starter);
    }
  }

  return suggestions.slice(0, 5);
}
