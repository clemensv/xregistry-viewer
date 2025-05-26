import 'zone.js/node';

import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr/node';
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fetch from 'node-fetch';
import fs from 'node:fs';
// Import bootstrap function - path will be resolved at build time
import { bootstrap } from './main.server';

// Debug flag to enable additional logging
const DEBUG = process.env['NODE_ENV'] === 'development';

// Helper function to log debug info
function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log(`[DEBUG ${new Date().toISOString()}]`, ...args);
  }
}

// This is a good place to set a breakpoint
debugLog('Server starting up...');

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();

  const distFolder = join(process.cwd(), 'dist/xregistry-viewer');
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? join(distFolder, 'index.original.html')
    : join(distFolder, 'index.html');

  debugLog('Dist folder:', distFolder);
  debugLog('Index HTML:', indexHtml);

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Load allowed proxy targets from config.json at startup
  let allowedProxyPrefixes: string[] = [];
  try {
    // This is another good place to set a breakpoint
    const configPath = join(distFolder, 'config.json');
    debugLog('Loading config from:', configPath);
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      allowedProxyPrefixes = [
        ...(config.apiEndpoints || []),
        ...(config.modelUris || [])
      ];
      console.log('Allowed proxy prefixes loaded from config.json:', allowedProxyPrefixes);
    } else {
      console.warn(`config.json not found at ${configPath}, using empty allowed proxy prefixes`);
    }
  } catch (e) {
    console.error('Failed to load allowed proxy URIs from config.json:', e);
  }

  // Example Express Rest API endpoints
  server.get('/api/model', (req, res) => {
    console.log(`[${new Date().toISOString()}] [API] /api/model called from ${req.ip}`);
    // Return minimal model data for SSR
    res.json({
      specversion: '1.0',
      registryid: 'default-registry',
      name: 'Default Registry',
      description: 'Mock registry for SSR',
      capabilities: {
        apis: ['v1'],
        schemas: ['openapi-v3'],
        pagination: false
      },
      groups: {
        'namespace': {
          plural: 'namespaces',
          singular: 'namespace',
          description: 'Namespace for organizing resources',
          attributes: {},
          resources: {
            'schema': {
              plural: 'schemas',
              singular: 'schema',
              description: 'Schema definition',
              hasdocument: true,
              maxversions: 1,
              attributes: {}
            }
          }
        }
      }
    });
  });


  server.options('/proxy', (req, res) => {
    console.log(`[${new Date().toISOString()}] [PROXY] Preflight request: method=${req.method}, target=${req.query['target']}, ip=${req.ip}, headers=${JSON.stringify(req.headers)}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
  });

  // Proxy endpoint for SSR CORS circumvention
  server.get('/proxy', async (req: express.Request, res: express.Response) => {
    const target = req.query['target'];
    console.log(`[${new Date().toISOString()}] [PROXY] Incoming request: method=${req.method}, target=${target}, ip=${req.ip}, headers=${JSON.stringify(req.headers)}`);
    if (!target || typeof target !== 'string') {
      console.warn(`[${new Date().toISOString()}] [PROXY] Missing or invalid target parameter: ${target}`);
      res.status(400).json({ error: 'Missing or invalid target parameter' });
      return;
    }
    // Only allow proxying to allowed prefixes
    const isAllowed = allowedProxyPrefixes.some(prefix => target.startsWith(prefix));
    if (!isAllowed) {
      console.warn(`[${new Date().toISOString()}] [PROXY] Target URI not allowed: ${target}`);
      res.status(403).json({ error: 'Target URI not allowed' });
      return;
    }
    try {
      // Forward method, headers, and body
      const fetchOptions: any = {
        method: req.method,
        headers: { ...req.headers },
        redirect: 'manual',
      };
      // Remove host/header fields that should not be forwarded
      delete fetchOptions.headers['host'];
      delete fetchOptions.headers['content-length'];
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOptions.body = req;
      }
      console.log(`[${new Date().toISOString()}] [PROXY] Forwarding request to: ${target} with options:`, JSON.stringify({ ...fetchOptions, body: undefined }));
      const response = await fetch(target, fetchOptions);      // Forward status and headers
      res.status(response.status);

      // Debug Link header specifically
      const linkHeader = response.headers.get('Link');
      if (linkHeader) {
        console.log(`[${new Date().toISOString()}] [PROXY] Found Link header in response: "${linkHeader}"`);
        // Ensure Link header is properly forwarded
        res.setHeader('Link', linkHeader);
        // Also set a duplicate header with a different case to test case-sensitivity
        res.setHeader('link', linkHeader);
      } else {
        console.log(`[${new Date().toISOString()}] [PROXY] No Link header found in response`);
      }

      // Forward all headers
      response.headers.forEach((value, key) => {
        // Debug each header
        console.log(`[${new Date().toISOString()}] [PROXY] Forwarding header: ${key}: ${value}`);
        res.setHeader(key, value);
      });

      // Log all headers that were set on the response
      console.log(`[${new Date().toISOString()}] [PROXY] All headers set on response:`, res.getHeaders());

      console.log(`[${new Date().toISOString()}] [PROXY] Response from target: status=${response.status}, headers=${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
      if (response.body) {
        response.body.pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [PROXY] Proxy error:`, err);
      res.status(502).json({ error: 'Proxy request failed', details: err?.toString() });
    }
  });

  // Serve static files from /browser
  server.use(express.static(distFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Universal engine
  server.get('/{*any}', (req, res, next) => {
    // Use req.protocol and req.get('host') for SSR URL
    const protocol = req.protocol || 'http';
    const host = req.get('host');
    const url = `${protocol}://${host}${req.originalUrl}`;
    const baseHref = '/';

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url,
        publicPath: distFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseHref }],
      })
      .then((html: string) => res.send(html))
      .catch((err: Error) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

// Ensure this file is executed as an entry point
// The code below will be executed when this file is loaded directly
// This handles both ESM and CommonJS environments
const isMainModule =
  (typeof require !== 'undefined' && require.main === module) ||
  (typeof process !== 'undefined' && process.argv && process.argv[1] &&
    (process.argv[1].endsWith('main.js') || process.argv[1].endsWith('server.js')));

if (isMainModule) {
  // This is being run directly - start the server
  console.log('Starting xRegistry Viewer SSR server...');
  run();
}


