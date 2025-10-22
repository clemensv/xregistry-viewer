// Production server for xRegistry Viewer
// Serves the built Angular application and handles proxy requests

const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Enable gzip compression
app.use(compression());

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Path to the built Angular application
const distFolder = path.join(__dirname, 'dist', 'xregistry-viewer');
const browserFolder = distFolder; // Angular 19 outputs directly to dist folder
const configPath = path.join(distFolder, 'config.json');

// Load allowed proxy targets from config.json
let allowedProxyPrefixes = [];
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    allowedProxyPrefixes = [
      ...(config.apiEndpoints || []),
      ...(config.modelUris || [])
    ];
    console.log('✓ Loaded allowed proxy prefixes from config.json:', allowedProxyPrefixes);
  } else {
    console.warn(`⚠ config.json not found at ${configPath}`);
  }
} catch (e) {
  console.error('✗ Failed to load config.json:', e.message);
}

// CORS headers middleware for all routes
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Proxy endpoint for handling external API requests with CORS
app.all('/proxy', async (req, res) => {
  const targetUrl = req.query.target;

  if (!targetUrl || typeof targetUrl !== 'string') {
    console.warn(`[PROXY] Missing or invalid target parameter: ${targetUrl}`);
    return res.status(400).json({ error: 'Missing or invalid target parameter' });
  }

  // Validate target URL against allowed prefixes
  const isAllowed = allowedProxyPrefixes.length === 0 ||
                    allowedProxyPrefixes.some(prefix => targetUrl.startsWith(prefix));

  if (!isAllowed) {
    console.warn(`[PROXY] Target URL not allowed: ${targetUrl}`);
    return res.status(403).json({
      error: 'Target URL not allowed',
      allowed: allowedProxyPrefixes
    });
  }

  console.log(`[PROXY] Proxying request to: ${targetUrl}`);

  // Use node's built-in fetch (available in Node.js 18+)
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': req.get('User-Agent') || 'xregistry-viewer-proxy',
        'Accept': req.get('Accept') || '*/*',
        'Accept-Encoding': req.get('Accept-Encoding') || 'gzip, deflate',
        ...(req.get('Content-Type') && { 'Content-Type': req.get('Content-Type') })
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });

    // Copy response headers
    response.headers.forEach((value, key) => {
      // Skip headers that are already set by CORS middleware
      if (!['access-control-allow-origin', 'access-control-allow-credentials'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Set status and send response
    res.status(response.status);
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else if (contentType && contentType.includes('text/')) {
      const text = await response.text();
      res.send(text);
    } else {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (error) {
    console.error(`[PROXY] Error: ${error.message}`);
    res.status(500).json({
      error: 'Proxy error',
      message: error.message,
      target: targetUrl
    });
  }
});

// Serve config.json with no-cache headers
app.get('/config.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(browserFolder, 'config.json'));
});

// Serve static files with caching
app.use(express.static(browserFolder, {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    // Don't cache HTML files
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(browserFolder, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.stack}`);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('🚀 xRegistry Viewer Server');
  console.log('═══════════════════════════════════════════════');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`📂 Serving from: ${browserFolder}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Proxy endpoint: http://localhost:${PORT}/proxy?target=<url>`);
  if (allowedProxyPrefixes.length > 0) {
    console.log(`✓ Allowed proxy targets: ${allowedProxyPrefixes.length} prefix(es)`);
  } else {
    console.log(`⚠ Warning: No proxy restrictions configured`);
  }
  console.log('═══════════════════════════════════════════════');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;
