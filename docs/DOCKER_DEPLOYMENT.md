# Docker Deployment Guide - xRegistry Viewer

This guide explains how to deploy the xRegistry Viewer using Docker with a unified Node.js + Express server.

## � Pre-built Images

Docker images are automatically built and published to GitHub Container Registry on every push to master and for tagged releases.

**Pull the latest image:**
```bash
docker pull ghcr.io/clemensv/xregistry-viewer:latest
```

**Available tags:**
- `latest` - Latest build from master branch
- `v1.2.3` - Specific semantic version (for tagged releases)
- `<commit-sha>` - Build from specific commit

**Image features:**
- ✅ Automatically built via GitHub Actions
- ✅ Signed with Sigstore cosign (supply chain security)
- ✅ SLSA provenance attestation included
- ✅ Multi-stage build for minimal size (~250MB)
- ✅ Built on Node.js 22 Alpine

**Verify image signature:**
```bash
cosign verify \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity "https://github.com/clemensv/xregistry-viewer/.github/workflows/build-image.yml@refs/heads/master" \
  ghcr.io/clemensv/xregistry-viewer:latest
```

## �📋 Architecture Overview

The xRegistry Viewer uses a **unified server architecture** with a single Node.js + Express application that:

- ✅ Serves the built Angular static files
- ✅ Handles API proxy requests (CORS handling) using Node.js native `fetch` API
- ✅ Provides health check endpoints
- ✅ Runs as a single container with Express 4.21.2

**No nginx needed!** The Express server handles everything.

**Technical Stack**:
- **Runtime**: Node.js 22 Alpine
- **Web Framework**: Express 4.21.2 (stable, using path-to-regexp@0.1.12)
- **Proxy Method**: Native `fetch` API (no external proxy libraries)
- **Compression**: Built-in gzip via `compression` middleware

```
┌─────────────────────────────────────┐
│         Client Browser              │
└────────────────┬────────────────────┘
                 │
                 ▼
    ┌───────────────────────────┐
    │  xRegistry Viewer         │
    │  (Node.js + Express)      │
    │  Port: 4000               │
    │                           │
    │  • Static File Serving    │
    │  • API Proxy (/proxy)     │
    │  • Health Check (/health) │
    └───────────┬───────────────┘
                │
                ▼
       ┌────────────────────┐
       │  External APIs     │
       │  (via proxy)       │
       └────────────────────┘
```

## 🚀 Quick Start

### Using Docker Compose (Recommended)

**Step 1: Create docker-compose.yml**

```yaml
version: '3.8'
services:
  xregistry-viewer:
    image: ghcr.io/clemensv/xregistry-viewer:latest
    ports:
      - "4000:4000"
    volumes:
      - ./public/config.json:/app/dist/xregistry-viewer/config.json
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Step 2: Start the service**

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f xregistry-viewer

# Stop
docker-compose down
```

**Access**: http://localhost:4000

### Using Docker CLI

```bash
# Pull the latest image
docker pull ghcr.io/clemensv/xregistry-viewer:latest

# Run
docker run -d \
  -p 4000:4000 \
  --name xregistry-viewer \
  -v $(pwd)/public/config.json:/app/dist/xregistry-viewer/config.json \
  ghcr.io/clemensv/xregistry-viewer:latest

# View logs
docker logs -f xregistry-viewer

# Stop
docker stop xregistry-viewer
docker rm xregistry-viewer
```

## 📦 Building Images Locally (Optional)

**Note:** Pre-built images are available on GitHub Container Registry. Local builds are only needed for development or custom modifications.

### Automated Build Scripts

**Windows (PowerShell):**
```powershell
.\build-docker.ps1 [version]
```

**Linux/Mac (Bash):**
```bash
chmod +x build-docker.sh
./build-docker.sh [version]
```

### Manual Build

```bash
# Build with custom tag
docker build -t xregistry-viewer:custom .

# Build with version tag
docker build -t xregistry-viewer:1.0.0 .
```

