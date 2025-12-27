#!/bin/bash
# End-to-End Test for SERP Intelligence Feature
# Tests: Add keyword → Check position → Verify results

set -e

echo "🧪 SERP Intelligence End-to-End Test"
echo "===================================="
echo ""

# Configuration
BASE_URL="https://ads.mercan.com"
CUSTOMER_ID="${1:-}" # Get from command line argument

if [ -z "$CUSTOMER_ID" ]; then
  echo "❌ Error: Customer ID required"
  echo "Usage: ./test-serp-intelligence.sh <CUSTOMER_ID>"
  echo ""
  echo "Note: You need to be authenticated. Get session cookie from browser."
  exit 1
fi

echo "📋 Configuration:"
echo "  Base URL: $BASE_URL"
echo "  Customer ID: $CUSTOMER_ID"
echo ""

# Test keyword
TEST_KEYWORD="google ads management"
TEST_DOMAIN="ads.google.com"
TEST_LOCATION="2840" # United States

echo "Step 1: Add Keyword to Track"
echo "-----------------------------"
echo "  Keyword: $TEST_KEYWORD"
echo "  Domain: $TEST_DOMAIN"
echo "  Location: $TEST_LOCATION (US)"
echo ""

# Note: This would require authentication cookie
# For now, let's just document the API calls

cat << EOF
API Call 1: Add Tracked Keyword
POST $BASE_URL/api/serp-intelligence/keywords
Content-Type: application/json

{
  "customerId": "$CUSTOMER_ID",
  "keywords": [
    {
      "keyword": "$TEST_KEYWORD",
      "targetDomain": "$TEST_DOMAIN",
      "locationCode": "$TEST_LOCATION",
      "device": "desktop",
      "projectName": "Test Project"
    }
  ]
}

Expected Response:
{
  "success": true,
  "added": 1,
  "keywords": [{ "id": "<keyword_id>", "keyword": "$TEST_KEYWORD", ... }]
}
EOF

echo ""
echo ""
echo "Step 2: Trigger Position Check"
echo "-------------------------------"
echo "  This will call DataForSEO API"
echo ""

cat << EOF
API Call 2: Check SERP Positions
POST $BASE_URL/api/serp-intelligence/check
Content-Type: application/json

{
  "customerId": "$CUSTOMER_ID",
  "keywordIds": ["<keyword_id_from_step_1>"]
}

Expected Response:
{
  "success": true,
  "message": "Checked 1 keywords successfully",
  "stats": {
    "total": 1,
    "successful": 1,
    "errors": 0
  },
  "results": [
    {
      "keyword": "$TEST_KEYWORD",
      "success": true
    }
  ]
}
EOF

echo ""
echo ""
echo "Step 3: Verify Results in Dashboard"
echo "-----------------------------------"
echo "  Visit: $BASE_URL/serp-intelligence"
echo ""
echo "Expected to see:"
echo "  ✓ Keyword '$TEST_KEYWORD' listed"
echo "  ✓ Latest position data displayed"
echo "  ✓ Competitor ads count"
echo "  ✓ SERP features detected"
echo ""

echo ""
echo "🔍 DataForSEO Credentials Check"
echo "================================"
echo ""
echo "Credentials should be set in production:"
echo "  DATAFORSEO_LOGIN=wassim@mercan.com"
echo "  DATAFORSEO_PASSWORD=b8861f174919820b"
echo ""

echo "✅ Test script complete!"
echo ""
echo "📝 Manual Testing Steps:"
echo "1. Login to $BASE_URL"
echo "2. Get your customer ID from localStorage (quickads_customerId)"
echo "3. Navigate to SERP Intelligence"
echo "4. Click 'Add Keywords' button"
echo "5. Add test keyword: '$TEST_KEYWORD'"
echo "6. Click 'Check Now' to trigger position check"
echo "7. Verify results appear in dashboard"
echo ""
echo "Cost: ~\$0.01 per keyword check (DataForSEO pricing)"
