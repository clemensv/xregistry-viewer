# xRegistry Viewer

[![CI/CD Pipeline](https://github.com/clemensv/xregistry-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/clemensv/xregistry-viewer/actions/workflows/ci.yml)
[![Build Container Image](https://github.com/clemensv/xregistry-viewer/actions/workflows/build-image.yml/badge.svg)](https://github.com/clemensv/xregistry-viewer/actions/workflows/build-image.yml)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2Fclemensv%2Fxregistry--viewer-blue?logo=docker)](https://github.com/clemensv/xregistry-viewer/pkgs/container/xregistry-viewer)

This is an Angular application that visualizes and explores data from an
xRegistry-compliant API. It provides a user-friendly interface to browse
registry groups, resources, versions, and detailed documents.

The application is model-driven, using the metadata provided by the xRegistry API's
model endpoint and dynamically adapts its UI based on the resource schemas and types.

You can point the application to one of multiple xRegistry endpoints. The
application will consolidate and display data from the selected registries in a
unified interface, grouping metadata by model and groups.

The repository builds a Docker image with a production-ready Angular application
served via a Node.js + Express server, including an API proxy for cross-origin
requests.


## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Guide](#development-guide)
- [Docker Deployment](#docker-deployment)
- [Testing](#testing)
- [Architecture](#architecture)
- [Contributing](#contributing)

## ✨ Features

- **Browse Registry Data**: Explore group types, groups, resources, and versions
- **Detailed Views**: View resource documents, schemas, and metadata
- **Search & Filter**: Quick search and advanced filtering capabilities
- **Smart Display Modes**: Automatic card/list view based on content density
- **Sticky Page Reloads**: Maintains your location across page refreshes (see below)
- **API Proxy**: Built-in proxy for secure cross-origin API requests
- **Health Monitoring**: Health check endpoints for production monitoring

### 🔄 Sticky Reloads

The application preserves your navigation state during page refreshes, making development and bookmarking easier.

**Use Cases:**

- Bookmarking deep links to specific resources
- Development workflow with hot reloads  
- Sharing URLs that point to specific registry items

**How It Works:**

1. Current route is stored in browser session storage
2. On page reload, app redirects to root and then auto-navigates to previous location
3. Route storage is cleared on explicit home navigation to prevent redirect loops

**Example:**

```text
Navigate to: /schemagroups/Contoso.ERP/schemas/Contoso.ERP.CancellationData
Reload page → automatically returns to the same resource detail view
```

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20.19.3 or higher (LTS recommended)
- **npm**: v10.0.0 or higher (comes with Node.js)
- **Angular CLI**: v19.0.0 or higher
- **Docker**: v20.10.0 or higher (optional, for containerized deployment)
- **Docker Compose**: v2.0.0 or higher (optional, for containerized deployment)

**Check your versions:**

```bash
node --version    # Should show v20.x.x or higher
npm --version     # Should show v10.x.x or higher
ng version        # Should show Angular CLI 19.x.x
docker --version  # Optional: for Docker deployment
```

**Install Angular CLI globally (if not already installed):**

```bash
npm install -g @angular/cli@19
```

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/clemensv/xregistry-viewer.git
cd xregistry-viewer
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages listed in `package.json`, including:

- Angular 19 framework and dependencies
- FluentUI Web Components for UI
- RxJS for reactive programming
- Development tools (TypeScript, Jest, etc.)

### 3. Start Development Server

```bash
npm start
# or
ng serve
```

The application will be available at: `http://localhost:4200/`

The development server includes:

- **Hot Module Replacement (HMR)**: Changes automatically reflected in browser
- **Source Maps**: For easier debugging
- **Live Reload**: Browser refreshes on file changes

## 💻 Development Guide

### Project Structure

```text
xregistry-viewer/
├── src/
│   ├── app/
│   │   ├── components/      # UI components
│   │   ├── services/        # Business logic and API calls
│   │   ├── models/          # TypeScript interfaces and types
│   │   ├── utils/           # Helper functions
│   │   └── app.routes.ts    # Application routing
│   ├── assets/              # Static files (images, fonts, etc.)
│   ├── environments/        # Environment-specific configuration
│   ├── styles/              # Global SCSS styles
│   └── index.html           # Main HTML entry point
├── docs/                    # Documentation
├── public/                  # Public assets (favicon, config.json)
├── server.js                # Production Express server
├── Dockerfile               # Docker build configuration
└── docker-compose.yml       # Docker Compose orchestration
```

### Key Technologies

- **Angular 19**: Frontend framework with standalone components
- **TypeScript 5.7**: Strongly-typed JavaScript superset
- **FluentUI Web Components**: UI component library
- **RxJS 7**: Reactive programming library
- **SCSS**: CSS preprocessor for styling
- **Jest**: Testing framework
- **Express.js 4**: Production server (Docker deployment)

### Development Workflow

1. **Create a Feature Branch**

   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make Changes**

   - Edit files in `src/app/`
   - Follow Angular style guide
   - Use TypeScript strict mode

3. **Test Your Changes**

   ```bash
   npm test              # Run unit tests
   npm run test:watch    # Watch mode for TDD
   ```

4. **Build for Production**

   ```bash
   npm run build-prod    # Create production build
   ```

5. **Commit and Push**

   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/my-new-feature
   ```

## ⚙️ Configuration

### API Configuration

The application needs to be configured with your xRegistry API endpoint.

#### Option 1: Via UI (Recommended for Development)

1. Click the **Settings icon** (⚙️) in the application header
2. Navigate to **API Configuration**
3. Enter your API base URL (e.g., `https://myregistry.example.com`)
4. Click **Save Changes**

Configuration is persisted in browser local storage and survives page reloads.

#### Option 2: Via config.json (Recommended for Production)

For production deployments, configure the API via `public/config.json`:

```json
{
  "apiBaseUrl": "https://your-xregistry-api.com",
  "registryEndpoint": "https://your-xregistry-api.com/api/v1"
}
```

The application loads this configuration on startup. This approach is ideal for:

- Docker deployments
- CI/CD pipelines
- Environment-specific configurations
- Configuration without rebuilding the application

#### Option 3: Environment Files (Build-Time Configuration)

For build-time configuration, edit environment files:

**Development (`src/environments/environment.ts`):**

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'https://dev.myregistry.example.com'
};
```

**Production (`src/environments/environment.prod.ts`):**

```typescript
export const environment = {
  production: true,
  apiBaseUrl: 'https://myregistry.example.com'
};
```

**Note:** Environment files are baked into the build, requiring a rebuild to change configuration.

### Proxy Configuration

The built-in proxy allows the application to make cross-origin API requests securely. Configure proxy targets in `public/config.json`:

```json
{
  "proxyPrefixes": [
    "https://myregistry.example.com",
    "https://api.example.com"
  ]
}
```

The application will route requests through `/proxy?target=<url>` for these prefixes.

## 🔨 Build

### Development Build

```bash
npm run build
# or
ng build
```

Output: `dist/xregistry-viewer/` (non-optimized, with source maps)

### Production Build

```bash
npm run build-prod
# or
ng build --configuration production
```

Output: `dist/xregistry-viewer/` (optimized, minified, tree-shaken)

**Production build features:**

- **Ahead-of-Time (AOT) Compilation**: Pre-compiles templates for faster rendering
- **Tree Shaking**: Removes unused code
- **Minification**: Reduces file sizes
- **Code Splitting**: Lazy-loaded routes for optimal performance
- **Server-Side Rendering (SSR) Support**: Pre-renders pages for SEO and performance
- **Compression**: Gzip/Brotli ready

**Build artifacts location:**

```text
dist/xregistry-viewer/
├── browser/              # Client-side application
│   ├── index.html
│   ├── main.*.js
│   ├── polyfills.*.js
│   └── styles.*.css
└── server/              # SSR server (if enabled)
```

## 🐳 Docker Deployment

Pre-built Docker images are automatically published to GitHub Container Registry (ghcr.io) on every push to master and for tagged releases. Images are signed with Sigstore cosign for supply chain security.

**Pull the latest image:**
```bash
docker pull ghcr.io/clemensv/xregistry-viewer:latest
```

The application uses a **unified architecture** with a single Node.js + Express server that handles:

- Static file serving (Angular application)
- API proxy (for cross-origin requests)
- Health monitoring
- Configuration loading
- Gzip compression

### Architecture Overview

```text
┌─────────────────────────────────────────────────┐
│          Docker Container (Port 4000)           │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │         Express.js Server (Node 22)        │ │
│  │                                            │ │
│  │  • Static Files (/dist/xregistry-viewer/) │ │
│  │  • API Proxy    (/proxy)                  │ │
│  │  • Health Check (/health)                 │ │
│  │  • Config       (/config.json)            │ │
│  │  • Compression  (gzip)                    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Alpine Linux (minimal base image)              │
└─────────────────────────────────────────────────┘
```

### Quick Start with Docker Compose (Recommended)

This is the easiest way to run the application in Docker using the pre-built image.

**Step 1: Create a docker-compose.yml**

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
```

**Step 2: Start the service**

```bash
docker-compose up -d
```

This will:

1. Pull the latest pre-built Docker image from GitHub Container Registry
2. Start the container in detached mode
3. Expose port 4000 on your host machine
4. Mount `public/config.json` as a volume (for easy configuration updates)

**Step 3: Verify it's running**

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Test health endpoint
curl http://localhost:4000/health
```

**Step 4: Access the application**

- **Application**: <http://localhost:4000>
- **Health Check**: <http://localhost:4000/health>
- **Config Endpoint**: <http://localhost:4000/config.json>
- **Proxy Endpoint**: <http://localhost:4000/proxy?target=https://api.example.com>

**Step 5: Stop the service**

```bash
docker-compose down
```

### Using Pre-built Images (Recommended)

Pull and run the latest image directly:

```bash
# Pull the latest image
docker pull ghcr.io/clemensv/xregistry-viewer:latest

# Run the container
docker run -d \
  -p 4000:4000 \
  --name xregistry-viewer \
  -v $(pwd)/public/config.json:/app/dist/xregistry-viewer/config.json \
  ghcr.io/clemensv/xregistry-viewer:latest
```

**Available image tags:**
- `latest` - Latest build from master branch
- `v1.2.3` - Specific version (semantic versioning)
- `<sha>` - Specific commit SHA

**Images are:**
- ✅ Automatically built on every push to master
- ✅ Signed with Sigstore cosign (supply chain security)
- ✅ Published to GitHub Container Registry (ghcr.io)
- ✅ Multi-platform (linux/amd64, linux/arm64)

### Build Docker Images Locally (Advanced)

For local development or custom builds:

**Using build scripts:**

**PowerShell (Windows):**
```powershell
.\build-docker.ps1
```

**Bash (Linux/Mac):**
```bash
chmod +x build-docker.sh
./build-docker.sh
```

**Manual build:**

```bash
# Build the image
docker build -t xregistry-viewer:latest .

# Run the container
docker run -d \
  -p 4000:4000 \
  --name xregistry-viewer \
  -v $(pwd)/public/config.json:/app/dist/xregistry-viewer/config.json \
  xregistry-viewer:latest

# Verify
docker ps
docker logs xregistry-viewer
```

### Docker Image Details

**Multi-Stage Build:**

The Dockerfile uses a multi-stage build for optimal image size and security:

1. **Builder Stage**: Uses Node 22 to install dependencies and build the application
2. **Production Stage**: Uses Node 22 Alpine (minimal) to run only the production server

**Image Size:** ~250MB (Alpine Linux + Node 22 + Application)

**Base Image:** `node:22-alpine` (minimal, secure, regularly updated)

### Configuration in Docker

Mount your `config.json` file to customize the application without rebuilding:

```bash
docker run -d \
  -p 4000:4000 \
  -v /path/to/your/config.json:/app/dist/xregistry-viewer/config.json \
  xregistry-viewer:latest
```

**Example `config.json`:**

```json
{
  "apiBaseUrl": "https://myregistry.example.com",
  "registryEndpoint": "https://myregistry.example.com/api/v1",
  "proxyPrefixes": [
    "https://myregistry.example.com",
    "https://api.example.com"
  ]
}
```

### Docker Compose Configuration

Customize `docker-compose.yml` for your environment:

```yaml
version: '3.8'
services:
  xregistry-viewer:
    build: .
    ports:
      - "4000:4000"  # Change port mapping if needed
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

### Production Deployment

For production deployments, see the comprehensive guide:

📖 **[Docker Deployment Guide](docs/DOCKER_DEPLOYMENT.md)**

Covers:

- Security best practices
- SSL/TLS configuration
- Reverse proxy setup (nginx, Traefik)
- Container orchestration (Kubernetes, Docker Swarm)
- Monitoring and logging
- Backup and recovery
- Performance tuning

## 🧪 Testing

### Unit Tests

Run unit tests with Jest:

```bash
npm test
# or
ng test
```

**Watch mode (recommended for development):**

```bash
npm run test:watch
```

**Generate coverage report:**

```bash
npm run test:coverage
```

Coverage report will be generated in `coverage/` directory. Open `coverage/index.html` in a browser to view detailed coverage.

**Test Structure:**

```text
src/app/
├── components/
│   └── my-component/
│       ├── my-component.component.ts
│       └── my-component.component.spec.ts  ← Test file
└── services/
    ├── my-service.service.ts
    └── my-service.service.spec.ts          ← Test file
```

**Writing Tests:**

```typescript
import { TestBed } from '@angular/core/testing';
import { MyService } from './my-service.service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return correct value', () => {
    const result = service.getValue();
    expect(result).toBe('expected value');
  });
});
```

### Testing in Docker

Test the Docker image before deployment:

```bash
# Build and start the container
docker-compose up -d

# Run smoke tests against the container
curl http://localhost:4000/health
curl http://localhost:4000/

# Check logs for errors
docker-compose logs

# Stop the container
docker-compose down
```

## 🏗️ Architecture

### Application Architecture

The application follows Angular best practices with a component-based architecture:

```text
┌─────────────────────────────────────────────────┐
│              Angular Application                │
│                                                 │
│  ┌─────────────┐  ┌──────────────┐            │
│  │ Components  │←→│   Services   │            │
│  │             │  │              │            │
│  │ - Header    │  │ - Registry   │            │
│  │ - Groups    │  │ - Document   │            │
│  │ - Resources │  │ - Config     │            │
│  │ - Search    │  │              │            │
│  └─────────────┘  └──────────────┘            │
│         ↑                ↑                      │
│         │                │                      │
│  ┌──────┴────────────────┴─────┐              │
│  │        Routing (Routes)       │              │
│  └──────────────────────────────┘              │
│         ↑                                       │
│         │                                       │
│  ┌──────┴────────────────────────┐            │
│  │     Models & Interfaces        │            │
│  └───────────────────────────────┘            │
└─────────────────────────────────────────────────┘
                    ↓
         ┌──────────────────────┐
         │   xRegistry API      │
         │   (via proxy)        │
         └──────────────────────┘
```

### Key Design Patterns

**1. Service Layer Pattern**

- Services handle business logic and API calls
- Components only handle presentation logic
- Dependency injection for loose coupling

**2. Reactive Programming (RxJS)**

- Observables for asynchronous operations
- Operators for data transformation
- Subscription management to prevent memory leaks

**3. Component Composition**

- Small, focused components
- Parent-child communication via `@Input()` and `@Output()`
- Smart components (containers) vs. Dumb components (presentational)

**4. Lazy Loading**

- Routes loaded on-demand
- Reduces initial bundle size
- Improves performance

### Data Flow

```text
User Action → Component → Service → API (via Proxy) → Response
                 ↓                                         ↓
           Template Update ← Observable ← RxJS Transform ←┘
```

### State Management

- Component state for UI-specific state
- Service state for shared state
- SessionStorage for navigation state (sticky reloads)
- LocalStorage for user preferences (API configuration)

## 🤝 Contributing

### Contribution Workflow

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** (follow coding standards)
4. **Add tests** for new functionality
5. **Run tests and linting** (`npm test`, `npm run lint`)
6. **Commit your changes** (`git commit -m 'feat: add amazing feature'`)
7. **Push to your fork** (`git push origin feature/amazing-feature`)
8. **Open a Pull Request**

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(search): add fuzzy search functionality
fix(api): resolve CORS issue with proxy
docs(readme): update Docker deployment instructions
test(services): add unit tests for registry service
```

### Code Style

- Follow [Angular Style Guide](https://angular.io/guide/styleguide)
- Use TypeScript strict mode
- Write meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused (< 50 lines)
- Use async/await instead of callbacks

### Pull Request Guidelines

- **Title**: Clear and descriptive
- **Description**: What, why, and how
- **Tests**: Include tests for new features
- **Documentation**: Update docs if needed
- **Screenshots**: For UI changes
- **Breaking Changes**: Clearly marked

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/clemensv/xregistry-viewer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/clemensv/xregistry-viewer/discussions)
- **Documentation**: [docs/](docs/)

## 🙏 Acknowledgments

- Angular team for the amazing framework
- xRegistry specification authors
- All contributors to this project

---

**Built with ❤️ using Angular 19**