**Note:** GitHub Actions automatically builds and publishes images on every push to master and for version tags.

## ⚙️ Configuration

### Runtime Configuration

Update `public/config.json` and mount it into the container:

```yaml
# docker-compose.yml
volumes:
  - ./public/config.json:/app/dist/xregistry-viewer/config.json:ro
```

**config.json structure:**
```json
{
  "apiEndpoints": [
    "https://api.example.com"
  ],
  "modelUris": [
    "https://api.example.com/model"
  ],
  "baseUrl": ""
}
```

Restart the container to apply changes:
```bash
docker-compose restart xregistry-viewer
```

### Environment Variables

```yaml
# docker-compose.yml
environment:
  - NODE_ENV=production  # production or development
  - PORT=4000            # Server port (default: 4000)
```

### Port Configuration

Change the exposed port in `docker-compose.yml`:
```yaml
ports:
  - "8080:4000"  # External:Internal
```

## 🔒 Production Deployment

### 1. HTTPS with Reverse Proxy

Use nginx or Caddy as a reverse proxy in front of the container:

**nginx example:**
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Caddy example (automatic HTTPS):**
```
your-domain.com {
    reverse_proxy localhost:4000
}
```

### 2. Resource Limits

Set resource limits in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

### 3. Logging

Configure log drivers:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 4. Security Best Practices

- ✅ Container runs as non-root user (nodejs:1001)
- ✅ Use specific image tags (not `latest`)
- ✅ Scan images regularly: `docker scan xregistry-viewer:latest`
- ✅ Keep base images updated
- ✅ Use read-only file systems where possible
- ✅ Implement rate limiting in reverse proxy
- ✅ Configure allowed proxy targets in config.json

## 🔍 Monitoring

### Health Checks

The application provides a health check endpoint:

```bash
curl http://localhost:4000/health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-10-22T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 123456789,
    "heapTotal": 123456789,
    "heapUsed": 123456789,
    "external": 123456789
  }
}
```

Docker health checks are pre-configured in the Dockerfile and docker-compose.yml.

### View Logs

```bash
# Docker Compose
docker-compose logs -f xregistry-viewer

# Docker CLI
docker logs -f xregistry-viewer

# Last 100 lines
docker logs --tail 100 xregistry-viewer

# Follow with timestamps
docker logs -f --timestamps xregistry-viewer
```

### Container Stats

```bash
# Real-time stats
docker stats xregistry-viewer

# All containers
docker stats
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs xregistry-viewer

# Inspect container
docker inspect xregistry-viewer

# Check if port is already in use
netstat -an | grep 4000  # Linux/Mac
Get-NetTCPConnection -LocalPort 4000  # Windows PowerShell
```

### Application Not Accessible

1. Verify container is running:
   ```bash
   docker ps | grep xregistry-viewer
   ```

2. Check health status:
   ```bash
   docker inspect xregistry-viewer | grep Health
   ```

3. Test from inside container:
   ```bash
   docker exec xregistry-viewer wget -O- http://localhost:4000/health
   ```

### CORS Errors

1. Verify proxy endpoint configuration
2. Check allowed proxy prefixes in config.json
3. Review application logs for proxy rejections

### Config Not Loading

1. Verify volume mount path
2. Check config.json format (valid JSON)
3. Restart container after config changes
4. Check file permissions

## 📊 Performance Tuning

### Node.js Memory

Set memory limits:
```bash
docker run -d \
  -p 4000:4000 \
  -e NODE_OPTIONS="--max-old-space-size=512" \
  xregistry-viewer:latest
```

### Compression

The server includes gzip compression enabled by default via the `compression` middleware.

### Caching

Static assets are cached for 1 year. Config files are not cached.

## 🚀 Scaling

### Horizontal Scaling

Run multiple containers behind a load balancer:

```yaml
# docker-compose-scale.yml
version: '3.8'

services:
  xregistry-viewer:
    image: xregistry-viewer:latest
    deploy:
      replicas: 3
    environment:
      - NODE_ENV=production
```

