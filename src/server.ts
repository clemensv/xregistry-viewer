import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './main.server';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

const app = express();
const commonEngine = new CommonEngine();

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

// Handle /api/* requests with a mock endpoint
app.get('/api/*', (req, res) => {
  // During SSR, we want to return minimal mock data that'll be replaced by actual data on the client
  if (req.path.includes('/api/model')) {
    // Return minimal model data
    return res.json({
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
  }

  if (req.path.includes('/api/capabilities')) {
    return res.json({
      apis: ['v1'],
      schemas: ['openapi-v3'],
      pagination: false
    });
  }

  // For other API requests, return an empty response
  return res.json({});
});

/**
 * Serve static files from /browser
 */
app.get(
  '**',
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html'
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.get('**', (req, res, next) => {
  const { protocol, originalUrl, baseUrl, headers } = req;

  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: `${protocol}://${headers.host}${originalUrl}`,
      publicPath: browserDistFolder,
      providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
    })
    .then((html) => res.send(html))
    .catch((err) => next(err));
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export default app;
