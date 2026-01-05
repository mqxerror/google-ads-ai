/**
 * Database operations for Keyword Center
 * Central export for all database CRUD functions
 */

// Export all types
export * from './types';

// Export Lists operations
export {
  createKeywordList,
  getKeywordLists,
  getKeywordListById,
  updateKeywordList,
  deleteKeywordList,
  addKeywordsToList,
  getListItems,
  removeKeywordsFromList,
  updateListItemPosition,
  updateListItemNotes,
  getListsByKeyword,
  searchLists,
} from './lists';

// Export Tags operations
export {
  createKeywordTag,
  getKeywordTags,
  getKeywordTagById,
  updateKeywordTag,
  deleteKeywordTag,
  assignTagsToKeywords,
  unassignTagsFromKeywords,
  getTagsForKeyword,
  getKeywordsForTag,
  getTagAssignments,
  bulkAssignTag,
  bulkUnassignTag,
  removeAllTagsFromKeyword,
  searchTags,
  getMostUsedTags,
} from './tags';

// Export Account Data operations
export {
  upsertKeywordAccountData,
  getKeywordAccountData,
  checkKeywordInAccount,
  getAccountKeywordsBatch,
  deleteOldAccountData,
  upsertKeywordPerformance,
  getKeywordPerformance,
  getKeywordPerformanceSummary,
  getPerformanceTrends,
  getLastSyncTime,
  getAccountKeywordCount,
  getCampaignKeywordCounts,
} from './account-data';

// Export Campaign operations
export {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  updateCampaignGoogleId,
  deleteCampaign,
  createAdGroup,
  getAdGroupsByCampaign,
  getAdGroupById,
  updateAdGroupGoogleId,
  deleteAdGroup,
  createAssetGroup,
  getAssetGroupsByCampaign,
  getAssetGroupById,
  updateAssetGroupGoogleId,
  deleteAssetGroup,
  createCampaignKeyword,
  createCampaignKeywordsBulk,
  getKeywordsByAdGroup,
  deleteKeywordsByAdGroup,
  createNegativeKeyword,
  createNegativeKeywordsBulk,
  getNegativeKeywordsByCampaign,
  deleteNegativeKeyword,
  createAsset,
  getAssetsByUser,
  getAssetById,
  deleteAsset,
  createAssetLink,
  getAssetLinksByAdGroup,
  getAssetLinksByAssetGroup,
  deleteAssetLink,
  createAudience,
  getAudiencesByUser,
  deleteAudience,
  upsertCampaignPerformance,
  getCampaignPerformance,
  getCampaignWithRelations,
} from './campaigns';
