#!/usr/bin/env npx ts-node
/**
 * Standalone Worker Process
 *
 * Run with: npm run worker
 *
 * This starts the BullMQ worker that processes background refresh jobs.
 * It should run alongside the main Next.js application.
 */

// Load environment variables FIRST, before any other imports
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env first, then .env.local (which overrides)
// Use override: true to ensure values are actually set
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

import { startRefreshWorker, stopRefreshWorker } from '../src/lib/queue/refresh-worker';

console.log('[Worker] Starting refresh worker...');
console.log('[Worker] Redis URL:', process.env.REDIS_URL || 'localhost:6379');

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'DATABASE_URL',
];

const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('[Worker] ERROR: Missing required environment variables:', missing.join(', '));
  console.error('[Worker] Make sure .env or .env.local files are properly configured');
  process.exit(1);
}

console.log('[Worker] Environment loaded:');
console.log('  GOOGLE_CLIENT_ID=', `"${process.env.GOOGLE_CLIENT_ID}"`.slice(0, 40));
console.log('  GOOGLE_CLIENT_SECRET=', process.env.GOOGLE_CLIENT_SECRET ? 'set (' + process.env.GOOGLE_CLIENT_SECRET.length + ' chars)' : 'NOT SET');
console.log('  GOOGLE_ADS_DEVELOPER_TOKEN=', process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? 'set' : 'NOT SET');
console.log('  DATABASE_URL=', process.env.DATABASE_URL?.slice(0, 30) + '...');

// Verify env vars are not empty strings
if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.length < 10) {
  console.error('[Worker] ERROR: GOOGLE_CLIENT_ID is empty or invalid!');
  process.exit(1);
}
if (!process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET.length < 10) {
  console.error('[Worker] ERROR: GOOGLE_CLIENT_SECRET is empty or invalid!');
  process.exit(1);
}

startRefreshWorker()
  .then(() => {
    console.log('[Worker] Refresh worker started successfully');
    console.log('[Worker] Listening for jobs on queue: gads-refresh');
  })
  .catch((err) => {
    console.error('[Worker] Failed to start:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, shutting down...');
  await stopRefreshWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, shutting down...');
  await stopRefreshWorker();
  process.exit(0);
});

// Keep process alive
process.stdin.resume();
