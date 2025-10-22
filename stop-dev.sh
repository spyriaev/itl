#!/bin/bash

# AI Reader - Full Stack Development Stop Script
# This script stops all running development services

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       AI Reader - Stopping Services         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Function to kill processes by port
kill_by_port() {
    local port=$1
    local service_name=$2
    
    echo -e "${YELLOW}🔍 Checking for processes on port $port ($service_name)...${NC}"
    
    # Find PIDs using the port
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo -e "${RED}🛑 Found processes on port $port: $pids${NC}"
        echo -e "${YELLOW}   Killing $service_name processes...${NC}"
        
        # Kill processes gracefully first
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        
        # Wait a bit for graceful shutdown
        sleep 2
        
        # Force kill if still running
        local remaining_pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$remaining_pids" ]; then
            echo -e "${RED}   Force killing remaining processes...${NC}"
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✓ $service_name stopped${NC}"
    else
        echo -e "${GREEN}✓ No $service_name processes found on port $port${NC}"
    fi
}

# Function to kill processes by name pattern
kill_by_pattern() {
    local pattern=$1
    local service_name=$2
    
    echo -e "${YELLOW}🔍 Checking for $service_name processes...${NC}"
    
    # Find PIDs by process name pattern
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo -e "${RED}🛑 Found $service_name processes: $pids${NC}"
        echo -e "${YELLOW}   Killing $service_name processes...${NC}"
        
        # Kill processes gracefully first
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        
        # Wait a bit for graceful shutdown
        sleep 2
        
        # Force kill if still running
        local remaining_pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$remaining_pids" ]; then
            echo -e "${RED}   Force killing remaining processes...${NC}"
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✓ $service_name stopped${NC}"
    else
        echo -e "${GREEN}✓ No $service_name processes found${NC}"
    fi
}

# Stop backend server (port 8080)
kill_by_port 8080 "Backend Server"

# Stop frontend server (port 5173)
kill_by_port 5173 "Frontend Server"

# Additional cleanup for specific processes
echo ""
echo -e "${YELLOW}🧹 Additional cleanup...${NC}"

# Kill any remaining uvicorn processes
kill_by_pattern "uvicorn.*main:app" "Uvicorn Server"

# Kill any remaining npm/node processes related to our project
kill_by_pattern "npm.*run.*dev" "NPM Dev Server"
kill_by_pattern "vite.*dev" "Vite Dev Server"

# Kill any background jobs from the current shell
echo -e "${YELLOW}🔍 Checking for background jobs...${NC}"
if jobs -p >/dev/null 2>&1; then
    echo -e "${RED}🛑 Found background jobs, killing them...${NC}"
    kill $(jobs -p) 2>/dev/null || true
    echo -e "${GREEN}✓ Background jobs stopped${NC}"
else
    echo -e "${GREEN}✓ No background jobs found${NC}"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           ✅ All Services Stopped!        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Final verification
echo -e "${YELLOW}🔍 Final verification...${NC}"
backend_running=$(lsof -ti:8080 2>/dev/null || true)
frontend_running=$(lsof -ti:5173 2>/dev/null || true)

if [ -n "$backend_running" ] || [ -n "$frontend_running" ]; then
    echo -e "${RED}⚠️  Warning: Some services may still be running${NC}"
    if [ -n "$backend_running" ]; then
        echo -e "${RED}   Backend (port 8080): $backend_running${NC}"
    fi
    if [ -n "$frontend_running" ]; then
        echo -e "${RED}   Frontend (port 5173): $frontend_running${NC}"
    fi
    echo ""
    echo -e "${YELLOW}You may need to manually kill these processes:${NC}"
    echo -e "${YELLOW}  kill -9 $backend_running $frontend_running${NC}"
else
    echo -e "${GREEN}✅ All services successfully stopped!${NC}"
fi

echo ""
echo -e "${BLUE}💡 To start services again, run: ./start-dev.sh${NC}"
