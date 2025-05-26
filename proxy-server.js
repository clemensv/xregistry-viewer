const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const port = 3001;

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:4201'],
  credentials: true
}));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.query.target) {
    console.log(`  -> Proxying to: ${req.query.target}`);
  }
  next();
});

// Proxy endpoint that handles the target parameter
app.use('/proxy', (req, res) => {
  const targetUrl = req.query.target;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target parameter' });
  }

  console.log(`Proxying request to: ${targetUrl}`);

  // Create a one-time proxy for this specific request
  const proxy = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    secure: false, // Allow self-signed certificates for development
    logLevel: 'debug',
    pathRewrite: {
      '^/proxy': '' // Remove /proxy from the path
    },
    onError: (err, req, res) => {
      console.error('Proxy error:', err.message);
      res.status(500).json({
        error: 'Proxy error',
        message: err.message,
        target: targetUrl
      });
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying ${req.method} request to: ${targetUrl}`);
      // Remove query parameters from the proxied request
      const url = new URL(targetUrl);
      proxyReq.path = url.pathname + url.search;
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`Received response from ${targetUrl}: ${proxyRes.statusCode}`);
      // Add CORS headers
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
    }
  });

  // Use the proxy for this request
  proxy(req, res);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`\n🚀 xRegistry Proxy Server running on http://localhost:${port}`);
  console.log(`📡 Ready to proxy requests to external xRegistry APIs`);
  console.log(`🔗 Example: http://localhost:${port}/proxy?target=https://schemas.mcpxreg.com/api/registry/model`);
  console.log(`\n💡 This server handles CORS issues when accessing external xRegistry endpoints\n`);
});

module.exports = app;
