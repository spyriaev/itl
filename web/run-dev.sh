#!/bin/bash

# AI Reader Web Client - Development Run Script
# This script checks for .env file and starts the development server

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting AI Reader Web Client...${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo ""
    echo "Please create a .env file with the following variables:"
    echo ""
    echo "VITE_SUPABASE_URL=https://sjrfppeisxmglrozufoy.supabase.co"
    echo "VITE_SUPABASE_ANON_KEY=your_anon_key_here"
    echo "VITE_API_URL=http://localhost:8080"
    echo ""
    echo -e "${YELLOW}Get credentials from: https://supabase.com/dashboard/project/sjrfppeisxmglrozufoy${NC}"
    echo -e "${YELLOW}Settings → API → Copy 'anon public' key${NC}"
    echo ""
    echo -e "${YELLOW}Continuing with default values...${NC}"
    echo ""
fi

echo -e "${GREEN}✓ Starting development server${NC}"
echo ""
echo -e "${GREEN}🌐 Web app will be available at: http://localhost:5173${NC}"
echo ""

# Start the dev server
npm run dev
