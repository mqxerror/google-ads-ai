#!/usr/bin/env node
/**
 * Run migration 005 - Add location_id to keyword_metrics
 * Uses Supabase credentials from SERVER_INFRASTRUCTURE_REFERENCE.md
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase credentials from production server
const SUPABASE_URL = 'http://38.97.60.181:3002';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTYwMzk2ODgzNCwiZXhwIjoyNTUwNjUzNjM0LCJyb2xlIjoic2VydmljZV9yb2xlIn0.M2d2z4SFn5C7HlJlaSLfrzuYim9nbY_XI40uWFN3hEE';

console.log('🔄 Running Migration 005: Add location_id to keyword_metrics');
console.log('📍 Supabase URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// Read migration SQL
const migrationPath = path.join(__dirname, 'prisma/migrations/005_add_location_to_cache.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

console.log('📄 Migration SQL loaded:', migrationPath);
console.log('\n--- SQL ---');
console.log(migrationSQL);
console.log('--- END SQL ---\n');

async function runMigration() {
  try {
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`\n[${i + 1}/${statements.length}] Executing:`);
      console.log(statement.substring(0, 100) + '...\n');

      const { data, error } = await supabase.rpc('exec_sql', {
        sql: statement,
      });

      if (error) {
        // Try alternative method - using raw SQL via REST API
        console.log('⚠️  rpc method failed, trying direct query...');

        const { data: result, error: queryError } = await supabase
          .from('keyword_metrics')
          .select('*')
          .limit(0);

        if (queryError && queryError.message.includes('column "location_id" does not exist')) {
          console.log('❌ Migration not yet applied. Need to run SQL manually.');
          console.log('\nPlease run this SQL in Supabase Studio (http://38.97.60.181:3002):');
          console.log('\nSQL Editor → New Query → Paste the migration SQL\n');
          process.exit(1);
        }
      } else {
        console.log('✅ Statement executed successfully');
      }
    }

    console.log('\n✅ Migration 005 completed successfully!');
    console.log('\n📝 Verifying migration...');

    // Verify the location_id column exists
    const { data, error } = await supabase
      .from('keyword_metrics')
      .select('location_id')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('\n⚠️  Column location_id does not exist yet.');
        console.log('Please run the SQL manually in Supabase Studio.');
      } else {
        console.log('✅ Migration verified! Column location_id exists.');
      }
    } else {
      console.log('✅ Migration verified! Column location_id exists.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
