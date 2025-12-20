/**
 * Sync Module
 *
 * Exports for background sync infrastructure.
 */

export { getRedisConnection, isRedisConnected, closeRedisConnection } from './redis';
export {
  getSyncQueue,
  getBackfillQueue,
  enqueueSyncJob,
  enqueueBackfillJob,
  getQueueStats,
  cleanupOldJobs,
  closeQueues,
  QUEUE_NAMES,
  type SyncJobData,
  type BackfillJobData,
} from './queue';
export {
  startSyncWorker,
  startBackfillWorker,
  stopWorkers,
  areWorkersRunning,
} from './worker';
