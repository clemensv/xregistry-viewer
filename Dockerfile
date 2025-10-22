# Multi-stage build for xRegistry Viewer with Node.js + Express

# Stage 1: Build the Angular application
FROM node:22-alpine AS builder

# Install security updates
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Note: npm audit fix can cause install failures; vulnerabilities are mostly in dev dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application for production
RUN npm run build-prod

# Stage 2: Production server with Node.js + Express
FROM node:22-alpine

# Install security updates and remove unnecessary packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
# Note: npm audit fix requires write access to package.json, so we skip it in production build
RUN npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist/xregistry-viewer ./dist/xregistry-viewer

# Copy config.json from public folder to the output directory
COPY --from=builder /app/public/config.json ./dist/xregistry-viewer/config.json

# Copy server file
COPY server.js ./

# Create non-root user with specific UID/GID
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "server.js"]
