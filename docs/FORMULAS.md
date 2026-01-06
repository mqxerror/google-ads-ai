# Quick Ads AI - KPI Formulas & Calculations

This document defines how each metric is calculated in the dashboard. Update this when formulas change.

---

## KPI Card 1: Total Spend

### Main Value
```
Total Spend = SUM(campaign.spend) for all campaigns
```

**Source**: `src/stores/campaigns-store.ts` → `selectTotalSpend`
```typescript
export const selectTotalSpend = (state: CampaignsState) =>
  state.campaigns.reduce((sum, c) => sum + (c.spend ?? 0), 0);
```

### Subtext
```
Active Campaigns = COUNT(campaigns) WHERE status = 'ENABLED'
```

**Source**: `src/hooks/useCampaigns.ts` → `useDashboardStats`
```typescript
const activeCampaigns = campaigns.filter((c) => c.status === 'ENABLED');
activeCampaignCount = activeCampaigns.length;
```

---

## KPI Card 2: Conversions

### Main Value
```
Total Conversions = SUM(campaign.conversions) for all campaigns
```

**Source**: `src/stores/campaigns-store.ts` → `selectTotalConversions`
```typescript
export const selectTotalConversions = (state: CampaignsState) =>
  state.campaigns.reduce((sum, c) => sum + (c.conversions ?? 0), 0);
```

### Subtext (CPA)
```
Average CPA = Total Spend / Total Conversions

If Total Conversions = 0, show "No conversions yet"
```

**Source**: `src/components/dashboard/KPICards.tsx`
```typescript
const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
subtext: avgCPA > 0 ? `CPA: $${formatNumber(avgCPA)}` : 'No conversions yet'
```

---

## KPI Card 3: Avg AI Score

### Main Value
```
Avg AI Score = SUM(campaign.aiScore) / COUNT(campaigns)
             WHERE status = 'ENABLED'

If no enabled campaigns, return 0
```

**Source**: `src/stores/campaigns-store.ts` → `selectAvgScore`
```typescript
export const selectAvgScore = (state: CampaignsState) => {
  const enabled = state.campaigns.filter((c) => c.status === 'ENABLED');
  if (enabled.length === 0) return 0;
  return Math.round(enabled.reduce((sum, c) => sum + (c.aiScore ?? 0), 0) / enabled.length);
};
```

### Badge (Health Indicator)
```
🟢 Green = AI Score >= 70 (Excellent)
🟡 Yellow = AI Score >= 40 AND < 70 (Needs work)
🔴 Red = AI Score < 40 (Critical)
```

### Subtext (Waster Count)
```
Wasters = COUNT(campaigns)
          WHERE aiScore < wasterThreshold
          AND status = 'ENABLED'

Default wasterThreshold = 40
```

**Source**: `src/hooks/useCampaigns.ts` → `useDashboardStats`
```typescript
const wasters = campaigns.filter((c) => (c.aiScore ?? 0) < wasterThreshold && c.status === 'ENABLED');
wasterCount = wasters.length;
```

---

## KPI Card 4: Waste Detected

### Main Value (Waste Level)
```
Waste Percent = (Potential Savings / Total Spend) × 100

Level:
- "None detected" = Potential Savings = 0 OR Total Spend = 0
- "Low" = Waste Percent < 5%
- "Medium" = Waste Percent >= 5% AND < 15%
- "High" = Waste Percent >= 15%
```

**Source**: `src/components/dashboard/KPICards.tsx` → `getWasteLevel`
```typescript
function getWasteLevel(savings: number, totalSpend: number) {
  if (savings === 0 || totalSpend === 0) {
    return { level: 'none', label: 'None detected' };
  }
  const wastePercent = (savings / totalSpend) * 100;
  if (wastePercent < 5) return { level: 'low', label: 'Low' };
  if (wastePercent < 15) return { level: 'medium', label: 'Medium' };
  return { level: 'high', label: 'High' };
}
```

