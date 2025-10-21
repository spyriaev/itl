#!/bin/bash

# AI Reader Server - Development Run Script
# This script loads environment variables from .env file and starts the Python FastAPI server

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting AI Reader Server (Python FastAPI)...${NC}"

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
REQUIRED_VERSION="3.11"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}❌ Error: Python 3.11+ required, found Python $PYTHON_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python $PYTHON_VERSION detected${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo ""
    echo "Please create a .env file with the following variables:"
    echo ""
    echo "PORT=8080"
    echo "DATABASE_URL=postgresql://postgres:your_password@db.sjrfppeisxmglrozufoy.supabase.co:6543/postgres"
    echo "SUPABASE_JWT_SECRET=your_jwt_secret_here"
    echo ""
    echo -e "${YELLOW}Get credentials from: https://supabase.com/dashboard/project/sjrfppeisxmglrozufoy${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found .env file${NC}"

# Load environment variables from .env file
echo -e "${GREEN}📦 Loading environment variables...${NC}"
export $(grep -v '^#' .env | xargs)

# Validate required variables
REQUIRED_VARS=("DATABASE_URL" "SUPABASE_JWT_SECRET")
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
echo ""

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${GREEN}📦 Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
echo -e "${GREEN}🔧 Activating virtual environment...${NC}"
source venv/bin/activate

# Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
if ! pip install -r requirements.txt; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    echo ""
    echo -e "${YELLOW}If you see psycopg2 errors, try:${NC}"
    echo "  brew install postgresql"
    echo "  pip install psycopg2-binary"
    echo ""
    echo -e "${YELLOW}Or use the alternative:${NC}"
    echo "  pip install psycopg[binary]"
    exit 1
fi

# Start the server
echo -e "${GREEN}🏗️  Starting FastAPI server...${NC}"
echo ""

uvicorn main:app --reload --port ${PORT:-8080}


