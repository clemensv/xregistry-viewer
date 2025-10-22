# PowerShell script to build xRegistry Viewer Docker images

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Green
Write-Host "xRegistry Viewer - Docker Build" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Configuration
$IMAGE_NAME = "xregistry-viewer"
$PROXY_IMAGE_NAME = "xregistry-proxy"
$VERSION = if ($args[0]) { $args[0] } else { "latest" }
$BUILD_DATE = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$GIT_COMMIT = try { (git rev-parse --short HEAD) } catch { "unknown" }

Write-Host "Building version: $VERSION" -ForegroundColor Yellow
Write-Host "Git commit: $GIT_COMMIT" -ForegroundColor Yellow
Write-Host "Build date: $BUILD_DATE" -ForegroundColor Yellow
Write-Host ""

# Build unified application image
Write-Host "Building xRegistry Viewer (unified app + proxy)..." -ForegroundColor Green
docker build `
  --tag "${IMAGE_NAME}:${VERSION}" `
  --tag "${IMAGE_NAME}:latest" `
  --build-arg BUILD_DATE="${BUILD_DATE}" `
  --build-arg VCS_REF="${GIT_COMMIT}" `
  --file Dockerfile `
  .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build application image" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Application image built successfully" -ForegroundColor Green
Write-Host ""

# Display image information
Write-Host "Image Information:" -ForegroundColor Green
Write-Host "---"
docker images | Select-String -Pattern "$IMAGE_NAME" | Select-String -Pattern "$VERSION|latest"
Write-Host ""

Write-Host "================================" -ForegroundColor Green
Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "To run the application:"
Write-Host "  docker-compose up -d"
Write-Host ""
Write-Host "To push to registry:"
Write-Host "  docker tag ${IMAGE_NAME}:${VERSION} your-registry.com/${IMAGE_NAME}:${VERSION}"
Write-Host "  docker push your-registry.com/${IMAGE_NAME}:${VERSION}"
Write-Host ""
