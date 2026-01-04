# Intelligence Section - Cost Analysis & Strategy

## Services Available

| Service | Purpose | Status |
|---------|---------|--------|
| **Crawl4AI** | Website scraping | ✅ Self-hosted (FREE) |
| **DataForSEO** | SEO data, competitor keywords | ✅ Have account |
| **Perplexity** | Real-time web research | ❓ Need to confirm API access |
| **Claude API** | AI analysis & synthesis | ✅ Have account |
| **OpenAI** | AI analysis (alternative) | ✅ Have account |

---

## Pricing Comparison

### 1. Web Scraping

| Option | Cost | Notes |
|--------|------|-------|
| **Crawl4AI (self-hosted)** | **FREE** | Already running at `http://38.97.60.181:11235` |
| Firecrawl | $0.001/page | Managed service |
| ScrapingBee | $0.00125/page | Managed service |

**Winner: Crawl4AI** - Zero cost, already deployed, returns markdown

---

### 2. Real-Time Research (Web Search + Synthesis)

| Service | Model | Cost Structure | Est. per Query |
|---------|-------|----------------|----------------|
| **Perplexity Sonar** | Base | $1/M input + $5/M output + $5/1K requests | ~$0.007 |
| **Perplexity Sonar Pro** | Advanced | $3/M input + $15/M output + $18/1K requests | ~$0.025 |
| **DataForSEO SERP + Claude** | Hybrid | $0.0006/SERP + Claude synthesis | ~$0.005 |

**Cost Breakdown for Perplexity Sonar (per query):**
- Request fee: $0.005
- ~500 input tokens: $0.0005
- ~1000 output tokens: $0.005
- **Total: ~$0.007 per search**

**Winner: Perplexity Sonar** - Best quality for research, reasonable cost

---

### 3. AI Analysis (Report Generation)

| Model | Input (per 1M) | Output (per 1M) | Best For |
|-------|----------------|-----------------|----------|
| **Claude Haiku 3.5** | $0.80 | $4.00 | Quick classification, short tasks |
| **Claude Sonnet 4.5** | $3.00 | $15.00 | Balanced quality/cost |
| **Claude Opus 4.5** | $5.00 | $25.00 | Deep analysis, complex reasoning |
| GPT-4o | $2.50 | $10.00 | Alternative to Sonnet |
| GPT-4o-mini | $0.15 | $0.60 | Cheapest option |

**Practical Cost Examples:**

| Task | Tokens | Model | Cost |
|------|--------|-------|------|
| Brand DNA synthesis | 10K in / 3K out | Sonnet 4.5 | $0.075 |
| Persona generation | 5K in / 2K out | Sonnet 4.5 | $0.045 |
| Competitor analysis | 8K in / 2K out | Sonnet 4.5 | $0.054 |
| Quick classification | 1K in / 0.5K out | Haiku 3.5 | $0.003 |

**Winner: Claude Sonnet 4.5** - Best balance for main analysis
**For simple tasks: Claude Haiku 3.5** - 5x cheaper

---

### 4. SEO/Competitor Data

| DataForSEO Endpoint | Cost | Use Case |
|---------------------|------|----------|
| **Search Intent** | $0.0001/keyword | Intent classification |
| **Keyword Suggestions** | $0.05/task | Expand keyword lists |
| **Competitors Domain** | $0.02/task | Find SEO competitors |
| **Domain Intersection** | $0.04/task | Keyword overlap |
| **SERP (Live)** | $0.002/query | Real-time search results |
| **Domain Metrics** | $0.002/domain | Traffic, authority |

**Winner: DataForSEO** - Already integrated, comprehensive data

---

## Recommended Strategy

### Option A: Perplexity-First (Best Quality)

Use Perplexity for all research, Claude for synthesis.

```
Brand DNA:
├── Perplexity: 4 searches ($0.028)
├── Crawl4AI: 2 pages (FREE)
├── Claude Sonnet: synthesis ($0.075)
└── Total: ~$0.10

Audience DNA (3 personas):
├── Perplexity: 9 searches ($0.063)
├── Claude Sonnet: 3 syntheses ($0.135)
└── Total: ~$0.20

Competitor DNA (3 competitors):
├── Perplexity: 5 searches ($0.035)
├── DataForSEO: domain data ($0.06)
├── Claude Sonnet: analysis ($0.162)
└── Total: ~$0.26

FULL ANALYSIS TOTAL: ~$0.56
```

### Option B: DataForSEO-First (Cheapest)

Use DataForSEO SERP for research, Claude for synthesis.

