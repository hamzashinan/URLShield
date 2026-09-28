#!/bin/bash
# URLShield Installation Verification Script

set -e

echo "=================================="
echo "URLshield Installation Verification"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_python() {
    echo -n "Checking Python 3.11+... "
    if command -v python3.11 &> /dev/null; then
        echo -e "${GREEN}✓${NC} Found: $(python3.11 --version)"
    else
        echo -e "${RED}✗${NC} Python 3.11+ not found"
        return 1
    fi
}

check_docker() {
    echo -n "Checking Docker... "
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✓${NC} Found: $(docker --version)"
    else
        echo -e "${YELLOW}⚠${NC} Docker not found (optional)"
    fi
}

check_playwright() {
    echo -n "Checking Playwright... "
    if python3.11 -c "import playwright" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Playwright installed"
    else
        echo -e "${RED}✗${NC} Playwright not installed"
        return 1
    fi
}

check_dependencies() {
    echo -n "Checking Python dependencies... "
    local missing=0
    
    for pkg in fastapi uvicorn playwright pydantic; do
        if ! python3.11 -c "import $pkg" 2>/dev/null; then
            echo -e "${RED}✗${NC} Missing: $pkg"
            missing=1
        fi
    done
    
    if [ $missing -eq 0 ]; then
        echo -e "${GREEN}✓${NC} All core dependencies installed"
    else
        return 1
    fi
}

check_env_file() {
    echo -n "Checking .env file... "
    if [ -f ".env" ]; then
        if grep -q "URLSHIELD_API_KEY" .env; then
            echo -e "${GREEN}✓${NC} .env file configured"
        else
            echo -e "${YELLOW}⚠${NC} .env file missing URLSHIELD_API_KEY"
        fi
    else
        echo -e "${YELLOW}⚠${NC} .env file not found (copy from .env.example)"
    fi
}

check_data_dir() {
    echo -n "Checking data directory... "
    if [ -d "data" ]; then
        echo -e "${GREEN}✓${NC} data/ directory exists"
    else
        echo -e "${YELLOW}⚠${NC} data/ directory will be created on first run"
    fi
}

check_playwright_browsers() {
    echo -n "Checking Playwright browsers... "
    if python3.11 -c "from playwright.sync_api import sync_playwright; p = sync_playwright().start(); p.chromium.launch(); p.stop()" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Chromium browser installed"
    else
        echo -e "${RED}✗${NC} Chromium browser not installed"
        echo "   Run: playwright install chromium"
        return 1
    fi
}

# Run checks
echo "1. System Requirements"
echo "----------------------"
check_python
check_docker
echo ""

echo "2. Python Environment"
echo "---------------------"
check_dependencies
check_playwright
check_playwright_browsers
echo ""

echo "3. Configuration"
echo "----------------"
check_env_file
check_data_dir
echo ""

# Summary
echo "=================================="
echo "Verification Summary"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. If any checks failed, install missing dependencies"
echo "2. Copy .env.example to .env and set URLSHIELD_API_KEY"
echo "3. Run: python -m URLshield.main all"
echo "4. Test: curl http://localhost:8080/health"
echo ""
echo "For detailed instructions, see README.md or QUICKSTART.md"
echo ""
