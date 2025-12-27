#!/bin/bash

echo "=========================================="
echo "Keyword Infrastructure Test Suite"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Apply Database Migration${NC}"
echo "Running migration: 004_keyword_metrics.sql..."
echo ""

# Check if psql is available
if command -v psql &> /dev/null; then
    echo "Using psql to run migration..."
    psql "$DATABASE_URL" -f prisma/migrations/004_keyword_metrics.sql
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migration successful${NC}"
    else
        echo -e "${RED}✗ Migration failed${NC}"
        echo "Alternative: Run migration manually in Supabase SQL Editor"
        echo "File: prisma/migrations/004_keyword_metrics.sql"
    fi
else
    echo -e "${YELLOW}⚠ psql not found${NC}"
    echo "Please run the migration manually:"
    echo "1. Open Supabase Dashboard → SQL Editor"
    echo "2. Paste content from: prisma/migrations/004_keyword_metrics.sql"
    echo "3. Execute"
    echo ""
    read -p "Press Enter after running migration manually..."
fi

echo ""
echo -e "${YELLOW}Step 2: Run API Tests${NC}"
echo "Testing: Database Schema, Circuit Breakers, Caching Layer"
echo ""

# Make sure dev server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo -e "${RED}✗ Dev server not running${NC}"
    echo "Start it with: npm run dev"
    exit 1
fi

echo "Calling test endpoint..."
response=$(curl -s http://localhost:3000/api/test-keyword-infra)

# Pretty print JSON
echo "$response" | jq '.'

# Check if all tests passed
passed=$(echo "$response" | jq '.summary.passed')
failed=$(echo "$response" | jq '.summary.failed')

echo ""
echo "=========================================="
if [ "$failed" -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed ($passed/$passed)${NC}"
else
    echo -e "${RED}✗ Some tests failed ($failed failed, $passed passed)${NC}"
fi
echo "=========================================="

# Show failed tests
if [ "$failed" -gt 0 ]; then
    echo ""
    echo "Failed tests:"
    echo "$response" | jq '.results[] | select(.status == "fail") | {test: .test, message: .message}'
fi
