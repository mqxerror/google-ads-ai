/**
 * Vector Search Quality Monitoring
 *
 * Run with: npx tsx scripts/vector-quality-check.ts
 *
 * Purpose:
 * - Run ANALYZE on vector indexes
 * - Execute recall tests with gold queries
 * - Check embedding stats and model consistency
 * - Log quality metrics for monitoring
 */

import pg from 'pg';
import OpenAI from 'openai';

const { Client } = pg;

// Gold standard test queries with expected nearest neighbors
// Update these as you add real data to the database
const GOLD_QUERIES: {
  query: string;
  expectedMatches: string[];  // Keywords that should appear in top 5
  minRecall: number;  // Minimum % of expected matches that should appear
}[] = [
  {
    query: 'running shoes for marathon',
    expectedMatches: ['marathon training shoes', 'running shoes', 'athletic footwear'],
    minRecall: 0.5,  // At least 50% should match
  },
  {
    query: 'free download coupon',
    expectedMatches: ['free', 'discount', 'cheap', 'coupon'],
    minRecall: 0.5,
  },
  {
    query: 'buy golden visa portugal',
    expectedMatches: ['portugal golden visa', 'golden visa', 'portugal citizenship'],
    minRecall: 0.5,
  },
];

interface QualityReport {
  timestamp: string;
  indexStats: {
    keywordsIndexed: number;
    searchTermsIndexed: number;
    avgListSize: number | null;
  };
  embeddingStats: {
    totalKeywords: number;
    withEmbeddings: number;
    currentModel: number;
    needsReembedding: number;
  }[];
  recallTests: {
    query: string;
    found: string[];
    expected: string[];
    recall: number;
    passed: boolean;
  }[];
  overallHealth: 'healthy' | 'warning' | 'critical';
}

async function runQualityCheck(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!databaseUrl) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Vector Search Quality Check');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const client = new Client({ connectionString: databaseUrl });
  const report: QualityReport = {
    timestamp: new Date().toISOString(),
    indexStats: { keywordsIndexed: 0, searchTermsIndexed: 0, avgListSize: null },
    embeddingStats: [],
    recallTests: [],
    overallHealth: 'healthy',
  };

  try {
    await client.connect();

    // 1. Run ANALYZE on tables
    console.log('1. Running ANALYZE on vector tables...');
    await client.query('ANALYZE keywords');
    await client.query('ANALYZE search_terms');
    console.log('   ANALYZE complete\n');

    // 2. Check index stats
    console.log('2. Checking index statistics...');
    const indexStats = await client.query(`
      SELECT
        indexrelname as index_name,
        pg_size_pretty(pg_relation_size(indexrelid)) as size,
        idx_scan as scans
      FROM pg_stat_user_indexes
      WHERE indexrelname LIKE '%embedding%'
    `);

    for (const row of indexStats.rows) {
      console.log(`   ${row.index_name}: ${row.size}, ${row.scans} scans`);
    }

    // Get count of indexed rows
    const keywordCount = await client.query(
      'SELECT COUNT(*) FROM keywords WHERE embedding IS NOT NULL'
    );
    const searchTermCount = await client.query(
      'SELECT COUNT(*) FROM search_terms WHERE embedding IS NOT NULL'
    );

    report.indexStats.keywordsIndexed = parseInt(keywordCount.rows[0].count);
    report.indexStats.searchTermsIndexed = parseInt(searchTermCount.rows[0].count);

    console.log(`\n   Keywords with embeddings: ${report.indexStats.keywordsIndexed}`);
    console.log(`   Search terms with embeddings: ${report.indexStats.searchTermsIndexed}\n`);

    // 3. Check embedding model consistency
    console.log('3. Checking embedding model consistency...');
    try {
      const embeddingStats = await client.query('SELECT * FROM get_embedding_stats()');
      report.embeddingStats = embeddingStats.rows;

      for (const row of embeddingStats.rows) {
        console.log(`   ${row.table_name}:`);
        console.log(`     Total: ${row.total_rows}, With embeddings: ${row.with_embeddings}`);
        console.log(`     Current model: ${row.current_model_count}, Needs reembedding: ${row.needs_reembedding}`);

        if (parseInt(row.needs_reembedding) > 0) {
          report.overallHealth = 'warning';
        }
      }
    } catch {
      console.log('   (get_embedding_stats function not found - run migration 002)');
    }
    console.log('');

    // 4. Run recall tests (only if we have OpenAI key and data)
    if (openaiKey && report.indexStats.keywordsIndexed > 0) {
      console.log('4. Running recall tests with gold queries...\n');
      const openai = new OpenAI({ apiKey: openaiKey });

      for (const test of GOLD_QUERIES) {
        console.log(`   Query: "${test.query}"`);

        // Generate embedding for query
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: test.query.toLowerCase(),
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        // Search for similar keywords
        const results = await client.query(
          `SELECT keyword, 1 - (embedding <=> $1::vector) as similarity
           FROM keywords
           WHERE embedding IS NOT NULL
           ORDER BY embedding <=> $1::vector
           LIMIT 5`,
          [embeddingStr]
        );

        const foundKeywords = results.rows.map((r) => r.keyword.toLowerCase());
        const matchedExpected = test.expectedMatches.filter((exp) =>
          foundKeywords.some((found) => found.includes(exp.toLowerCase()) || exp.toLowerCase().includes(found))
        );

        const recall = test.expectedMatches.length > 0
          ? matchedExpected.length / test.expectedMatches.length
          : 1;
        const passed = recall >= test.minRecall;

        report.recallTests.push({
          query: test.query,
          found: foundKeywords,
          expected: test.expectedMatches,
          recall,
          passed,
        });

        console.log(`   Found: ${foundKeywords.join(', ') || '(none)'}`);
        console.log(`   Expected: ${test.expectedMatches.join(', ')}`);
        console.log(`   Recall: ${(recall * 100).toFixed(0)}% ${passed ? '✓' : '✗'}\n`);

        if (!passed) {
          report.overallHealth = 'warning';
        }
      }
    } else {
      console.log('4. Skipping recall tests (no OpenAI key or no data)\n');
    }

    // 5. Summary
    console.log('='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));

    const healthEmoji = {
      healthy: '✅',
      warning: '⚠️',
      critical: '❌',
    };

    console.log(`Overall Health: ${healthEmoji[report.overallHealth]} ${report.overallHealth.toUpperCase()}`);
    console.log(`Keywords indexed: ${report.indexStats.keywordsIndexed}`);
    console.log(`Search terms indexed: ${report.indexStats.searchTermsIndexed}`);

    if (report.recallTests.length > 0) {
      const passedTests = report.recallTests.filter((t) => t.passed).length;
      console.log(`Recall tests: ${passedTests}/${report.recallTests.length} passed`);
    }

    console.log('\n' + '='.repeat(60));

    // Return exit code based on health
    if (report.overallHealth === 'critical') {
      process.exit(2);
    } else if (report.overallHealth === 'warning') {
      process.exit(1);
    }

  } catch (error) {
    console.error('Quality check failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runQualityCheck();
