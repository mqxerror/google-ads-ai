# TODO: Ad Generation Improvements

## Issue Reported
**Date:** 2026-01-02
**Reporter:** User

### Problem
The ad generation in Step 3 of the Campaign Wizard generates repetitive/identical ad copy when ad groups have the same or similar keywords.

### Current Behavior
- Each ad group is processed independently
- AI generates ad copy based solely on that group's keywords
- Same keywords → Same AI context → Same ad copy
- No differentiation strategy across ad groups

### Example
```
Ad Group 1: "portugal golden visa, portugal visa, golden visa"
Ad Group 2: "portugal golden visa, portugal visa, golden visa"
Result: Both groups get nearly identical ads
```

### Root Cause
File: `/api/campaigns/wizard/generate-ads`
- Ad generation is **keyword-driven**, not **ad-group-name-driven**
- No context about other ad groups
- No uniqueness enforcement

---

## Proposed Solutions (To Discuss)

### Option 1: Differentiation by Ad Group Name
Use the ad group name as context to create unique angles:
```
Ad Group: "Citizenship Portugal Portuguese"
Prompt: "Generate Google Ads copy for [keywords] with focus on citizenship and Portuguese language benefits"

Ad Group: "Portugal Investment Visa"
Prompt: "Generate Google Ads copy for [keywords] with focus on investment requirements and visa process"
```

### Option 2: Variation System
Generate multiple variations per keyword set and distribute them:
- Generate 3-5 different ad copy approaches
- Assign each ad group a different variation
- Ensures diversity even with same keywords

### Option 3: Competitive Angle Assignment
Auto-assign different competitive angles:
- Ad Group 1: "Fast processing" angle
- Ad Group 2: "Low investment" angle
- Ad Group 3: "Family benefits" angle

### Option 4: Advanced Clustering Context
Pass the entire campaign context to AI:
```json
{
  "campaignGoal": "LEADS",
  "allAdGroups": [...],
  "currentAdGroup": {...},
  "instruction": "Generate unique ad copy for this group that differentiates from other groups"
}
```

---

## Technical Implementation Notes

### File to Modify
`src/app/api/campaigns/wizard/generate-ads/route.ts`

### Current Generation Request
```typescript
const prompt = `Generate Google Ads copy for keywords: ${keywords.join(', ')}`;
```

### Suggested Enhancement
```typescript
const prompt = `
Generate Google Ads copy for ad group "${adGroupName}".
Keywords: ${keywords.join(', ')}
Focus: ${getUniqueAngle(adGroupName, allAdGroups)}
Campaign Goal: ${campaignGoal}
Make it unique from other ad groups in this campaign.
`;
```

---

## Action Items
- [ ] Discuss preferred approach with team
- [ ] Review AI prompt engineering best practices
- [ ] Consider A/B testing different ad variations
- [ ] Implement uniqueness scoring/validation
- [ ] Update ad generation UI to show differentiation strategy

---

## Related Files
- `/api/campaigns/wizard/generate-ads/route.ts` - Main generation logic
- `WizardStep3AdCopy.tsx` - UI for ad copy generation
- `WizardStep2AdGroups.tsx` - Ad group naming and organization

---

## Priority
**Medium** - Works but creates repetitive content that may not perform well

## Impact
- User experience: Frustrating to see duplicate ads
- Campaign performance: Less testing of different angles
- Google Ads Quality Score: Repetitive ads may score lower
