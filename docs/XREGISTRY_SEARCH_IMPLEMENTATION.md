# xRegistry-Compliant Search Implementation

This document describes the implementation of xRegistry-compliant search functionality in the xRegistry Viewer application.

## Overview

The search functionality has been updated to use compliant xRegistry filter query parameters according to the [xRegistry specification](https://github.com/xregistry/spec). The primary search method focuses on name-based filtering using the `?filter=name={expression}` pattern.

## Implementation Details

### Search Service (`src/app/services/search.service.ts`)

The `SearchService` has been enhanced with the following xRegistry-compliant methods:

#### `generateNameFilter(searchTerm: string): string`
- Generates filter expressions for name-based searches
- Uses prefix matching with wildcards: `name=term*`
- Escapes special characters (asterisks and backslashes) in search terms
- Example: `searchTerm="test"` → `"name=test*"`

#### `generateAttributeFilter(attribute, value, operator, useWildcard): string`
- Generates filter expressions for custom attribute searches
- Supports all xRegistry operators: `=`, `!=`, `<>`, `<`, `<=`, `>`, `>=`
- Optional wildcard support for contains matching
- Example: `generateAttributeFilter('description', 'cool', '=', true)` → `"description=*cool*"`

#### `combineFiltersAnd(filters: string[]): string`
- Combines multiple filter expressions using AND logic (comma-separated)
- Example: `['name=test*', 'description=*cool*']` → `"name=test*,description=*cool*"`

### Registry Service Integration

The `RegistryService` (`src/app/services/registry.service.ts`) has been updated to properly handle filter parameters:

- `listResources()` and `listGroups()` methods accept filter parameters
- Filter parameters are correctly applied to both relative and absolute URLs
- Consistent handling across pagination scenarios

### Character Escaping

According to the xRegistry specification, only specific characters need escaping in filter values:

- **Asterisk (`*`)**: Escaped as `\*` (wildcard character)
- **Backslash (`\`)**: Escaped as `\\` (escape character)

Other characters like `()[]{}+?^$|.` are NOT escaped in filter values, as they don't have special meaning in the xRegistry filter context.

## Usage Examples

### Basic Name Search
```typescript
const filter = searchService.generateNameFilter('myapi');
// Result: "name=myapi*"
```

### Custom Attribute Search
```typescript
const filter = searchService.generateAttributeFilter('description', 'cool', '=', true);
// Result: "description=*cool*"
```

### Complex Filter Combination
```typescript
const filters = [
  searchService.generateNameFilter('myendpoint'),
  searchService.generateAttributeFilter('description', 'cool', '=', true)
];
const combinedFilter = searchService.combineFiltersAnd(filters);
// Result: "name=myendpoint*,description=*cool*"
```

### Version Filtering
```typescript
const filter = searchService.generateAttributeFilter('versionid', '1.0');
// Result: "versionid=1.0"
```

## xRegistry Specification Compliance

This implementation follows the xRegistry specification for filter expressions:

### Filter Format
- Basic format: `?filter=<EXPRESSION>[,<EXPRESSION>]`
- Multiple expressions within one filter parameter are combined with AND logic
- Multiple filter parameters are combined with OR logic

### Expression Format
- `[<PATH>.]<ATTRIBUTE>` - Check for attribute existence
- `[<PATH>.]<ATTRIBUTE>=<VALUE>` - Exact match
- `[<PATH>.]<ATTRIBUTE>=*<VALUE>*` - Contains match (wildcards)
- `[<PATH>.]<ATTRIBUTE>!=<VALUE>` - Not equal
- `[<PATH>.]<ATTRIBUTE><VALUE>` and other comparison operators

### String Comparisons
- Case-insensitive matching
- Wildcard support with `*` character
- Proper escaping of literal asterisks and backslashes

## Client-Side Filtering

In addition to server-side filtering, the application maintains client-side filtering capabilities:

- `filterItems()` method provides local filtering for cached results
- Uses case-insensitive substring matching
- Falls back to ID when name is not available

## Testing

Comprehensive unit tests are available in `src/app/services/search.service.spec.ts` covering:

- Basic filter generation
- Character escaping scenarios
- Filter combination logic
- Client-side filtering behavior
- xRegistry specification compliance examples

Run tests with:
```bash
npm test -- --testPathPattern="search.service.spec.ts" --watchAll=false
```

## Future Enhancements

The implementation is designed to be extensible for future xRegistry features:

1. **Nested Attribute Filtering**: Support for complex paths like `labels.stage=dev`
2. **Multiple Filter Parameters**: OR logic between separate filter parameters
3. **Advanced Operators**: Additional comparison operators as needed
4. **Path-based Filtering**: Support for filtering across nested resource structures 
