# Epic 5b: LLM Provider Integration

**Goal:** Integrate real AI/LLM capabilities using Anthropic Claude and OpenAI GPT for intelligent campaign analysis and recommendations.

---

## Story 5b.1: LLM Provider Configuration

**As a** user,
**I want** to configure my preferred AI provider,
**so that** I can use Claude or GPT for analysis.

**Acceptance Criteria:**
1. Settings page has "AI Provider" section
2. Support for Anthropic Claude (claude-3-5-sonnet, claude-3-opus)
3. Support for OpenAI GPT (gpt-4o, gpt-4-turbo)
4. API key input fields (securely stored)
5. "Test Connection" button to verify API key works
6. Provider selection dropdown with model options

---

## Story 5b.2: AI-Powered Campaign Analysis

**As a** user,
**I want** real AI analysis of my campaigns,
**so that** I get intelligent insights beyond rule-based scores.

**Acceptance Criteria:**
1. "Analyze with AI" button on campaign detail panel
2. AI receives full campaign metrics and context
3. AI provides detailed analysis with specific recommendations
4. Analysis includes spend optimization suggestions
5. Streaming response displayed in analysis panel
6. Cache analysis results to avoid repeated API calls

---

## Story 5b.3: AI-Enhanced Recommendations

**As a** user,
**I want** AI to generate smarter recommendations,
**so that** suggestions are contextual and intelligent.

**Acceptance Criteria:**
1. AI analyzes campaign patterns across the account
2. Recommendations explain WHY not just WHAT
3. AI considers campaign history and trends
4. Personalized suggestions based on account goals
5. Confidence score for each recommendation

---

## Story 5b.4: Bulk AI Analysis

**As a** user,
**I want** to analyze multiple campaigns at once,
**so that** I can get account-wide insights.

**Acceptance Criteria:**
1. "Analyze Selected" button for bulk analysis
2. AI summarizes patterns across selected campaigns
3. Identifies account-wide optimization opportunities
4. Highlights anomalies and outliers
5. Provides prioritized action list

---

## Story 5b.5: AI Usage & Cost Tracking

**As a** user,
**I want** to see my AI usage and costs,
**so that** I can manage API expenses.

**Acceptance Criteria:**
1. Dashboard shows AI API usage (tokens/requests)
2. Estimated cost display per provider
3. Usage limits configurable (max tokens/day)
4. Warning when approaching limits
5. Usage history chart

---

## Technical Notes

### Anthropic Claude Integration
- Use `@anthropic-ai/sdk` npm package
- Support for Claude 3.5 Sonnet (fast, cost-effective)
- Support for Claude 3 Opus (most capable)
- Streaming via Server-Sent Events

### OpenAI Integration
- Use `openai` npm package
- Support for GPT-4o (multimodal, fast)
- Support for GPT-4 Turbo (high quality)
- Streaming via OpenAI SDK

### Security
- API keys encrypted at rest
- Keys never sent to client
- All AI calls via server-side API routes
- Rate limiting to prevent abuse