```
Brand DNA:
├── DataForSEO SERP: 4 queries ($0.008)
├── Crawl4AI: 2 pages (FREE)
├── Claude Sonnet: synthesis ($0.075)
└── Total: ~$0.08

Audience DNA (3 personas):
├── DataForSEO SERP: 9 queries ($0.018)
├── Claude Sonnet: 3 syntheses ($0.135)
└── Total: ~$0.15

Competitor DNA (3 competitors):
├── DataForSEO SERP: 5 queries ($0.010)
├── DataForSEO: domain data ($0.06)
├── Claude Sonnet: analysis ($0.162)
└── Total: ~$0.23

FULL ANALYSIS TOTAL: ~$0.46
```

### Option C: Hybrid (Recommended)

Use Perplexity for complex research, DataForSEO for data, optimize AI model choice.

```
Brand DNA:
├── Perplexity: 2 deep searches ($0.014)
├── DataForSEO SERP: 2 quick searches ($0.004)
├── Crawl4AI: 3 pages (FREE)
├── Claude Sonnet: synthesis ($0.075)
└── Total: ~$0.09

Audience DNA (3 personas):
├── Perplexity: 3 behavior searches ($0.021)
├── DataForSEO SERP: 6 quick searches ($0.012)
├── Claude Haiku: quick extraction ($0.009)
├── Claude Sonnet: final synthesis ($0.045)
└── Total: ~$0.09

Competitor DNA (3 competitors):
├── Perplexity: 3 deep analyses ($0.021)
├── DataForSEO: SEO data ($0.08)
├── Claude Haiku: extraction ($0.009)
├── Claude Sonnet: final report ($0.054)
└── Total: ~$0.16

FULL ANALYSIS TOTAL: ~$0.34
```

---

## Cost Comparison Summary

| Strategy | Brand DNA | Audience DNA | Competitor DNA | Total |
|----------|-----------|--------------|----------------|-------|
| **A: Perplexity-First** | $0.10 | $0.20 | $0.26 | **$0.56** |
| **B: DataForSEO-First** | $0.08 | $0.15 | $0.23 | **$0.46** |
| **C: Hybrid** | $0.09 | $0.09 | $0.16 | **$0.34** |

---

## Services You Already Have

| Service | Confirmed | Endpoint/Key Location |
|---------|-----------|----------------------|
| **Crawl4AI** | ✅ Working | `http://38.97.60.181:11235` (token: `crawl4ai_secret_token`) |
| **DataForSEO** | ✅ Have | In `.env` (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD) |
| **Claude** | ✅ Have | In `.env` (ANTHROPIC_API_KEY) |
| **OpenAI** | ✅ Have | In `.env` (OPENAI_API_KEY) |
| **Perplexity** | ❓ Need to check | Check if you have API key |

---

## Questions to Confirm

1. **Perplexity API** - Do you have a Perplexity API key?
   - Check at: https://www.perplexity.ai/settings/api
   - If not, DataForSEO SERP can be used as fallback

2. **Budget Preference** - Which matters more?
   - Quality (Option A: ~$0.56/analysis)
   - Cost (Option C: ~$0.34/analysis)

3. **Volume Expectations** - How many analyses per month?
   - 10/month = $3.40 - $5.60
   - 50/month = $17 - $28
   - 100/month = $34 - $56

---

## Implementation Recommendation

### Phase 1: MVP with Hybrid Approach
- Use **Crawl4AI** for website scraping (FREE)
- Use **DataForSEO SERP** for quick searches ($0.002/query)
- Use **Claude Haiku** for extraction tasks ($0.003/task)
- Use **Claude Sonnet** for final synthesis ($0.05-0.08/report)

### Phase 2: Add Perplexity (if available)
- Replace some DataForSEO SERP calls with Perplexity
- Better quality for behavioral research
- Keep DataForSEO for SEO-specific data

### Phase 3: Optimize
- Cache common research patterns
- Batch similar requests
- Use embeddings for similar brand detection

---

## Comparison with Your n8n Workflow

| Component | n8n Workflow | Proposed |
|-----------|--------------|----------|
| Web Scraping | N/A (manual) | Crawl4AI (FREE) |
| Research | Perplexity | Perplexity + DataForSEO |
| AI Model | GPT-4.1-mini + Claude Sonnet | Claude Sonnet + Haiku |
| SEO Data | DataForSEO | DataForSEO |
| Storage | NocoDB | PostgreSQL (existing) |

**Key Improvements:**
- Free website scraping with Crawl4AI
- Smarter model selection (Haiku for simple, Sonnet for complex)
- Unified database (already using PostgreSQL)
- Better caching (30-day TTL like intent API)

---

## Next Steps

1. ✅ Crawl4AI confirmed working
2. ❓ Confirm Perplexity API access
3. 📋 Choose strategy (A, B, or C)
4. 🏗️ Build Brand DNA first (foundation for others)

---

## Sources

- [Perplexity API Pricing](https://docs.perplexity.ai/getting-started/pricing)
- [DataForSEO Pricing](https://dataforseo.com/pricing)
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [DataForSEO Labs API](https://dataforseo.com/pricing/dataforseo-labs/dataforseo-google-api)
