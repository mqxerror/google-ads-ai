#!/usr/bin/env node
/**
 * Run migration 016 - Add DataForSEO Search Intent columns
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const config = {
  host: '38.97.60.181',
  port: 5433,
  user: 'postgres',
  password: 'postgres123',
  database: 'postgres',
};

console.log('🔄 Running Migration 016: Add DataForSEO Search Intent columns');
console.log('📍 PostgreSQL:', `${config.user}@${config.host}:${config.port}/${config.database}`);

const migrationPath = path.join(__dirname, 'prisma/migrations/016_dataforseo_intent.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

console.log('📄 Migration SQL loaded:', migrationPath);

async function runMigration() {
  const client = new Client(config);

  try {
    console.log('\n🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('⚡ Executing migration...\n');
    await client.query(migrationSQL);

    console.log('✅ Migration 016 completed successfully!');

    // Verify the columns exist
    console.log('\n📝 Verifying migration...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'keyword_metrics'
        AND column_name LIKE 'dataforseo_intent%';
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification passed! DataForSEO Intent columns exist:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('❌ Verification failed! Columns not found.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Columns may already exist - that\'s OK!');
    }
  } finally {
    await client.end();
    console.log('\n🔌 Connection closed.');
  }
}

runMigration();
