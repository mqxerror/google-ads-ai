/**
 * Database operations for Unified Campaign System
 * Handles CRUD for campaigns, ad groups, asset groups, keywords, and assets
 */

import { Pool, QueryResult } from 'pg';
import type {
  Campaign,
  CampaignType,
  CampaignStatus,
  BiddingStrategy,
  AdGroup,
  AssetGroup,
  Keyword,
  NegativeKeyword,
  Asset,
  AssetLink,
  Audience,
  AudienceTargeting,
  CampaignPerformance,
  MatchType,
  AssetType,
  AssetFieldType,
} from '@/types/campaign';

// PostgreSQL connection pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || '38.97.60.181',
      port: parseInt(process.env.POSTGRES_PORT || '5433'),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres123',
      database: process.env.POSTGRES_DATABASE || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

async function query(text: string, params?: any[]): Promise<QueryResult> {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// ============================================
// CAMPAIGNS
// ============================================

interface CreateCampaignParams {
  userId: string;
  name: string;
  type: CampaignType;
  status?: CampaignStatus;
  targetLocations?: string[];
  targetLanguages?: string[];
  dailyBudget?: number;
  biddingStrategy?: BiddingStrategy;
  targetCpa?: number;
  targetRoas?: number;
  startDate?: string;
  endDate?: string;
  includeSearchPartners?: boolean;
  includeDisplayNetwork?: boolean;
  finalUrl?: string;
  trackingTemplate?: string;
  intelligenceProjectId?: string;
}

export async function createCampaign(params: CreateCampaignParams): Promise<Campaign> {
  const result = await query(
    `INSERT INTO campaigns (
      user_id, name, type, status,
      target_locations, target_languages,
      daily_budget, bidding_strategy, target_cpa, target_roas,
      start_date, end_date,
      include_search_partners, include_display_network,
      final_url, tracking_template,
      intelligence_project_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
    [
      params.userId,
      params.name,
      params.type,
      params.status || 'DRAFT',
      JSON.stringify(params.targetLocations || []),
      JSON.stringify(params.targetLanguages || ['en']),
      params.dailyBudget,
      params.biddingStrategy,
      params.targetCpa,
      params.targetRoas,
      params.startDate,
      params.endDate,
      params.includeSearchPartners || false,
      params.includeDisplayNetwork || false,
      params.finalUrl,
      params.trackingTemplate,
      params.intelligenceProjectId,
    ]
  );

  return mapCampaignFromDb(result.rows[0]);
}

export async function getCampaigns(userId: string, type?: CampaignType): Promise<Campaign[]> {
  let queryStr = `
    SELECT * FROM campaigns
    WHERE user_id = $1
  `;
  const params: any[] = [userId];

  if (type) {
    queryStr += ` AND type = $2`;
    params.push(type);
  }

  queryStr += ` ORDER BY created_at DESC`;

  const result = await query(queryStr, params);
  return result.rows.map(mapCampaignFromDb);
}

export async function getCampaignById(id: string, userId: string): Promise<Campaign | null> {
  const result = await query(
    `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (result.rows.length === 0) return null;
  return mapCampaignFromDb(result.rows[0]);
}

export async function updateCampaign(
  id: string,
  userId: string,
  updates: Partial<CreateCampaignParams>
): Promise<Campaign | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: any[] = [];
  let paramIndex = 1;

  const fieldMap: Record<string, string> = {
    name: 'name',
    type: 'type',
    status: 'status',
    dailyBudget: 'daily_budget',
    biddingStrategy: 'bidding_strategy',
    targetCpa: 'target_cpa',
    targetRoas: 'target_roas',
    startDate: 'start_date',
    endDate: 'end_date',
    includeSearchPartners: 'include_search_partners',
    includeDisplayNetwork: 'include_display_network',
    finalUrl: 'final_url',
    trackingTemplate: 'tracking_template',
    intelligenceProjectId: 'intelligence_project_id',
  };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && fieldMap[key]) {
      if (key === 'targetLocations' || key === 'targetLanguages') {
        setClauses.push(`${fieldMap[key]} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        setClauses.push(`${fieldMap[key]} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    }
  }

  values.push(id, userId);

  const result = await query(
    `UPDATE campaigns SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return mapCampaignFromDb(result.rows[0]);
}

export async function updateCampaignGoogleId(
  id: string,
  googleCampaignId: string
): Promise<void> {
  await query(
    `UPDATE campaigns SET google_campaign_id = $1, synced_at = NOW() WHERE id = $2`,
    [googleCampaignId, id]
  );
}

export async function deleteCampaign(id: string, userId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM campaigns WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

function mapCampaignFromDb(row: any): Campaign {
  return {
    id: row.id,
    userId: row.user_id,
    googleCampaignId: row.google_campaign_id,
    name: row.name,
    type: row.type,
    status: row.status,
    targetLocations: typeof row.target_locations === 'string'
      ? JSON.parse(row.target_locations)
      : row.target_locations || [],
    targetLanguages: typeof row.target_languages === 'string'
      ? JSON.parse(row.target_languages)
      : row.target_languages || ['en'],
    dailyBudget: row.daily_budget ? parseFloat(row.daily_budget) : undefined,
    biddingStrategy: row.bidding_strategy,
    targetCpa: row.target_cpa ? parseFloat(row.target_cpa) : undefined,
    targetRoas: row.target_roas ? parseFloat(row.target_roas) : undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    includeSearchPartners: row.include_search_partners,
    includeDisplayNetwork: row.include_display_network,
    finalUrl: row.final_url,
    trackingTemplate: row.tracking_template,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
    intelligenceProjectId: row.intelligence_project_id,
  };
}

// ============================================
// AD GROUPS
// ============================================

interface CreateAdGroupParams {
  campaignId: string;
  name: string;
  status?: string;
  cpcBid?: number;
  targetingType?: string;
}

export async function createAdGroup(params: CreateAdGroupParams): Promise<AdGroup> {
  const result = await query(
    `INSERT INTO ad_groups (campaign_id, name, status, cpc_bid, targeting_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.campaignId,
      params.name,
      params.status || 'ENABLED',
      params.cpcBid,
      params.targetingType,
    ]
  );

  return mapAdGroupFromDb(result.rows[0]);
}

export async function getAdGroupsByCampaign(campaignId: string): Promise<AdGroup[]> {
  const result = await query(
    `SELECT * FROM ad_groups WHERE campaign_id = $1 ORDER BY created_at ASC`,
    [campaignId]
  );
  return result.rows.map(mapAdGroupFromDb);
}

export async function getAdGroupById(id: string): Promise<AdGroup | null> {
  const result = await query(`SELECT * FROM ad_groups WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return mapAdGroupFromDb(result.rows[0]);
}

export async function updateAdGroupGoogleId(id: string, googleAdGroupId: string): Promise<void> {
  await query(`UPDATE ad_groups SET google_ad_group_id = $1 WHERE id = $2`, [googleAdGroupId, id]);
}

export async function deleteAdGroup(id: string): Promise<boolean> {
  const result = await query(`DELETE FROM ad_groups WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

function mapAdGroupFromDb(row: any): AdGroup {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    googleAdGroupId: row.google_ad_group_id,
    name: row.name,
    status: row.status,
    cpcBid: row.cpc_bid ? parseFloat(row.cpc_bid) : undefined,
    targetingType: row.targeting_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// ASSET GROUPS (PMax, Demand Gen)
// ============================================

interface CreateAssetGroupParams {
  campaignId: string;
  name: string;
  finalUrl: string;
  path1?: string;
  path2?: string;
  status?: string;
}

export async function createAssetGroup(params: CreateAssetGroupParams): Promise<AssetGroup> {
  const result = await query(
    `INSERT INTO asset_groups (campaign_id, name, final_url, path1, path2, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.campaignId,
      params.name,
      params.finalUrl,
      params.path1,
      params.path2,
      params.status || 'ENABLED',
    ]
  );

  return mapAssetGroupFromDb(result.rows[0]);
}

export async function getAssetGroupsByCampaign(campaignId: string): Promise<AssetGroup[]> {
  const result = await query(
    `SELECT * FROM asset_groups WHERE campaign_id = $1 ORDER BY created_at ASC`,
    [campaignId]
  );
  return result.rows.map(mapAssetGroupFromDb);
}

export async function getAssetGroupById(id: string): Promise<AssetGroup | null> {
  const result = await query(`SELECT * FROM asset_groups WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return mapAssetGroupFromDb(result.rows[0]);
}

export async function updateAssetGroupGoogleId(id: string, googleAssetGroupId: string): Promise<void> {
  await query(`UPDATE asset_groups SET google_asset_group_id = $1, updated_at = NOW() WHERE id = $2`, [googleAssetGroupId, id]);
}

export async function deleteAssetGroup(id: string): Promise<boolean> {
  const result = await query(`DELETE FROM asset_groups WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

function mapAssetGroupFromDb(row: any): AssetGroup {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    googleAssetGroupId: row.google_asset_group_id,
    name: row.name,
    status: row.status,
    finalUrl: row.final_url,
    path1: row.path1,
    path2: row.path2,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// CAMPAIGN KEYWORDS
// ============================================

interface CreateKeywordParams {
  adGroupId: string;
  keyword: string;
  matchType: MatchType;
  status?: string;
  cpcBid?: number;
}

export async function createCampaignKeyword(params: CreateKeywordParams): Promise<Keyword> {
  const result = await query(
    `INSERT INTO campaign_keywords (ad_group_id, keyword, match_type, status, cpc_bid)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.adGroupId,
      params.keyword,
      params.matchType,
      params.status || 'ENABLED',
      params.cpcBid,
    ]
  );

  return mapKeywordFromDb(result.rows[0]);
}

export async function createCampaignKeywordsBulk(
  adGroupId: string,
  keywords: Array<{ keyword: string; matchType: MatchType; cpcBid?: number }>
): Promise<Keyword[]> {
  if (keywords.length === 0) return [];

  const values: any[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const kw of keywords) {
    placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, 'ENABLED', $${paramIndex + 3})`);
    values.push(adGroupId, kw.keyword, kw.matchType, kw.cpcBid || null);
    paramIndex += 4;
  }

  const result = await query(
    `INSERT INTO campaign_keywords (ad_group_id, keyword, match_type, status, cpc_bid)
     VALUES ${placeholders.join(', ')}
     RETURNING *`,
    values
  );

  return result.rows.map(mapKeywordFromDb);
}

export async function getKeywordsByAdGroup(adGroupId: string): Promise<Keyword[]> {
  const result = await query(
    `SELECT * FROM campaign_keywords WHERE ad_group_id = $1 ORDER BY created_at ASC`,
    [adGroupId]
  );
  return result.rows.map(mapKeywordFromDb);
}

export async function deleteKeywordsByAdGroup(adGroupId: string): Promise<void> {
  await query(`DELETE FROM campaign_keywords WHERE ad_group_id = $1`, [adGroupId]);
}

function mapKeywordFromDb(row: any): Keyword {
  return {
    id: row.id,
    adGroupId: row.ad_group_id,
    googleKeywordId: row.google_keyword_id,
    keyword: row.keyword,
    matchType: row.match_type,
    status: row.status,
    cpcBid: row.cpc_bid ? parseFloat(row.cpc_bid) : undefined,
    qualityScore: row.quality_score,
    createdAt: row.created_at,
  };
}

// ============================================
// NEGATIVE KEYWORDS
// ============================================

interface CreateNegativeKeywordParams {
  campaignId?: string;
  adGroupId?: string;
  keyword: string;
  matchType: MatchType;
  level: 'CAMPAIGN' | 'AD_GROUP';
}

export async function createNegativeKeyword(params: CreateNegativeKeywordParams): Promise<NegativeKeyword> {
  const result = await query(
    `INSERT INTO campaign_negative_keywords (campaign_id, ad_group_id, keyword, match_type, level)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.campaignId, params.adGroupId, params.keyword, params.matchType, params.level]
  );

  return mapNegativeKeywordFromDb(result.rows[0]);
}

export async function createNegativeKeywordsBulk(
  campaignId: string,
  keywords: string[],
  matchType: MatchType = 'BROAD'
): Promise<NegativeKeyword[]> {
  if (keywords.length === 0) return [];

  const values: any[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const keyword of keywords) {
    placeholders.push(`($${paramIndex}, NULL, $${paramIndex + 1}, $${paramIndex + 2}, 'CAMPAIGN')`);
    values.push(campaignId, keyword, matchType);
    paramIndex += 3;
  }

  const result = await query(
    `INSERT INTO campaign_negative_keywords (campaign_id, ad_group_id, keyword, match_type, level)
     VALUES ${placeholders.join(', ')}
     RETURNING *`,
    values
  );

  return result.rows.map(mapNegativeKeywordFromDb);
}

export async function getNegativeKeywordsByCampaign(campaignId: string): Promise<NegativeKeyword[]> {
  const result = await query(
    `SELECT * FROM campaign_negative_keywords WHERE campaign_id = $1 ORDER BY created_at ASC`,
    [campaignId]
  );
  return result.rows.map(mapNegativeKeywordFromDb);
}

export async function deleteNegativeKeyword(id: string): Promise<boolean> {
  const result = await query(`DELETE FROM campaign_negative_keywords WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

function mapNegativeKeywordFromDb(row: any): NegativeKeyword {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    adGroupId: row.ad_group_id,
    keyword: row.keyword,
    matchType: row.match_type,
    level: row.level,
    createdAt: row.created_at,
  };
}

// ============================================
// ASSETS
// ============================================

interface CreateAssetParams {
  userId: string;
  type: AssetType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  durationSeconds?: number;
  youtubeVideoId?: string;
  contentHash?: string;
}

export async function createAsset(params: CreateAssetParams): Promise<Asset> {
  const result = await query(
    `INSERT INTO campaign_assets (
      user_id, type, content, file_url, file_name, file_size, mime_type,
      width, height, aspect_ratio, duration_seconds, youtube_video_id, content_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (user_id, content_hash) DO UPDATE SET content = EXCLUDED.content
    RETURNING *`,
    [
      params.userId,
      params.type,
      params.content,
      params.fileUrl,
      params.fileName,
      params.fileSize,
      params.mimeType,
      params.width,
      params.height,
      params.aspectRatio,
      params.durationSeconds,
      params.youtubeVideoId,
      params.contentHash,
    ]
  );

  return mapAssetFromDb(result.rows[0]);
}

export async function getAssetsByUser(userId: string, type?: AssetType): Promise<Asset[]> {
  let queryStr = `SELECT * FROM campaign_assets WHERE user_id = $1`;
  const params: any[] = [userId];

  if (type) {
    queryStr += ` AND type = $2`;
    params.push(type);
  }

  queryStr += ` ORDER BY created_at DESC`;

  const result = await query(queryStr, params);
  return result.rows.map(mapAssetFromDb);
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const result = await query(`SELECT * FROM campaign_assets WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return mapAssetFromDb(result.rows[0]);
}

export async function deleteAsset(id: string, userId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM campaign_assets WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

function mapAssetFromDb(row: any): Asset {
  return {
    id: row.id,
    userId: row.user_id,
    googleAssetId: row.google_asset_id,
    type: row.type,
    content: row.content,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    aspectRatio: row.aspect_ratio,
    durationSeconds: row.duration_seconds,
    youtubeVideoId: row.youtube_video_id,
    contentHash: row.content_hash,
    createdAt: row.created_at,
  };
}

// ============================================
// ASSET LINKS
// ============================================

interface CreateAssetLinkParams {
  assetId: string;
  adGroupId?: string;
  assetGroupId?: string;
  fieldType: AssetFieldType;
  position?: number;
}

export async function createAssetLink(params: CreateAssetLinkParams): Promise<AssetLink> {
  const result = await query(
    `INSERT INTO asset_links (asset_id, ad_group_id, asset_group_id, field_type, position)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.assetId, params.adGroupId, params.assetGroupId, params.fieldType, params.position || 0]
  );

  return mapAssetLinkFromDb(result.rows[0]);
}

export async function getAssetLinksByAdGroup(adGroupId: string): Promise<AssetLink[]> {
  const result = await query(
    `SELECT al.*, a.type, a.content, a.file_url, a.file_name
     FROM asset_links al
     JOIN campaign_assets a ON al.asset_id = a.id
     WHERE al.ad_group_id = $1
     ORDER BY al.field_type, al.position`,
    [adGroupId]
  );

  return result.rows.map((row: any) => ({
    ...mapAssetLinkFromDb(row),
    asset: mapAssetFromDb(row),
  }));
}

export async function getAssetLinksByAssetGroup(assetGroupId: string): Promise<AssetLink[]> {
  const result = await query(
    `SELECT al.*, a.type, a.content, a.file_url, a.file_name
     FROM asset_links al
     JOIN campaign_assets a ON al.asset_id = a.id
     WHERE al.asset_group_id = $1
     ORDER BY al.field_type, al.position`,
    [assetGroupId]
  );

  return result.rows.map((row: any) => ({
    ...mapAssetLinkFromDb(row),
    asset: mapAssetFromDb(row),
  }));
}

export async function deleteAssetLink(id: string): Promise<boolean> {
  const result = await query(`DELETE FROM asset_links WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

function mapAssetLinkFromDb(row: any): AssetLink {
  return {
    id: row.id,
    assetId: row.asset_id,
    adGroupId: row.ad_group_id,
    assetGroupId: row.asset_group_id,
    fieldType: row.field_type,
    position: row.position,
    performanceLabel: row.performance_label,
    createdAt: row.created_at,
  };
}

// ============================================
// AUDIENCES
// ============================================

interface CreateAudienceParams {
  userId: string;
  name: string;
  type: string;
  definition?: object;
}

export async function createAudience(params: CreateAudienceParams): Promise<Audience> {
  const result = await query(
    `INSERT INTO campaign_audiences (user_id, name, type, definition)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.userId, params.name, params.type, JSON.stringify(params.definition || {})]
  );

  return mapAudienceFromDb(result.rows[0]);
}

export async function getAudiencesByUser(userId: string): Promise<Audience[]> {
  const result = await query(
    `SELECT * FROM campaign_audiences WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(mapAudienceFromDb);
}

export async function deleteAudience(id: string, userId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM campaign_audiences WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

function mapAudienceFromDb(row: any): Audience {
  return {
    id: row.id,
    userId: row.user_id,
    googleAudienceId: row.google_audience_id,
    name: row.name,
    type: row.type,
    definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// CAMPAIGN PERFORMANCE
// ============================================

export async function upsertCampaignPerformance(
  campaignId: string,
  date: string,
  metrics: Partial<CampaignPerformance>
): Promise<void> {
  await query(
    `INSERT INTO campaign_performance (
      campaign_id, date, impressions, clicks, cost, conversions, conversion_value,
      ctr, cpc, cpa, roas, video_views
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (campaign_id, date) DO UPDATE SET
      impressions = COALESCE($3, campaign_performance.impressions),
      clicks = COALESCE($4, campaign_performance.clicks),
      cost = COALESCE($5, campaign_performance.cost),
      conversions = COALESCE($6, campaign_performance.conversions),
      conversion_value = COALESCE($7, campaign_performance.conversion_value),
      ctr = COALESCE($8, campaign_performance.ctr),
      cpc = COALESCE($9, campaign_performance.cpc),
      cpa = COALESCE($10, campaign_performance.cpa),
      roas = COALESCE($11, campaign_performance.roas),
      video_views = COALESCE($12, campaign_performance.video_views),
      synced_at = NOW()`,
    [
      campaignId,
      date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost,
      metrics.conversions,
      metrics.conversionValue,
      metrics.ctr,
      metrics.cpc,
      metrics.cpa,
      metrics.roas,
      metrics.videoViews,
    ]
  );
}

export async function getCampaignPerformance(
  campaignId: string,
  startDate: string,
  endDate: string
): Promise<CampaignPerformance[]> {
  const result = await query(
    `SELECT * FROM campaign_performance
     WHERE campaign_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date ASC`,
    [campaignId, startDate, endDate]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    campaignId: row.campaign_id,
    date: row.date,
    impressions: row.impressions,
    clicks: row.clicks,
    cost: parseFloat(row.cost),
    conversions: parseFloat(row.conversions),
    conversionValue: parseFloat(row.conversion_value),
    ctr: parseFloat(row.ctr),
    cpc: parseFloat(row.cpc),
    cpa: row.cpa ? parseFloat(row.cpa) : undefined,
    roas: row.roas ? parseFloat(row.roas) : undefined,
    videoViews: row.video_views,
    syncedAt: row.synced_at,
  }));
}

// ============================================
// FULL CAMPAIGN WITH RELATIONS
// ============================================

export async function getCampaignWithRelations(
  id: string,
  userId: string
): Promise<Campaign | null> {
  const campaign = await getCampaignById(id, userId);
  if (!campaign) return null;

  // Fetch ad groups with keywords
  const adGroups = await getAdGroupsByCampaign(id);
  for (const adGroup of adGroups) {
    adGroup.keywords = await getKeywordsByAdGroup(adGroup.id);
    adGroup.assets = await getAssetLinksByAdGroup(adGroup.id);
  }
  campaign.adGroups = adGroups;

  // Fetch asset groups (for PMax/Demand Gen)
  const assetGroups = await getAssetGroupsByCampaign(id);
  for (const assetGroup of assetGroups) {
    assetGroup.assets = await getAssetLinksByAssetGroup(assetGroup.id);
  }
  campaign.assetGroups = assetGroups;

  return campaign;
}
