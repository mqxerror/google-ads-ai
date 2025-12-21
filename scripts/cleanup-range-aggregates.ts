#!/usr/bin/env npx tsx
/**
 * Cleanup Range Aggregates Migration
 *
 * This script removes all previously cached MetricsFact rows that may contain
 * range-aggregated data instead of per-day data.
 *
 * Background:
 * The old storage code stored range totals (e.g., 7-day sums) with date = endDate.
 * This polluted the cache - when "Yesterday" was requested, it could return
 * a 7-day total from a previously cached "Last 7 Days" query.
 *
 * Solution:
 * 1. Delete all MetricsFact rows (they're all potentially corrupted)
 * 2. The next API requests will repopulate with correct per-day data
 *
 * Usage:
 *   npx tsx scripts/cleanup-range-aggregates.ts
 *   npx tsx scripts/cleanup-range-aggregates.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('METRICS CACHE CLEANUP');
  console.log('='.repeat(60));
  console.log('');
  console.log('This script will delete all MetricsFact rows to remove');
  console.log('potentially corrupted range-aggregated data.');
  console.log('');

  if (isDryRun) {
    console.log('MODE: DRY RUN (no changes will be made)');
  } else {
    console.log('MODE: LIVE (data will be deleted)');
  }
  console.log('');

  // Count rows before cleanup
  const campaignCount = await prisma.metricsFact.count({
    where: { entityType: 'CAMPAIGN' },
  });

  const adGroupCount = await prisma.metricsFact.count({
    where: { entityType: 'AD_GROUP' },
  });

  const keywordCount = await prisma.metricsFact.count({
    where: { entityType: 'KEYWORD' },
  });

  const adCount = await prisma.metricsFact.count({
    where: { entityType: 'AD' },
  });

  const totalCount = campaignCount + adGroupCount + keywordCount + adCount;

  console.log('Current MetricsFact row counts:');
  console.log(`  CAMPAIGN:  ${campaignCount.toLocaleString()}`);
  console.log(`  AD_GROUP:  ${adGroupCount.toLocaleString()}`);
  console.log(`  KEYWORD:   ${keywordCount.toLocaleString()}`);
  console.log(`  AD:        ${adCount.toLocaleString()}`);
  console.log(`  ─────────────────────`);
  console.log(`  TOTAL:     ${totalCount.toLocaleString()}`);
  console.log('');

  if (totalCount === 0) {
    console.log('No rows to delete. Cache is already empty.');
    return;
  }

  if (isDryRun) {
    console.log(`[DRY RUN] Would delete ${totalCount.toLocaleString()} rows.`);
    console.log('');
    console.log('Run without --dry-run to execute.');
    return;
  }

  // Confirm before deletion
  console.log('Deleting all MetricsFact rows...');

  const result = await prisma.metricsFact.deleteMany({});

  console.log('');
  console.log(`✅ Deleted ${result.count.toLocaleString()} MetricsFact rows.`);
  console.log('');
  console.log('Next steps:');
  console.log('1. The cache is now clean.');
  console.log('2. Next API requests will fetch fresh per-day data.');
  console.log('3. Data will be cached correctly with one row per day.');
  console.log('');
  console.log('='.repeat(60));
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
