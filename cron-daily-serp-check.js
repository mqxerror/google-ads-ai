#!/usr/bin/env node
/**
 * Daily SERP Position Checker - Cron Script
 *
 * This script triggers the daily SERP position check via HTTP API call.
 * Use this with system cron job (since we're on Dokploy, not Vercel).
 *
 * Setup Instructions:
 * 1. Make executable: chmod +x cron-daily-serp-check.js
 * 2. Add to crontab: crontab -e
 * 3. Add line: 0 3 * * * /path/to/cron-daily-serp-check.js >> /var/log/serp-check.log 2>&1
 *
 * Schedule: 0 3 * * * = Daily at 3 AM UTC
 *
 * Environment Variables Required:
 * - CRON_SECRET: Secret key to authenticate cron requests
 */

const https = require('https');

// Configuration
const API_URL = process.env.API_URL || 'https://ads.mercan.com';
const CRON_SECRET = process.env.CRON_SECRET || '';
const ENDPOINT = '/api/cron/serp-daily-check';

if (!CRON_SECRET) {
  console.error('❌ Error: CRON_SECRET environment variable not set');
  process.exit(1);
}

console.log(`[${new Date().toISOString()}] Starting SERP Daily Check...`);
console.log(`URL: ${API_URL}${ENDPOINT}`);

// Make HTTP request to trigger the cron job
const url = new URL(ENDPOINT, API_URL);

const options = {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${CRON_SECRET}`,
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes timeout
};

const req = https.request(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);

    try {
      const result = JSON.parse(data);
      console.log('Response:', JSON.stringify(result, null, 2));

      if (result.success) {
        console.log(`✅ Success: ${result.message}`);
        if (result.stats) {
          console.log(`   - Total keywords: ${result.stats.total}`);
          console.log(`   - Successful: ${result.stats.successful}`);
          console.log(`   - Failed: ${result.stats.failed}`);
          console.log(`   - Cost: $${result.stats.costDollars.toFixed(2)}`);
          console.log(`   - Duration: ${result.stats.durationSeconds}s`);
        }
        process.exit(0);
      } else {
        console.error(`❌ Error: ${result.error || result.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error.message);
      console.error('Raw response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error(`❌ Request failed: ${error.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Request timed out after 5 minutes');
  req.destroy();
  process.exit(1);
});

req.end();