### Subtext (Potential Savings)
```
Potential Savings = SUM(campaign.spend)
                    WHERE aiScore < wasterThreshold
                    AND status = 'ENABLED'

If Potential Savings = 0, show "Last scan: {time}"
```

**Source**: `src/stores/campaigns-store.ts` → `selectPotentialSavings`
```typescript
export const selectPotentialSavings = (state: CampaignsState) => {
  const wasters = state.campaigns.filter(
    (c) => (c.aiScore ?? 0) < state.wasterThreshold && c.status === 'ENABLED'
  );
  return wasters.reduce((sum, c) => sum + (c.spend ?? 0), 0);
};
```

---

## AI Score Calculation (Per Campaign)

The AI Score is calculated in the API when fetching campaigns.

**Source**: `src/lib/google-ads.ts` → `calculateAIScore`
```typescript
function calculateAIScore(campaign: CampaignData): number {
  let score = 50; // Base score

  // CTR factor (0-20 points)
  if (campaign.ctr >= 5) score += 20;
  else if (campaign.ctr >= 3) score += 15;
  else if (campaign.ctr >= 1) score += 10;
  else if (campaign.ctr >= 0.5) score += 5;

  // Conversion factor (0-20 points)
  if (campaign.conversions >= 50) score += 20;
  else if (campaign.conversions >= 20) score += 15;
  else if (campaign.conversions >= 5) score += 10;
  else if (campaign.conversions >= 1) score += 5;

  // CPA efficiency (0-15 points)
  if (campaign.cpa > 0) {
    if (campaign.cpa <= 20) score += 15;
    else if (campaign.cpa <= 50) score += 10;
    else if (campaign.cpa <= 100) score += 5;
  }

  // Spend utilization (budget efficiency) (-10 to +10)
  if (campaign.dailyBudget && campaign.dailyBudget > 0) {
    const avgDailySpend = campaign.spend / 30;
    const utilization = avgDailySpend / campaign.dailyBudget;
    if (utilization >= 0.8 && utilization <= 1.1) score += 10;
    else if (utilization < 0.5) score -= 10;
  }

  // Penalty for no conversions with significant spend
  if (campaign.conversions === 0 && campaign.spend > 100) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}
```

### AI Score Breakdown
| Factor | Points | Condition |
|--------|--------|-----------|
| Base | 50 | Always |
| CTR | +20 | CTR >= 5% |
| CTR | +15 | CTR >= 3% |
| CTR | +10 | CTR >= 1% |
| CTR | +5 | CTR >= 0.5% |
| Conversions | +20 | >= 50 conversions |
| Conversions | +15 | >= 20 conversions |
| Conversions | +10 | >= 5 conversions |
| Conversions | +5 | >= 1 conversion |
| CPA | +15 | CPA <= $20 |
| CPA | +10 | CPA <= $50 |
| CPA | +5 | CPA <= $100 |
| Budget Utilization | +10 | 80-110% utilized |
| Budget Utilization | -10 | < 50% utilized |
| No Conversions Penalty | -15 | 0 conversions AND spend > $100 |

**Score Range**: 0-100 (clamped)

---

## Data Sources

All campaign data comes from the Google Ads API:

| Field | Google Ads Metric |
|-------|-------------------|
| `spend` | `metrics.cost_micros / 1,000,000` |
| `conversions` | `metrics.conversions` |
| `clicks` | `metrics.clicks` |
| `impressions` | `metrics.impressions` |
| `ctr` | `metrics.ctr * 100` |
| `cpa` | `spend / conversions` (calculated) |
| `dailyBudget` | `campaign_budget.amount_micros / 1,000,000` |
| `status` | `campaign.status` (ENABLED, PAUSED, REMOVED) |

---

## Configuration

| Setting | Default | Storage |
|---------|---------|---------|
| `wasterThreshold` | 40 | localStorage (`quickads_waster_threshold`) |
| Cache Duration | 5 minutes | In-memory |

---

## Last Updated
- **Date**: January 6, 2026
- **Commit**: `2366203` - fix: Remove fake KPI data, show real metrics
