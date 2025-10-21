#!/bin/bash

# AI Reader Server - Dependency Installation Script
# This script handles PostgreSQL dependency issues on macOS

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Installing AI Reader Server dependencies...${NC}"

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}📱 Detected macOS - checking PostgreSQL dependencies...${NC}"
    
    # Check if PostgreSQL is installed
    if ! command -v pg_config &> /dev/null; then
        echo -e "${YELLOW}⚠️  PostgreSQL development headers not found${NC}"
        echo -e "${GREEN}Installing PostgreSQL via Homebrew...${NC}"
        
        if command -v brew &> /dev/null; then
            brew install postgresql
        else
            echo -e "${RED}❌ Homebrew not found. Please install PostgreSQL manually:${NC}"
            echo "  https://www.postgresql.org/download/macosx/"
            exit 1
        fi
    fi
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${GREEN}📦 Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
echo -e "${GREEN}🔧 Activating virtual environment...${NC}"
source venv/bin/activate

# Try installing dependencies
echo -e "${GREEN}📦 Installing Python dependencies...${NC}"

# First try with updated requirements.txt
if pip install -r requirements.txt; then
    echo -e "${GREEN}✅ Dependencies installed successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Installation failed, trying alternative approach...${NC}"
    
    # Try installing psycopg2-binary separately (more compatible)
    echo -e "${GREEN}Trying psycopg2-binary installation...${NC}"
    if pip install psycopg2-binary; then
        echo -e "${GREEN}Installing remaining dependencies...${NC}"
        pip install fastapi uvicorn[standard] python-jose[cryptography] sqlalchemy pydantic pydantic-settings python-dotenv
        echo -e "${GREEN}✅ Dependencies installed successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to install PostgreSQL adapter${NC}"
        echo ""
        echo -e "${YELLOW}Manual installation options:${NC}"
        echo "1. Install PostgreSQL development headers:"
        echo "   brew install postgresql"
        echo ""
        echo "2. Or use conda:"
        echo "   conda install psycopg2"
        echo ""
        echo "3. Or use Docker for development"
        exit 1
    fi
fi

echo -e "${GREEN}🎉 Setup complete! Run './run-dev.sh' to start the server${NC}"
