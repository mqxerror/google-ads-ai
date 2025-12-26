/**
 * Test Vector Store Setup
 *
 * Run with: npx tsx scripts/test-vector-store.ts
 */

import pg from 'pg';
import OpenAI from 'openai';

const { Client } = pg;

async function testVectorStore() {
  const databaseUrl = process.env.DATABASE_URL;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!databaseUrl) {
    console.error('❌ Missing DATABASE_URL');
    process.exit(1);
  }

  if (!openaiKey) {
    console.error('❌ Missing OPENAI_API_KEY');
    process.exit(1);
  }

  console.log('🧪 Testing Vector Store Setup\n');

  const client = new Client({ connectionString: databaseUrl });
  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    await client.connect();
    console.log('✅ Database connected');

    // Test 1: Insert test keywords with embeddings
    console.log('\n📝 Test 1: Inserting test keywords with embeddings...');

    const testKeywords = [
      'buy running shoes online',
      'best athletic footwear',
      'cheap sports sneakers',
      'free shipping trainers',
      'marathon training shoes',
    ];

    // Generate embeddings
    console.log('   Generating embeddings via OpenAI...');
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: testKeywords.map(k => k.toLowerCase()),
    });

    console.log(`   ✅ Generated ${embeddingResponse.data.length} embeddings (dim: ${embeddingResponse.data[0].embedding.length})`);

    // Insert keywords
    for (let i = 0; i < testKeywords.length; i++) {
      const embedding = embeddingResponse.data[i].embedding;
      const embeddingStr = `[${embedding.join(',')}]`;

      await client.query(
        `INSERT INTO keywords (keyword, embedding, campaign_id, source, is_negative)
         VALUES ($1, $2::vector, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [testKeywords[i], embeddingStr, 'test-campaign-001', 'manual', false]
      );
    }
    console.log(`   ✅ Inserted ${testKeywords.length} test keywords`);

    // Test 2: Add a negative keyword
    console.log('\n📝 Test 2: Inserting negative keyword...');

    const negativeKeyword = 'free cheap discount';
    const negativeEmbeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: [negativeKeyword.toLowerCase()],
    });
    const negativeEmbedding = negativeEmbeddingResponse.data[0].embedding;
    const negativeEmbeddingStr = `[${negativeEmbedding.join(',')}]`;

    await client.query(
      `INSERT INTO keywords (keyword, embedding, campaign_id, source, is_negative)
       VALUES ($1, $2::vector, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [negativeKeyword, negativeEmbeddingStr, 'test-campaign-001', 'manual', true]
    );
    console.log('   ✅ Inserted negative keyword');

    // Test 3: Vector similarity search
    console.log('\n📝 Test 3: Testing vector similarity search...');

    const searchQuery = 'athletic running trainers';
    const searchEmbeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: [searchQuery.toLowerCase()],
    });
    const searchEmbedding = searchEmbeddingResponse.data[0].embedding;
    const searchEmbeddingStr = `[${searchEmbedding.join(',')}]`;

    const similarResult = await client.query(
      `SELECT * FROM search_similar_keywords($1::vector, 0.5, 10, NULL, false)`,
      [searchEmbeddingStr]
    );

    console.log(`   Query: "${searchQuery}"`);
    console.log(`   Found ${similarResult.rows.length} similar keywords:`);
    for (const row of similarResult.rows) {
      console.log(`     - "${row.keyword}" (similarity: ${(row.similarity * 100).toFixed(1)}%)`);
    }

    // Test 4: Insert search terms
    console.log('\n📝 Test 4: Inserting test search terms...');

    const testSearchTerms = [
      { term: 'best running shoes for marathon', cost: 25.50, clicks: 15 },
      { term: 'cheap trainers free shipping', cost: 45.00, clicks: 8 },
      { term: 'athletic footwear sale', cost: 12.00, clicks: 20 },
    ];

    const searchTermEmbeddings = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: testSearchTerms.map(st => st.term.toLowerCase()),
    });

    for (let i = 0; i < testSearchTerms.length; i++) {
      const embedding = searchTermEmbeddings.data[i].embedding;
      const embeddingStr = `[${embedding.join(',')}]`;

      await client.query(
        `INSERT INTO search_terms (search_term, embedding, campaign_id, cost, clicks, is_negative_candidate)
         VALUES ($1, $2::vector, $3, $4, $5, false)
         ON CONFLICT DO NOTHING`,
        [testSearchTerms[i].term, embeddingStr, 'test-campaign-001', testSearchTerms[i].cost, testSearchTerms[i].clicks]
      );
    }
    console.log(`   ✅ Inserted ${testSearchTerms.length} test search terms`);

    // Test 5: Find negative candidates
    console.log('\n📝 Test 5: Finding negative keyword candidates...');

    const negativeCandidates = await client.query(
      `SELECT * FROM find_negative_candidates('test-campaign-001', 10, 0.5, 10)`
    );

    console.log(`   Found ${negativeCandidates.rows.length} potential negative candidates:`);
    for (const row of negativeCandidates.rows) {
      console.log(`     - "${row.search_term}" (cost: $${row.cost}, similarity to negatives: ${(row.similarity * 100).toFixed(1)}%)`);
    }

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await client.query(`DELETE FROM search_terms WHERE campaign_id = 'test-campaign-001'`);
    await client.query(`DELETE FROM keywords WHERE campaign_id = 'test-campaign-001'`);
    console.log('   ✅ Test data removed');

    console.log('\n✅ All tests passed! Vector store is working correctly.\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connection closed');
  }
}

testVectorStore();
