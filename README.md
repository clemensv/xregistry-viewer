# McpXregSite

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.11.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Configuration

The application allows you to configure the base URL of the xRegistry API:

1. Use the settings icon in the top-right corner of the application and select "API Configuration"
2. Enter the desired API base URL (e.g., `https://mcpxreg.org`)
3. Click "Save Changes" to apply the new URL

The configuration is stored in your browser's local storage and will persist between sessions.

You can also configure the default API URL by modifying the `environment.ts` file:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'https://mcpxreg.org'
};
```

For production builds, update the `environment.prod.ts` file with the appropriate URL.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

# xRegistry Viewer

This is an Angular application for viewing and exploring xRegistry data.

## Features

- Browse registry group types, groups, resources, and versions
- View detailed resource documents and schemas
- Search and filter functionality  
- Smart view modes (cards/list) based on content density
- **Sticky page reloads** - maintains your location across page refreshes

### Sticky Reloads

The application implements "sticky" page reloads that preserve your navigation state when the page is refreshed. This is especially useful when:

- Bookmarking deep links to specific resources
- Refreshing the page during development
- Sharing URLs that point to specific registry items

**How it works:**
- The application automatically stores your current route in browser session storage
- When you reload the page (which redirects to root on static servers), the app detects this and navigates back to your previous location
- The stored route is cleared when you explicitly navigate to the home page, so you won't get stuck in redirect loops

**Example:**
1. Navigate to `/schemagroups/Contoso.ERP/schemas/Contoso.ERP.CancellationData`
2. Reload the page (F5 or Ctrl+R)
3. The page briefly shows the root, then automatically navigates back to the resource detail page

This feature works seamlessly with static site deployments that redirect all unknown routes to the root.
