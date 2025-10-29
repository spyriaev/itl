#!/bin/bash

# AI Reader - Full Stack Development Start Script
# This script starts both backend server and web client

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       AI Reader - Development Mode         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if server .env exists
if [ ! -f server/.env ]; then
    echo -e "${RED}❌ Server .env file not found!${NC}"
    echo -e "Please create ${YELLOW}server/.env${NC} file first:"
    echo ""
    echo "  cd server"
    echo "  cp env.example .env"
    echo "  # Edit .env with your Supabase credentials"
    echo ""
    exit 1
fi

# Check if web .env exists
if [ ! -f web/.env ]; then
    echo -e "${YELLOW}⚠️  Web .env file not found!${NC}"
    echo -e "Please create ${YELLOW}web/.env${NC} file:"
    echo ""
    echo "  cd web"
    echo "  cp env.example .env"
    echo "  # Edit .env with your Supabase credentials"
    echo ""
    echo -e "${YELLOW}Continuing anyway (using defaults)...${NC}"
    echo ""
fi

# Trap to kill all background processes on exit
trap 'kill $(jobs -p) 2>/dev/null' EXIT

echo -e "${GREEN}🚀 Starting Backend Server...${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
cd server
./run-dev.sh &
SERVER_PID=$!
cd ..

# Wait a bit for server to start
sleep 3

echo ""
echo -e "${GREEN}🌐 Starting Web Client...${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
cd web
./run-dev.sh &
WEB_PID=$!
cd ..

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           🎉 All Services Running!         ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║                                            ║${NC}"
echo -e "${BLUE}║  Backend:  ${GREEN}http://localhost:8080${BLUE}          ║${NC}"
echo -e "${BLUE}║  Frontend: ${GREEN}http://localhost:5173${BLUE}          ║${NC}"
echo -e "${BLUE}║                                            ║${NC}"
echo -e "${BLUE}║  Press Ctrl+C to stop all services         ║${NC}"
echo -e "${BLUE}║                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Wait for all background processes
wait
