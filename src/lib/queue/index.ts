/**
 * Queue Module Exports
 *
 * Provides background job processing for Google Ads data refresh
 */

// Redis connection
export { getRedisConnection, isRedisAvailable, closeRedisConnection } from './redis';

// Queue service
export {
  initRefreshQueue,
  isQueueReady,
  getRefreshQueue,
  enqueueCampaignRefresh,
  enqueueAdGroupRefresh,
  enqueueKeywordRefresh,
  enqueueAdRefresh,
  enqueueReportRefresh,
  enqueueRefreshJob,
  getQueueStats,
  getRecentJobs,
  getLastRefreshTimes,
  pauseQueue,
  resumeQueue,
  drainQueue,
  closeQueue,
  type RefreshJobData,
  type RefreshJobResult,
  type QueueStats,
} from './refresh-queue';

// Worker
export { startRefreshWorker, stopRefreshWorker } from './refresh-worker';
