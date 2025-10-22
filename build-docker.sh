#!/bin/bash
# Build script for xRegistry Viewer Docker images

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}xRegistry Viewer - Docker Build${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Configuration
IMAGE_NAME="xregistry-viewer"
PROXY_IMAGE_NAME="xregistry-proxy"
VERSION=${1:-"latest"}
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo -e "${YELLOW}Building version:${NC} ${VERSION}"
echo -e "${YELLOW}Git commit:${NC} ${GIT_COMMIT}"
echo -e "${YELLOW}Build date:${NC} ${BUILD_DATE}"
echo ""

# Build unified application image
echo -e "${GREEN}Building xRegistry Viewer (unified app + proxy)...${NC}"
docker build \
  --tag "${IMAGE_NAME}:${VERSION}" \
  --tag "${IMAGE_NAME}:latest" \
  --build-arg BUILD_DATE="${BUILD_DATE}" \
  --build-arg VCS_REF="${GIT_COMMIT}" \
  --file Dockerfile \
  . || {
    echo -e "${RED}Failed to build application image${NC}"
    exit 1
  }

echo -e "${GREEN}✓ Application image built successfully${NC}"
echo ""

# Display image information
echo -e "${GREEN}Image Information:${NC}"
echo "---"
docker images | grep -E "${IMAGE_NAME}" | grep -E "${VERSION}|latest"
echo ""

# Display image size
IMAGE_SIZE=$(docker images --format "{{.Size}}" "${IMAGE_NAME}:${VERSION}")

echo -e "${GREEN}Image Size:${NC}"
echo "  ${IMAGE_NAME}: ${IMAGE_SIZE}"
echo ""

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "To run the application:"
echo "  docker-compose up -d"
echo ""
echo "To push to registry:"
echo "  docker tag ${IMAGE_NAME}:${VERSION} your-registry.com/${IMAGE_NAME}:${VERSION}"
echo "  docker push your-registry.com/${IMAGE_NAME}:${VERSION}"
echo ""
