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
ng build
```
Artifacts stored in `dist/` directory.

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
