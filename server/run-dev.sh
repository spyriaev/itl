#!/bin/bash

# AI Reader Server - Development Run Script
# This script loads environment variables from .env file and starts the server

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting AI Reader Server...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo ""
    echo "Please create a .env file with the following variables:"
    echo ""
    echo "PORT=8080"
    echo "DATABASE_URL=jdbc:postgresql://db.sjrfppeisxmglrozufoy.supabase.co:5432/postgres"
    echo "DATABASE_USER=postgres"
    echo "DATABASE_PASSWORD=foxtot-gUmmaw-zujqu2"
    echo "SUPABASE_URL=https://sjrfppeisxmglrozufoy.supabase.co"
    echo "SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmZwcGVpc3htZ2xyb3p1Zm95Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA1MDMyNCwiZXhwIjoyMDc1NjI2MzI0fQ.LnYE1PEP2dRHFkavRRZ1JgXdK9_mdz0ugfaEl8CEwcA"
    echo ""
    echo -e "${YELLOW}Get credentials from: https://supabase.com/dashboard/project/sjrfppeisxmglrozufoy${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found .env file${NC}"

# Load environment variables from .env file
echo -e "${GREEN}📦 Loading environment variables...${NC}"
export $(grep -v '^#' .env | xargs)

# Validate required variables
REQUIRED_VARS=("DATABASE_URL" "DATABASE_USER" "DATABASE_PASSWORD")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

echo -e "${GREEN}✓ All required variables loaded${NC}"
echo ""
echo -e "${GREEN}🔧 Configuration:${NC}"
echo "  Port: ${PORT:-8080}"
echo "  Database: ${DATABASE_URL}"
echo "  Supabase: ${SUPABASE_URL:-https://sjrfppeisxmglrozufoy.supabase.co}"
echo ""

# Start the server
echo -e "${GREEN}🏗️  Building and starting server...${NC}"
echo ""

./gradlew run