```bash
docker-compose -f docker-compose-scale.yml up --scale xregistry-viewer=3
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: xregistry-viewer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: xregistry-viewer
  template:
    metadata:
      labels:
        app: xregistry-viewer
    spec:
      containers:
      - name: xregistry-viewer
        image: xregistry-viewer:latest
        ports:
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
          requests:
            cpu: "500m"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: xregistry-viewer
spec:
  selector:
    app: xregistry-viewer
  ports:
  - port: 80
    targetPort: 4000
  type: LoadBalancer
```

## 🔄 CI/CD Integration

### GitHub Actions (Built-in)

The repository includes a complete GitHub Actions workflow (`.github/workflows/build-image.yml`) that:

1. **Builds** the Docker image on every push to master
2. **Tags** images with `latest`, commit SHA, and semantic versions
3. **Signs** images with Sigstore cosign (keyless signing via OIDC)
4. **Publishes** to GitHub Container Registry (ghcr.io)
5. **Verifies** signatures after publishing
6. **Generates** SLSA provenance attestations

**Triggered on:**
- Push to master branch
- Version tags (v*.*.*)
- Manual workflow dispatch
- Changes to source files, Dockerfile, or configuration

**Image tags generated:**
- `latest` (for master branch)
- `<commit-sha>` (for traceability)
- `v1.2.3`, `v1.2` (for version tags)

**View workflow runs:**
```bash
gh run list --workflow=build-image.yml
```

**Pull specific build:**
```bash
# By commit SHA
docker pull ghcr.io/clemensv/xregistry-viewer:abc1234

# By version tag
docker pull ghcr.io/clemensv/xregistry-viewer:v1.2.3
```

### GitLab CI

```yaml
build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

## 📝 Maintenance

### Updating the Application

```bash
# Pull latest pre-built image
docker pull ghcr.io/clemensv/xregistry-viewer:latest

# Update docker-compose.yml to use the new image (if needed)
# The image tag in docker-compose.yml pulls the latest automatically

# Restart with new image
docker-compose pull
docker-compose up -d
```

**For local builds:**
```bash
# Pull latest code
git pull

# Rebuild image
docker-compose build

# Restart with new image
docker-compose up -d
```

### Backup Configuration

```bash
# Backup config
docker cp xregistry-viewer:/app/dist/xregistry-viewer/config.json ./config.backup.json

# Restore config
docker cp ./config.backup.json xregistry-viewer:/app/dist/xregistry-viewer/config.json
docker-compose restart
```

### Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Full cleanup (careful!)
docker system prune -a --volumes
```

## 🆘 Support

### Useful Commands

```bash
# Shell into container
docker exec -it xregistry-viewer sh

# Check Node version
docker exec xregistry-viewer node --version

# Check if server.js exists
docker exec xregistry-viewer ls -la /app

# Test health endpoint from inside
docker exec xregistry-viewer wget -O- http://localhost:4000/health

# View environment variables
docker exec xregistry-viewer env
```

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in docker-compose.yml or stop conflicting service |
| Container exits immediately | Check logs: `docker logs xregistry-viewer` |
| Out of memory | Increase memory limit in docker-compose.yml |
| Build fails | Clear Docker cache: `docker builder prune` |
| Slow performance | Check resource limits, increase if needed |

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Docker Security](https://docs.docker.com/engine/security/)

## 🎯 Summary

**Key Points:**
- ✅ Pre-built images available on GitHub Container Registry
- ✅ Automatically built and signed with every push
- ✅ Single unified container (Node.js + Express)
- ✅ No separate nginx or proxy containers needed
- ✅ Simpler deployment and maintenance
- ✅ Built-in gzip compression and caching
- ✅ Health checks and monitoring ready
- ✅ Production-ready security features
- ✅ Easy to scale horizontally
- ✅ Supply chain security with Sigstore cosign

**Registry:** ghcr.io/clemensv/xregistry-viewer  
**Default Port:** 4000  
**Health Check:** /health  
**Proxy Endpoint:** /proxy?target=<url>
