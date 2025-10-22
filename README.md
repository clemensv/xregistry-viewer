# xRegistry Viewer

Angular application for viewing and exploring xRegistry data.

## Features

- Browse registry group types, groups, resources, and versions
- View detailed resource documents and schemas
- Search and filter functionality  
- Smart view modes (cards/list) based on content density
- **Sticky page reloads** - maintains your location across page refreshes

### Sticky Reloads

Preserves navigation state during page refreshes. Useful for:
- Bookmarking deep links to specific resources
- Development workflow with hot reloads
- Sharing URLs that point to specific registry items

**Implementation:**
- Current route stored in browser session storage
- Page reloads redirect to root, then auto-navigate to previous location
- Route storage cleared on explicit home navigation to prevent redirect loops

**Example:**
Navigate to `/schemagroups/Contoso.ERP/schemas/Contoso.ERP.CancellationData` → reload page → automatically returns to resource detail.

## Development

Start development server:
```bash
ng serve
```
Access at `http://localhost:4200/`

## Configuration

Configure xRegistry API base URL via:

1. Settings icon → API Configuration
2. Enter API base URL (e.g., `https://mcpxreg.org`)
3. Save Changes

Configuration persists in browser local storage.

**Environment configuration:**
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiBaseUrl: 'https://mcpxreg.org'
};
```

## Build

Production build:
```bash
npm run build-prod
```
Artifacts stored in `dist/` directory.

## Docker Deployment

The application can be deployed using Docker with a unified Node.js + Express server that handles both static file serving and API proxying.

### Quick Start with Docker Compose

```bash
# Build and start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down
```

Access the application at:
- **Application**: http://localhost:4000
- **Health Check**: http://localhost:4000/health
- **Proxy Endpoint**: http://localhost:4000/proxy?target=<url>

### Build Docker Images

Using the build scripts:

**PowerShell (Windows):**
```powershell
.\build-docker.ps1
```

**Bash (Linux/Mac):**
```bash
chmod +x build-docker.sh
./build-docker.sh
```

### Manual Docker Build

```bash
# Build the application
docker build -t xregistry-viewer:latest .

# Run the container
docker run -d -p 4000:4000 --name xregistry-viewer xregistry-viewer:latest
```

For detailed deployment instructions, security configuration, and production best practices, see [Docker Deployment Guide](docs/DOCKER_DEPLOYMENT.md).

## Testing

Unit tests:
```bash
ng test
```

End-to-end tests:
```bash
ng e2e
```

## Code Generation

Generate components:
```bash
ng generate component component-name
```

Available schematics:
```bash
ng generate --help
```
