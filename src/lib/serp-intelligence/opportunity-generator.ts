/**
 * AI-Powered PPC Opportunity Generator
 *
 * Analyzes SERP data to identify PPC opportunities:
 * - Weak organic positions → suggest ad campaigns
 * - High competitor ads → adjust bidding strategy
 * - SERP features → recommend campaign types
 * - Strong organic → suggest pausing ads
 */

import { pool } from '@/lib/database/serp-intelligence';

interface KeywordWithSnapshot {
  keyword_id: string;
  keyword: string;
  target_domain: string;
  organic_position: number | null;
  position_change: number | null;
  competitor_ads_count: number;
  shopping_ads_present: boolean;
  local_pack_present: boolean;
  featured_snippet: boolean;
  snapshot_date: string;
}

interface Opportunity {
  keyword_id: string;
  user_id: string;
  opportunity_type: string;
  priority: 'high' | 'medium' | 'low';
  recommendation_text: string;
  suggested_action: string;
  estimated_impact: any;
}

/**
 * Generate PPC opportunities for a user's tracked keywords
 */
export async function generatePPCOpportunities(userId: string, customerId: string): Promise<Opportunity[]> {
  console.log(`[Opportunities] Generating for user ${userId}, customer ${customerId}`);

  // Fetch all tracked keywords with latest snapshots
  const result = await pool.query(
    `
    SELECT
      tk.id as keyword_id,
      tk.keyword,
      tk.target_domain,
      s.organic_position,
      s.position_change,
      s.competitor_ads_count,
      s.shopping_ads_present,
      s.local_pack_present,
      s.featured_snippet,
      s.snapshot_date
    FROM tracked_keywords tk
    LEFT JOIN LATERAL (
      SELECT *
      FROM serp_snapshots
      WHERE tracked_keyword_id = tk.id
      ORDER BY snapshot_date DESC
      LIMIT 1
    ) s ON true
    WHERE tk.user_id = $1
      AND tk.customer_id = $2
      AND tk.is_active = true
    `,
    [userId, customerId]
  );

  const keywords: KeywordWithSnapshot[] = result.rows;
  const opportunities: Opportunity[] = [];

  for (const kw of keywords) {
    // Skip keywords without snapshots
    if (!kw.snapshot_date) continue;

    // Opportunity 1: Weak Organic Position (>10)
    if (kw.organic_position && kw.organic_position > 10) {
      opportunities.push({
        keyword_id: kw.keyword_id,
        user_id: userId,
        opportunity_type: 'weak_organic',
        priority: kw.organic_position > 20 ? 'high' : 'medium',
        recommendation_text: `"${kw.keyword}" ranks at position #${kw.organic_position}. Consider adding to a paid campaign to capture traffic.`,
        suggested_action: 'create_campaign',
        estimated_impact: {
          current_position: kw.organic_position,
          competitor_ads: kw.competitor_ads_count,
          reasoning: 'Weak organic position with competitor ad presence',
        },
      });
    }

    // Opportunity 2: Position Drop (>5 positions)
    if (kw.position_change && kw.position_change < -5) {
      opportunities.push({
        keyword_id: kw.keyword_id,
        user_id: userId,
        opportunity_type: 'position_drop',
        priority: 'high',
        recommendation_text: `"${kw.keyword}" dropped ${Math.abs(kw.position_change)} positions. Launch protective ad campaign to maintain visibility.`,
        suggested_action: 'create_campaign',
        estimated_impact: {
          position_change: kw.position_change,
          current_position: kw.organic_position,
          urgency: 'immediate',
        },
      });
    }

    // Opportunity 3: High Competition (6+ competitor ads)
    if (kw.competitor_ads_count >= 6) {
      opportunities.push({
        keyword_id: kw.keyword_id,
        user_id: userId,
        opportunity_type: 'high_competition',
        priority: kw.organic_position && kw.organic_position > 5 ? 'high' : 'medium',
        recommendation_text: `"${kw.keyword}" has ${kw.competitor_ads_count} competitor ads. ${
          kw.organic_position && kw.organic_position > 5
            ? 'Increase bids to compete.'
            : 'Monitor closely for bid adjustments.'
        }`,
        suggested_action: 'adjust_bids',
        estimated_impact: {
          competitor_ads_count: kw.competitor_ads_count,
          current_position: kw.organic_position,
          market_competitiveness: 'high',
        },
      });
    }

    // Opportunity 4: Shopping Ads Present (recommend Shopping campaign)
    if (kw.shopping_ads_present && kw.competitor_ads_count > 0) {
      opportunities.push({
        keyword_id: kw.keyword_id,
        user_id: userId,
        opportunity_type: 'serp_feature',
        priority: 'medium',
        recommendation_text: `"${kw.keyword}" triggers Shopping Ads. Consider creating a Shopping campaign if you have products.`,
        suggested_action: 'create_shopping_campaign',
        estimated_impact: {
          serp_feature: 'shopping_ads',
          competitor_count: kw.competitor_ads_count,
          opportunity: 'product_listing_ads',
        },
      });
    }

    // Opportunity 5: Strong Organic (Top 3) with Ads Running
    // Note: We don't have active campaign data here, so we'll skip this for now
    // Could be enhanced by integrating with Google Ads API

    // Opportunity 6: Featured Snippet Opportunity
    if (kw.featured_snippet && kw.organic_position && kw.organic_position <= 5) {
      // If you have featured snippet + good position, less need for ads
      // But if position is dropping, might want protective campaign
      if (kw.position_change && kw.position_change < -2) {
        opportunities.push({
          keyword_id: kw.keyword_id,
          user_id: userId,
          opportunity_type: 'featured_snippet_risk',
          priority: 'medium',
          recommendation_text: `"${kw.keyword}" has a featured snippet but position is declining. Consider protective ad campaign.`,
          suggested_action: 'monitor',
          estimated_impact: {
            has_featured_snippet: true,
            position_change: kw.position_change,
            risk_level: 'medium',
          },
        });
      }
    }
  }

  console.log(`[Opportunities] Generated ${opportunities.length} opportunities`);
  return opportunities;
}

/**
 * Store opportunities in database (replacing old ones)
 */
export async function storeOpportunities(opportunities: Opportunity[]): Promise<void> {
  if (opportunities.length === 0) return;

  const userId = opportunities[0].user_id;

  // Delete old opportunities for this user
  await pool.query(
    `DELETE FROM serp_opportunities WHERE user_id = $1`,
    [userId]
  );

  // Insert new opportunities
  for (const opp of opportunities) {
    await pool.query(
      `
      INSERT INTO serp_opportunities (
        user_id, tracked_keyword_id, opportunity_type, priority,
        recommendation_text, suggested_action, estimated_impact,
        status, created_at, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW() + INTERVAL '7 days')
      `,
      [
        opp.user_id,
        opp.keyword_id,
        opp.opportunity_type,
        opp.priority,
        opp.recommendation_text,
        opp.suggested_action,
        JSON.stringify(opp.estimated_impact),
      ]
    );
  }

  console.log(`[Opportunities] Stored ${opportunities.length} opportunities`);
}

/**
 * Automatically generate opportunities after SERP check
 */
export async function autoGenerateOpportunitiesAfterCheck(
  userId: string,
  customerId: string
): Promise<void> {
  try {
    const opportunities = await generatePPCOpportunities(userId, customerId);
    await storeOpportunities(opportunities);
  } catch (error) {
    console.error('[Opportunities] Auto-generation failed:', error);
    // Don't throw - this is a background task
  }
}
