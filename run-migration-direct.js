#!/usr/bin/env node
/**
 * Run migration 005 - Add location_id to keyword_metrics
 * Uses direct PostgreSQL connection from SERVER_INFRASTRUCTURE_REFERENCE.md
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL credentials from SERVER_INFRASTRUCTURE_REFERENCE.md
const config = {
  host: '38.97.60.181',
  port: 5433,
  user: 'postgres',
  password: 'postgres123',
  database: 'postgres',
};

console.log('🔄 Running Migration 005: Add location_id to keyword_metrics');
console.log('📍 PostgreSQL:', `${config.user}@${config.host}:${config.port}/${config.database}`);

// Read migration SQL
const migrationPath = path.join(__dirname, 'prisma/migrations/005_add_location_to_cache.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

console.log('📄 Migration SQL loaded:', migrationPath);

async function runMigration() {
  const client = new Client(config);

  try {
    console.log('\n🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Execute the migration SQL
    console.log('⚡ Executing migration...\n');
    const result = await client.query(migrationSQL);

    console.log('✅ Migration 005 completed successfully!');

    // Verify the location_id column exists
    console.log('\n📝 Verifying migration...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'keyword_metrics' AND column_name = 'location_id';
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification passed! Column location_id exists:');
      console.log(verifyResult.rows[0]);
    } else {
      console.log('❌ Verification failed! Column location_id not found.');
    }

    // Show current constraint
    console.log('\n📊 Current unique constraint:');
    const constraintResult = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'keyword_metrics'
        AND constraint_type = 'UNIQUE';
    `);
    console.log(constraintResult.rows);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Column may already exist. Verifying...');

      try {
        const verifyResult = await client.query(`
          SELECT column_name, data_type, column_default
          FROM information_schema.columns
          WHERE table_name = 'keyword_metrics' AND column_name = 'location_id';
        `);

        if (verifyResult.rows.length > 0) {
          console.log('✅ Column location_id already exists:');
          console.log(verifyResult.rows[0]);
          console.log('\n✅ Migration already applied - no action needed!');
        }
      } catch (verifyError) {
        console.error('Verification error:', verifyError.message);
      }
    } else {
      console.error('Full error:', error);
      process.exit(1);
    }
  } finally {
    await client.end();
    console.log('\n🔌 Connection closed.');
  }
}

runMigration();
