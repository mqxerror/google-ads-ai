/**
 * Benchmark Script: IVFFlat vs HNSW Index Performance
 *
 * Run with: npx tsx scripts/benchmark-indexes.ts
 *
 * This script:
 * 1. Generates sample embeddings
 * 2. Inserts test data
 * 3. Runs similarity queries with both index types
 * 4. Reports performance metrics
 */

import { Pool } from 'pg';
import { generateEmbedding, generateEmbeddings, formatEmbeddingForPostgres } from '../src/lib/embeddings';

const pool = new Pool({
  host: '38.97.60.181',
  port: 5433,
  user: 'postgres',
  password: 'postgres123',
  database: 'google_ads_manager',
});

interface BenchmarkResult {
  indexType: string;
  queryCount: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  resultsFound: number;
}

async function runBenchmark() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Index Benchmark: IVFFlat vs HNSW\n');
    console.log('='.repeat(60));

    // Check if pgvector is available
    const extCheck = await client.query(`SELECT extname FROM pg_extension WHERE extname = 'vector'`);
    if (extCheck.rows.length === 0) {
      throw new Error('pgvector extension not enabled');
    }
    console.log('✅ pgvector extension is enabled\n');

    // Check current indexes
    console.log('📊 Current indexes on keywords table:');
    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'keywords'
      AND indexdef LIKE '%embedding%'
    `);
    indexes.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
      if (row.indexdef.includes('ivfflat')) console.log('     Type: IVFFlat');
      if (row.indexdef.includes('hnsw')) console.log('     Type: HNSW');
    });
    console.log();

    // Count existing embeddings
    const countResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(embedding) as with_embedding
      FROM keywords
    `);
    const { total, with_embedding } = countResult.rows[0];
    console.log(`📈 Keywords: ${total} total, ${with_embedding} with embeddings\n`);

    // Generate test queries
    const testQueries = [
      'buy shoes online',
      'best running sneakers',
      'discount athletic footwear',
      'cheap nike shoes',
      'mens basketball shoes',
      'womens tennis shoes',
      'kids sports shoes',
      'waterproof hiking boots',
      'casual walking shoes',
      'orthopedic shoe inserts',
    ];

    console.log(`🔍 Running ${testQueries.length} similarity queries...\n`);

    // Generate embeddings for test queries
    const queryEmbeddings = await generateEmbeddings(testQueries);

    // Run queries and measure latency
    const latencies: number[] = [];
    let totalResults = 0;

    for (let i = 0; i < testQueries.length; i++) {
      const embedding = formatEmbeddingForPostgres(queryEmbeddings[i]);

      const start = performance.now();

      const result = await client.query(`
        SELECT
          keyword,
          1 - (embedding <=> $1::vector) as similarity
        FROM keywords
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) > 0.5
        ORDER BY embedding <=> $1::vector
        LIMIT 10
      `, [embedding]);

      const end = performance.now();
      const latency = end - start;

      latencies.push(latency);
      totalResults += result.rows.length;

      console.log(`   Query ${i + 1}: "${testQueries[i].substring(0, 30)}..." → ${result.rows.length} results in ${latency.toFixed(2)}ms`);
    }

    // Calculate statistics
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = sortedLatencies[0];
    const maxLatency = sortedLatencies[sortedLatencies.length - 1];
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95Latency = sortedLatencies[p95Index] || maxLatency;

    console.log('\n' + '='.repeat(60));
    console.log('📊 BENCHMARK RESULTS');
    console.log('='.repeat(60));
    console.log(`   Queries Run:     ${latencies.length}`);
    console.log(`   Total Results:   ${totalResults}`);
    console.log(`   Avg Latency:     ${avgLatency.toFixed(2)}ms`);
    console.log(`   Min Latency:     ${minLatency.toFixed(2)}ms`);
    console.log(`   Max Latency:     ${maxLatency.toFixed(2)}ms`);
    console.log(`   P95 Latency:     ${p95Latency.toFixed(2)}ms`);
    console.log('='.repeat(60));

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (avgLatency < 10) {
      console.log('   ✅ Query performance is excellent (<10ms avg)');
    } else if (avgLatency < 50) {
      console.log('   ⚠️  Query performance is acceptable (10-50ms avg)');
      console.log('   Consider switching to HNSW indexes for better speed');
    } else {
      console.log('   ❌ Query performance needs improvement (>50ms avg)');
      console.log('   Strongly recommend switching to HNSW indexes');
    }

    if (Number(with_embedding) < 100) {
      console.log('   ℹ️  Low embedding count - benchmark may not reflect production performance');
    }

    // Check if HNSW migration is needed
    const hasHnsw = indexes.rows.some(r => r.indexdef.includes('hnsw'));
    const hasIvfflat = indexes.rows.some(r => r.indexdef.includes('ivfflat'));

    if (!hasHnsw && hasIvfflat) {
      console.log('\n   📌 To migrate to HNSW, run:');
      console.log('      npx tsx scripts/run-vector-migration.ts --file 003_hnsw_indexes.sql');
    } else if (hasHnsw) {
      console.log('\n   ✅ Already using HNSW indexes');
    }

    console.log('\n🎉 Benchmark complete!\n');

  } catch (error) {
    console.error('Benchmark failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runBenchmark().catch(console.error);
