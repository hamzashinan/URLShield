#!/bin/bash
# URLShield Production Deployment Script

set -e

echo "=================================="
echo "URLShield Production Deployment"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Error: Do not run as root${NC}"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Check if credentials file exists
if [ ! -f ".urlshield_production.env" ]; then
    echo -e "${YELLOW}Warning: .urlshield_production.env not found${NC}"
    echo "Generating new API key..."
    
    API_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    
    cat > .urlshield_production.env << EOF
# URLShield Production Credentials
# KEEP THIS FILE SECURE - DO NOT COMMIT TO GIT

URLSHIELD_API_KEY=${API_KEY}
URLSHIELD_ALLOW_ORIGIN=*
URLSHIELD_LOG_LEVEL=INFO

# Generated: $(date +%Y-%m-%d)
# Rotate every 90 days
EOF
    
    chmod 600 .urlshield_production.env
    echo -e "${GREEN}✓ Generated new API key${NC}"
    echo -e "${BLUE}API Key: ${API_KEY}${NC}"
    echo ""
fi

# Load credentials
source .urlshield_production.env

# Configuration
CONTAINER_NAME="urlshield-production"
IMAGE_NAME="urlshield:latest"
DATA_DIR="$(pwd)/data"
PORT="8080"
MEMORY_LIMIT="2g"
CPU_LIMIT="2"

echo "Configuration:"
echo "  Container: ${CONTAINER_NAME}"
echo "  Image: ${IMAGE_NAME}"
echo "  Port: ${PORT}"
echo "  Data: ${DATA_DIR}"
echo "  Memory: ${MEMORY_LIMIT}"
echo "  CPU: ${CPU_LIMIT}"
echo ""

# Stop existing container
if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
    echo -e "${YELLOW}Stopping existing container...${NC}"
    docker stop ${CONTAINER_NAME}
    docker rm ${CONTAINER_NAME}
    echo -e "${GREEN}✓ Stopped${NC}"
fi

# Build image
echo -e "${BLUE}Building Docker image...${NC}"
docker build -t ${IMAGE_NAME} .
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Create data directory
mkdir -p ${DATA_DIR}

# Start container
echo -e "${BLUE}Starting production container...${NC}"
docker run -d \
    --name ${CONTAINER_NAME} \
    --restart unless-stopped \
    -p ${PORT}:8080 \
    -v "${DATA_DIR}:/app/data" \
    -e URLSHIELD_API_KEY="${URLSHIELD_API_KEY}" \
    -e URLSHIELD_ALLOW_ORIGIN="${URLSHIELD_ALLOW_ORIGIN}" \
    -e URLSHIELD_LOG_LEVEL="${URLSHIELD_LOG_LEVEL}" \
    --memory="${MEMORY_LIMIT}" \
    --cpus="${CPU_LIMIT}" \
    ${IMAGE_NAME}

echo -e "${GREEN}✓ Container started${NC}"
echo ""

# Wait for startup
echo "Waiting for service to start..."
sleep 5

# Check health
echo -e "${BLUE}Checking health...${NC}"
HEALTH_CHECK=$(curl -s -H "X-API-Key: ${URLSHIELD_API_KEY}" http://localhost:${PORT}/health)

if echo "${HEALTH_CHECK}" | grep -q '"ok":true'; then
    echo -e "${GREEN}✓ Service is healthy${NC}"
    echo "${HEALTH_CHECK}" | python3 -m json.tool
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Logs:"
    docker logs ${CONTAINER_NAME}
    exit 1
fi

echo ""
echo "=================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=================================="
echo ""
echo "Service Information:"
echo "  URL: http://localhost:${PORT}"
echo "  API Key: ${URLSHIELD_API_KEY}"
echo "  Container: ${CONTAINER_NAME}"
echo ""
echo "Useful Commands:"
echo "  View logs: docker logs -f ${CONTAINER_NAME}"
echo "  Stop: docker stop ${CONTAINER_NAME}"
echo "  Restart: docker restart ${CONTAINER_NAME}"
echo "  Status: docker ps -f name=${CONTAINER_NAME}"
echo ""
echo -e "${YELLOW}⚠ Keep your API key secure!${NC}"
echo "  Stored in: .urlshield_production.env"
echo ""
