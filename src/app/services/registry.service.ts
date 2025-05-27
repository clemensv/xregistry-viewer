import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
// Removed PaginationInfo import as pagination now uses LinkSet and Page<T>
import { Observable, of, throwError, forkJoin, from, lastValueFrom } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { Group, Resource, ResourceDocument } from '../models/registry.model';
import { ModelService } from './model.service';
import { ConfigService } from './config.service';
import { DebugService } from './debug.service';
import { isPlatformBrowser } from '@angular/common';
import { LRUCache } from '../utils/lru-cache';
// Removed duplicate import of HttpResponse

/**
 * Type to represent the key structure for API endpoint caching
 */
type ResourceKey = {
  groupType: string;
  groupId: string;
  resourceType: string;
  resourceId?: string;
};

// Define a Page<T> structure for paginated results
export interface Page<T> {
  items: T;
  links: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
}

@Injectable({
  providedIn: 'root',
})
export class RegistryService {
  private servedFromServer: boolean;

  // LRU cache for successful API endpoints
  private endpointCache = new LRUCache<string, string>(1000);

  // Cache for document resources to avoid repeated fetches
  private resourceCache = new LRUCache<string, ResourceDocument>(100);

  constructor(
    private http: HttpClient,
    private modelService: ModelService,
    private configService: ConfigService,
    private debug: DebugService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Compute the base URL for the app (from config or fallback to '/')
    const configBaseUrl = (this.configService.getConfig()?.baseUrl || '/').replace(/\/$/, '');
    function proxyUrl(path: string) {
      return `${configBaseUrl}/proxy${path}`;
    }
    // Detect if running in a server context by checking for /proxy API
    if (isPlatformBrowser(this.platformId)) {
      // Browser: check if /proxy endpoint is available (relative to baseUrl)
      // Use synchronous XHR to ensure completion before constructor exits
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('OPTIONS', proxyUrl(''), false); // false = synchronous
        xhr.send();
        this.servedFromServer = xhr.status == 200;
      } catch {
        this.servedFromServer = false;
      }
    } else {
      // Server-side: assume /proxy is available
      this.servedFromServer = true;
    }
  }
  /**
   * Gets the API endpoints from configuration
   */
  private getApiEndpoints(): string[] {
    const config = this.configService.getConfig();
    return config?.apiEndpoints || [];
  }

  /**
   * Generates a cache key for the resource
   */
  private getCacheKey(resourceKey: ResourceKey): string {
    const { groupType, groupId, resourceType, resourceId } = resourceKey;
    return `${groupType}|${groupId}|${resourceType}${resourceId ? '|' + resourceId : ''}`;
  }

  /**
   * Constructs the API URL based on the resource path and whether we're using a proxy
   */
  private getApiUrl(api: string, path: string, filter?: string): string {
    let url = `${api}${path}`;

    // Add filter parameter if provided
    if (filter) {
      const separator = path.includes('?') ? '&' : '?';
      url += `${separator}filter=${encodeURIComponent(filter)}`;
    }

    // Always return direct URL for now since proxy configuration is not working
    return url;
  }

  /**
   * List resources using RFC5988 relation-based navigation
   * @param groupType the group type
   * @param groupId the group id
   * @param resourceType the resource type
   * @param pageRel optional Link rel URL or path (first, prev, next, last or empty)
   * @param filter optional filter string to apply to the query
   */
  listResources(
    groupType: string,
    groupId: string,
    resourceType: string,
    pageRel: string = '',
    filter?: string
  ): Observable<Page<ResourceDocument[]>> {
    const pagePath = pageRel || `/${groupType}/${groupId}/${resourceType}`;
    return from(this.listResourcesAsync(groupType, groupId, resourceType, pagePath, filter));
  }

  /**
   * Async implementation of listResources with relation-based URL
   */
  private async listResourcesAsync(
    groupType: string,
    groupId: string,
    resourceType: string,
    pagePath: string,
    filter?: string
  ): Promise<Page<ResourceDocument[]>> {
    const model = await lastValueFrom(this.modelService.getRegistryModel());
    const apis = this.modelService.getApiEndpointsForGroupType(groupType);
    if (apis.length === 0) {
      return { items: [], links: {} };
    }

    // Try each API endpoint until we find one that works
    for (const api of apis) {
      try {
        this.debug.log(`Processing API: ${api}, pagePath: "${pagePath}", starts with http: ${pagePath.startsWith('http')}`);
        const url = pagePath.startsWith('http') ? pagePath : this.getApiUrl(api, pagePath, filter);

        this.debug.log(`Requesting resources from: ${url}`);
        const response = await lastValueFrom(
          this.http.get<{ [key: string]: any }>(url, { observe: 'response' as const })
        );
        const data = response.body || {};

        // Parse Link header into links and metadata
        const links: any = {};
        let totalCount: number | undefined;
        let pageSize: number | undefined;
        const linkHeader = response.headers.get('Link') || '';

        if (linkHeader) {
          this.debug.log(`Parsing Link header: ${linkHeader}`);
          // Split by comma and process each part
          linkHeader.split(',').forEach((part, index) => {
            const trimmedPart = part.trim();
            this.debug.log(`  Part ${index}: "${trimmedPart}"`);

            // Format: <url>; rel="relation" (standard RFC 5988)
            const linkMatch = trimmedPart.match(/<([^>]+)>;\s*rel="?([a-zA-Z0-9_-]+)"?/i);
            if (linkMatch) {
              const url = linkMatch[1];
              const rel = linkMatch[2].toLowerCase(); // Normalize to lowercase
              links[rel] = url;
              this.debug.log(`    Matched link: ${rel} -> ${url}`);
              return; // Continue to next part
            }

            // Format: key="value" (standalone metadata fields like count="640302", per-page="50")
            const metaMatch = trimmedPart.match(/^([a-zA-Z0-9_-]+)="?([^"]+)"?$/i);
            if (metaMatch) {
              const key = metaMatch[1].toLowerCase();
              const value = metaMatch[2].replace(/"/g, '');

              // Extract count and per-page information
              if (key === 'count') {
                totalCount = parseInt(value, 10);
                this.debug.log(`    Found total count: ${totalCount}`);
              } else if (key === 'per-page') {
                pageSize = parseInt(value, 10);
                this.debug.log(`    Found page size: ${pageSize}`);
              }

              // Store metadata with the same format as links for backward compatibility
              links[key] = value;
              this.debug.log(`    Matched metadata: ${key} = ${value}`);
              return; // Continue to next part
            }

            this.debug.warn(`    Could not parse Link header part: "${trimmedPart}"`);
          });

          this.debug.log(`Final parsed links object:`, links);
        }

        // Map entries to ResourceDocument[]
        const resMeta = model.groups[groupType]?.resources?.[resourceType] || { singular: resourceType, attributes: {} };
        const attrs = resMeta.attributes || {};
        this.debug.log('Original data entries:', data);

        const items: ResourceDocument[] = Object.values(data).map((entry: any) => {
          const idKey = resMeta.singular + 'id';

          // First, clone the entry to preserve all original fields
          const doc: any = { ...entry };

          // Then override with the properly cased and mapped fields
          doc.id = entry[idKey] || entry.id || entry.name; // Fallback to name if id is missing
          doc.name = entry.name || entry[idKey] || entry.id; // Fallback to id if name is missing
          doc.description = entry.description;

          // Explicitly map docs to resourceUrl for the resource-row component
          if (entry.docs) {
            doc.resourceUrl = entry.docs;
            doc.docs = entry.docs; // Make sure both are set
          }

          // Ensure proper case for timestamp fields
          doc.createdAt = entry.createdat || entry.createdAt;
          doc.modifiedAt = entry.modifiedat || entry.modifiedAt;
          doc.origin = api;

          // Add attributes from the registry model
          Object.keys(attrs).forEach(key => {
            if (!['id', 'name', idKey].includes(key) && entry[key] != null) {
              doc[key] = entry[key];
            }
          });

          // Log the mapped document for debugging
          this.debug.log('Mapped resource:', doc);

          return doc as ResourceDocument;
        });

        // Calculate current page if possible
        let currentPage: number | undefined;
        if (pageSize && links.next) {
          try {
            const nextUrl = new URL(links.next);
            const nextOffset = parseInt(nextUrl.searchParams.get('offset') || '0', 10);
            currentPage = Math.floor(nextOffset / pageSize);
          } catch (e) {
            this.debug.warn('Could not parse current page from next link:', e);
          }
        }

        this.debug.log(`Returning page with ${items.length} items, totalCount: ${totalCount}, pageSize: ${pageSize}, currentPage: ${currentPage}`);
        return { items, links, totalCount, pageSize, currentPage };
      } catch (err) {
        this.debug.error(`Failed to list resources from ${api}:`, err);
        continue;
      }
    }

    // If all APIs failed, return empty result
    return { items: [], links: {}, totalCount: 0 };
  }

  getGroup(groupType: string, groupId: string): Observable<Group> {
    return from(this.getGroupAsync(groupType, groupId));
  }

  /**
   * Async implementation of getGroup
   */
  private async getGroupAsync(groupType: string, groupId: string): Promise<Group> {
    // Check cache for successful endpoint
    const cacheKey = this.getCacheKey({
      groupType,
      groupId,
      resourceType: '*'
    });
    const cachedApi = this.endpointCache.get(cacheKey);    // Get all APIs to try
    const apis = this.modelService.getApiEndpointsForGroupType(groupType);
    if (apis.length === 0) return null as any;

    // If we have a cached API, try it first
    const apisToTry = cachedApi
      ? [cachedApi, ...apis.filter(a => a !== cachedApi)]
      : apis;

    // Try each API until we find one that works
    for (const api of apisToTry) {
      try {
        const url = this.getApiUrl(api, `/${groupType}/${groupId}`);
        const group = await lastValueFrom(
          this.http.get<Group>(url)
        );

        const result = { ...group, origin: api };

        // Cache successful endpoint
        this.endpointCache.set(cacheKey, api);

        return result;
      } catch (err) {
        continue;
      }
    }

    return null as any;
  }
  getResource(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string
  ): Observable<ResourceDocument> {
    return from(this.getResourceAsync(
      groupType,
      groupId,
      resourceType,
      resourceId
    ));
  }

  /**
   * Async implementation of getResource
   */
  private async getResourceAsync(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string
  ): Promise<ResourceDocument> {
    const model = await lastValueFrom(this.modelService.getRegistryModel());
    const resourceMeta = model.groups[groupType]?.resources?.[resourceType];

    if (!resourceMeta) {
      this.debug.error(
        `Resource type ${resourceType} not found in group type ${groupType}`
      );
      throw new Error(
        `Resource type ${resourceType} not found in group type ${groupType}`
      );
    }

    // Determine if this resource type has document support
    const hasDocument = resourceMeta.hasdocument === true;

    // Get resource details
    return this.getResourceDetailAsync(
      groupType,
      groupId,
      resourceType,
      resourceId,
      hasDocument
    );
  }
  getVersionDetail(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    versionId: string,
    hasDocument: boolean,
    origin?: string // use origin if provided
  ): Observable<ResourceDocument> {
    return from(this.getVersionDetailAsync(
      groupType,
      groupId,
      resourceType,
      resourceId,
      versionId,
      hasDocument,
      origin
    ));
  }

  /**
   * Async implementation of getVersionDetail
   */
  private async getVersionDetailAsync(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    versionId: string,
    hasDocument: boolean,
    origin?: string
  ): Promise<ResourceDocument> {
    // Check resource cache first
    const cacheKey = this.getCacheKey({
      groupType,
      groupId,
      resourceType,
      resourceId: `${resourceId}/versions/${versionId}`
    });

    const cachedResource = this.resourceCache.get(cacheKey);
    if (cachedResource) {
      return cachedResource;
    }

    // Get the resource details using common method
    const resource = await this.fetchResourceDetailsAsync({
      groupType,
      groupId,
      resourceType,
      resourceId,
      versionId,
      hasDocument,
      origin
    });

    // Cache the result
    if (resource) {
      this.resourceCache.set(cacheKey, resource);
    }

    return resource;
  }
  getResourceDetail(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    hasDocument: boolean,
    origin?: string // use origin if provided
  ): Observable<ResourceDocument> {
    return from(this.getResourceDetailAsync(
      groupType,
      groupId,
      resourceType,
      resourceId,
      hasDocument,
      origin
    ));
  }

  /**
   * Async implementation of getResourceDetail
   */
  private async getResourceDetailAsync(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    hasDocument: boolean,
    origin?: string
  ): Promise<ResourceDocument> {
    // Check resource cache first
    const cacheKey = this.getCacheKey({
      groupType,
      groupId,
      resourceType,
      resourceId
    });

    const cachedResource = this.resourceCache.get(cacheKey);
    if (cachedResource) {
      return cachedResource;
    }

    // Get the resource details using common method
    const resource = await this.fetchResourceDetailsAsync({
      groupType,
      groupId,
      resourceType,
      resourceId,
      hasDocument,
      origin
    });

    // Cache the result
    if (resource) {
      this.resourceCache.set(cacheKey, resource);
    }

    return resource;
  }
  /**
   * List resource version history using RFC5988 relation-based navigation
   * @param groupType the group type
   * @param groupId the group id
   * @param resourceType the resource type
   * @param resourceId the resource id
   * @param pageRel optional Link rel URL or path (first, prev, next, last or empty)
   * @param filter optional filter string to apply to the query
   */
  getResourceVersions(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    pageRel: string = '',
    filter?: string
  ): Observable<Page<ResourceDocument[]>> {
    const pagePath = pageRel || `/${groupType}/${groupId}/${resourceType}/${resourceId}/versions`;
    return from(
      this.listResourceVersionsAsync(
        groupType,
        groupId,
        resourceType,
        resourceId,
        pagePath,
        filter
      )
    );
  }
  private async listResourceVersionsAsync(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    pagePath: string,
    filter?: string
  ): Promise<Page<ResourceDocument[]>> {
    const model = await lastValueFrom(this.modelService.getRegistryModel());
    const apis = this.modelService.getApiEndpointsForGroupType(groupType);
    if (apis.length === 0) {
      return { items: [], links: {} };
    }

    // Try each API endpoint until we find one that works
    for (const api of apis) {
      try {
        const url = pagePath.startsWith('http') ? pagePath : this.getApiUrl(api, pagePath, filter);

        this.debug.log(`Requesting versions from: ${url}`);
        const response = await lastValueFrom(
          this.http.get<any>(url, { observe: 'response' as const })
        );
        const data = response.body || {};

        // Parse Link header into relations with improved regex
        const linkHeader = response.headers.get('Link') || '';
        this.debug.log(`Link header received for versions: ${linkHeader}`);

        const links: any = {};
        // Split by comma and process each part
        linkHeader.split(',').forEach(part => {
          const trimmedPart = part.trim();

          // Format: <url>; rel="relation" (standard RFC 5988)
          const linkMatch = trimmedPart.match(/<([^>]+)>;\s*rel="?([a-zA-Z0-9_-]+)"?/i);
          if (linkMatch) {
            const url = linkMatch[1];
            const rel = linkMatch[2].toLowerCase(); // Normalize to lowercase
            links[rel] = url;
            this.debug.log(`Found version link relation: ${rel} -> ${url}`);
            return; // Continue to next part
          }

          // Format: key="value" (metadata fields)
          const metaMatch = trimmedPart.match(/([a-zA-Z0-9_-]+)="?([^"]+)"?/i);
          if (metaMatch) {
            const key = metaMatch[1].toLowerCase();
            const value = metaMatch[2].replace(/"/g, '');
            // Store metadata with the same format as links
            links[key] = value;
            this.debug.log(`Found version metadata: ${key} -> ${value}`);
            return; // Continue to next part
          }
          // If we reach here, we couldn't parse this part
          this.debug.log(`Skipping version Link header part (not a link or metadata): ${trimmedPart}`);
        });
        // Map entries to ResourceDocument[]
        const resMeta = model.groups[groupType]?.resources?.[resourceType] || { singular: resourceType, attributes: {} };
        const attrs = resMeta.attributes || {};
        const items: ResourceDocument[] = Object.values(data).map((entry: any) => {
          const idKey = resMeta.singular + 'id';
          const doc: any = {
            id: entry[idKey] || entry.id,
            name: entry.name,
            createdAt: entry.createdat,
            modifiedAt: entry.modifiedat,
            origin: api,
            ...entry
          };
          Object.keys(attrs).forEach(key => {
            if (!['id', 'name', idKey].includes(key) && entry[key] != null) {
              doc[key] = entry[key];
            }
          });
          return doc as ResourceDocument;
        });
        return { items, links };
      } catch (err) {
        this.debug.error(`Failed to list resource versions from ${api}:`, err);
        continue;
      }
    }

    // If all APIs failed, return empty result
    return { items: [], links: {} };
  }

  fetchDocument(url: string): Observable<string> {
    // In SSR environment, return empty observable to avoid HTTP requests
    if (this.servedFromServer) {
      return of('');
    }

    return this.http.get(url, { responseType: 'text' }).pipe(
      catchError((error) => {
        this.debug.error(`Error fetching document from ${url}:`, error);
        return throwError(() => error);
      })
    );
  }
  /**
   * Gets the singular name for a resource type from the cached model
   * @param resourceType The resource type to get the singular name for
   * @returns The singular name for the resource type or a fallback if not found
   */
  private getSingularNameFromModel(resourceType: string): string {
    // Try to get the singular name from the cached model
    const model = (this.modelService as any).cachedModel;

    if (model && model.groups) {
      // Look through all groups to find the resource type
      for (const groupTypeKey in model.groups) {
        const groupType = model.groups[groupTypeKey];
        if (groupType.resources && groupType.resources[resourceType]) {
          return groupType.resources[resourceType].singular;
        }
      }
    }

    // Fallback: Use a reasonable guess if the model doesn't have it
    this.debug.warn(
      `Could not find singular name for ${resourceType} in cached model, using fallback`
    );
    return resourceType.endsWith('s')
      ? resourceType.slice(0, -1)
      : resourceType;
  }

  /**
   * Common method to process document fields from a response
   * @param response The API response object
   * @param resourceType The type of resource (used to determine the singular name)
   * @param hasDocument Whether to look for document fields
   * @returns Processed ResourceDocument with standardized document fields
   */  /**
   * Process API response to standardize resource objects
   */
  private processResourceResponse(
    entry: any,
    resMeta: any,
    api: string,
    hasDocument: boolean
  ): ResourceDocument {
    if (!entry) return null as any;

    const singularKey = resMeta.singular + 'id';
    const attrs = resMeta.attributes || {};

    const resource: any = {
      id: entry[singularKey] || entry.id,
      name: entry.name || entry.title || entry[singularKey] || entry.id,
      description: entry.description,
      createdAt: entry.createdat,
      modifiedAt: entry.modifiedat,
      origin: api
    };

    // Include version-related information
    if (entry.versionscount) resource.versionscount = entry.versionscount;
    if (entry.versionsurl) resource.versionsurl = entry.versionsurl;
    if (entry.meta?.defaultversionid) resource.defaultversionid = entry.meta.defaultversionid;

    // Include counts and URLs
    Object.keys(entry).forEach(key => {
      if ((key.endsWith('count') || key.endsWith('url')) && entry[key] != null) {
        resource[key] = entry[key];
      }
    });

    // Include metadata attributes
    if (entry.meta) {
      Object.keys(entry.meta).forEach(key => {
        if (!resource[key]) {
          resource[key] = entry.meta[key];
        }
      });
    }

    // Include other attributes from model metadata
    Object.keys(attrs).forEach(key => {
      if ([singularKey, 'id', 'name', 'description'].includes(key)) return;
      if (entry[key] != null) resource[key] = entry[key];
    });

    // Copy any remaining properties
    Object.keys(entry).forEach(key => {
      if (
        ![
          'id',
          'name',
          'description',
          'createdat',
          'modifiedat',
          'meta',
        ].includes(key) &&
        !resource[key]
      ) {
        resource[key] = entry[key];
      }
    });

    // Process document fields
    if (hasDocument) {
      return this.processDocumentFields(resource, resMeta.singular, hasDocument);
    }

    return resource as ResourceDocument;
  }

  private processDocumentFields(
    response: any,
    resourceType: string,
    hasDocument: boolean
  ): ResourceDocument {
    // Convert the response to ensure all properties are included
    const result: any = { ...response };

    // If hasDocument is true, look for document fields
    if (hasDocument) {
      // Get the singular name from the model directly
      const singularName = this.getSingularNameFromModel(resourceType);

      // Check if we have any document-related fields
      const hasSpecificDocument = !!(
        response[singularName] ||
        response[`${singularName}url`] ||
        response[`${singularName}base64`]
      );

      if (hasSpecificDocument) {
        // If the document is in a specific field, standardize to our common field names
        if (response[singularName]) {
          result.resource = response[singularName];
        } else if (response[`${singularName}url`]) {
          result.resourceUrl = response[`${singularName}url`];
        } else if (response[`${singularName}base64`]) {
          result.resourceBase64 = response[`${singularName}base64`];
        }
      }
    }

    return result as ResourceDocument;
  }

  /**
   * Loads the default version for a resource
   * This is useful since a resource's content is essentially the content of its default version
   */  getResourceDefaultVersion(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    hasDocument: boolean
  ): Observable<ResourceDocument> {
    return from(this.getResourceDefaultVersionAsync(
      groupType,
      groupId,
      resourceType,
      resourceId,
      hasDocument
    ));
  }

  /**
   * Async implementation of getResourceDefaultVersion
   */
  private async getResourceDefaultVersionAsync(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    hasDocument: boolean
  ): Promise<ResourceDocument> {
    // First get the resource to find the default version ID
    const resource = await lastValueFrom(
      this.getResource(groupType, groupId, resourceType, resourceId)
    );
      if (resource['defaultversionid']) {
      // If there's a default version, fetch its details
      return await this.getVersionDetailAsync(
        groupType,
        groupId,
        resourceType,
        resourceId,
        resource['defaultversionid'],
        hasDocument,
        resource.origin
      );
    } else if (resource['versionscount'] && resource['versionscount'] > 0) {
      // If there are versions but no default specified, fetch first page of versions
      const page = await this.listResourceVersionsAsync(
        groupType,
        groupId,
        resourceType,
        resourceId,
        '' // initial pageRel to use default versions path
      );
      const versions = page.items;
      if (versions.length > 0) {
        // Assume first version is default if not specified
        const firstVersion = versions[0];
        const versionId = firstVersion.versionId || firstVersion.id;
        return await this.getVersionDetailAsync(
          groupType,
          groupId,
          resourceType,
          resourceId,
          versionId,
          hasDocument,
          resource.origin
        );
      }
    }

    // No versions available, return the resource itself
    return resource;
  }

  resolveDocument(
    url: string,
    response: any,
    resourceType: string
  ): ResourceDocument {
    // In SSR environment, return response synchronously without HTTP requests
    if (this.servedFromServer) {
      return response as ResourceDocument;
    }

    try {
      const xhr = new XMLHttpRequest();
      // Open a synchronous GET request
      xhr.open('GET', url, false);
      xhr.send(null);

      if (xhr.status === 200) {
        let parsed: any;

        try {
          // Try to parse the response as JSON
          parsed = JSON.parse(xhr.responseText);
        } catch (parseError) {
          // If it is not JSON, set resourceUrl to the URL and return
          response['resourceUrl'] = url;
          return response as ResourceDocument;
        }

        // Get the singular name from the model instead of iterating the JSON keys
        const singularName = this.getSingularNameFromModel(resourceType);

        if (parsed.hasOwnProperty(singularName + 'id')) {
          // Map specific document fields using the singular name from the model
          if (parsed.hasOwnProperty(singularName)) {
            response['resource'] = parsed[singularName];
          }
          if (parsed.hasOwnProperty(singularName + 'url')) {
            response['resourceUrl'] = parsed[singularName + 'url'];
          }
          if (parsed.hasOwnProperty(singularName + 'base64')) {
            response['resourceBase64'] = parsed[singularName + 'base64'];
          }
        } else {
          // If JSON but does not have the specific singular id field, set 'resource' to the parsed result
          response['resource'] = parsed;
        }
      } else {
        this.debug.error(`Error fetching document from ${url}: Status ${xhr.status}`);
        response['resourceUrl'] = url;
      }
    } catch (error) {
      this.debug.error(`Error fetching document from ${url}:`, error);
      response['resourceUrl'] = url;
    }

    return response as ResourceDocument;
  }

  /**
   * Async version of resolveDocument
   */
  private async resolveDocumentAsync(
    url: string,
    response: any,
    resourceType: string
  ): Promise<ResourceDocument> {
    // In SSR environment, return response synchronously without HTTP requests
    if (this.servedFromServer) {
      return response as ResourceDocument;
    }

    try {
      // Use fetch instead of XMLHttpRequest for better async support
      const result = await fetch(url);

      if (result.ok) {
        let parsed: any;

        try {
          // Try to parse the response as JSON
          parsed = await result.json();
        } catch (parseError) {
          // If it is not JSON, set resourceUrl to the URL and return
          response.resourceUrl = url;
          return response as ResourceDocument;
        }

        // Get the singular name from the model
        const singularName = this.getSingularNameFromModel(resourceType);

        if (parsed.hasOwnProperty(singularName + 'id')) {
          // Map specific document fields using the singular name
          if (parsed.hasOwnProperty(singularName)) {
            response.resource = parsed[singularName];
          }
          if (parsed.hasOwnProperty(singularName + 'url')) {
            response.resourceUrl = parsed[singularName + 'url'];
          }
          if (parsed.hasOwnProperty(singularName + 'base64')) {
            response.resourceBase64 = parsed[singularName + 'base64'];
          }
        } else {
          // If JSON but does not have the specific singular id field
          response.resource = parsed;
        }
      } else {
        this.debug.error(`Error fetching document from ${url}: Status ${result.status}`);
        response.resourceUrl = url;
      }
    } catch (error) {
      this.debug.error(`Error fetching document from ${url}:`, error);
      response.resourceUrl = url;
    }

    return response as ResourceDocument;
  }

  /**
   * Shared method to fetch resource details for both resources and versions
   */
  private async fetchResourceDetailsAsync({
    groupType,
    groupId,
    resourceType,
    resourceId,
    versionId,
    hasDocument,
    origin
  }: {
    groupType: string;
    groupId: string;
    resourceType: string;
    resourceId: string;
    versionId?: string;
    hasDocument: boolean;
    origin?: string;
  }): Promise<ResourceDocument> {
    const model = await lastValueFrom(this.modelService.getRegistryModel());

    // Check if we have a cached successful endpoint for this resource
    const endpointCacheKey = this.getCacheKey({
      groupType,
      groupId,
      resourceType,
      resourceId: versionId ? `${resourceId}/versions/${versionId}` : resourceId
    });
    const cachedApi = this.endpointCache.get(endpointCacheKey);    // Get APIs to try (use origin if provided, otherwise all endpoints)
    const apis = origin ? [origin] : this.modelService.getApiEndpointsForGroupType(groupType);
    if (apis.length === 0) return null as any;

    // If we have a cached API, try it first (unless origin is specified)
    const apisToTry = !origin && cachedApi
      ? [cachedApi, ...apis.filter(a => a !== cachedApi)]
      : apis;

    const resMeta = model.groups[groupType]?.resources?.[resourceType] ||
      { singular: resourceType, attributes: {}, hasdocument: false };

    // Try each API endpoint until we get a successful response
    for (const api of apisToTry) {
      try {
        // Construct base path depending on whether this is for a version or resource
        let basePath = `/${groupType}/${groupId}/${resourceType}/${resourceId}`;
        if (versionId) {
          basePath += `/versions/${versionId}`;
        }

        // Construct URLs for regular and $details endpoints
        const regularUrl = this.getApiUrl(api, basePath);
        const detailsUrl = this.getApiUrl(api, `${basePath}/$details`);

        // Choose primary URL based on document support
        const primaryUrl = hasDocument ? detailsUrl : regularUrl;

        // Try the primary URL first
        try {
          const entry = await lastValueFrom(this.http.get<any>(primaryUrl));

          // Process the response
          const resource = this.processResourceResponse(entry, resMeta, api, hasDocument);

          // Cache the successful API endpoint
          this.endpointCache.set(endpointCacheKey, api);

          // Resolve document if needed
          if (hasDocument &&
              !resource.resource &&
              !resource.resourceUrl &&
              !resource.resourceBase64) {
            await this.resolveDocumentAsync(regularUrl, resource, resourceType);
          }

          return resource;
        } catch (error) {          // If $details URL failed with 404, try the regular URL
          if (hasDocument && error && typeof error === 'object' && 'status' in error && error.status === 404) {
            const entry = await lastValueFrom(this.http.get<any>(regularUrl));

            // Process the response
            const resource = this.processResourceResponse(entry, resMeta, api, hasDocument);

            // Cache the successful API endpoint
            this.endpointCache.set(endpointCacheKey, api);

            // Resolve document if needed
            if (hasDocument &&
                !resource.resource &&
                !resource.resourceUrl &&
                !resource.resourceBase64) {
              await this.resolveDocumentAsync(regularUrl, resource, resourceType);
            }

            return resource;
          }

          // Re-throw for other errors
          throw error;
        }
      } catch (err) {
        this.debug.error(`Failed to get resource details from ${api}:`, err);
        continue;
      }
    }

    // If we reach this point, all APIs failed
    return null as any;
  }

  /**
   * Parse RFC5988 Link header into pagination info
   */
  private parseLinkHeader(header: string, pageSize: number) {
    let totalCount: number | undefined;
    let totalPages = 1;
    let currentPage = 1;
    const links = header.split(',').map(part => part.trim());
    const rels: any = {};
    links.forEach(link => {
      const match = link.match(/<([^>]+)>;\s*rel="?(\w+)"?(?:;count=(\d+))?/);
      if (match) {
        const url = match[1];
        const rel = match[2];
        const count = match[3] ? parseInt(match[3], 10) : undefined;
        rels[rel] = { url, count };
        if (count !== undefined) {
          totalCount = count;
        }
      }
    });
    if (totalCount !== undefined) {
      totalPages = Math.ceil(totalCount / pageSize);
    } else if (rels['last'] && rels['last'].url) {
      const params = new URL(rels['last'].url).searchParams;
      const offset = parseInt(params.get('offset') || '0', 10);
      totalPages = Math.floor(offset / pageSize) + 1;
    }
    if (rels['next']) {
      const params = new URL(rels['next'].url).searchParams;
      const nextOffset = parseInt(params.get('offset') || '0', 10);
      currentPage = Math.floor(nextOffset / pageSize);
    } else if (rels['prev']) {
      const params = new URL(rels['prev'].url).searchParams;
      const prevOffset = parseInt(params.get('offset') || '0', 10);
      currentPage = Math.floor(prevOffset / pageSize) + 2;
    }
    return { currentPage, totalPages, pageSize, totalCount };
  }

  /**
   * List groups using RFC5988 relation-based navigation (first, prev, next, last).
   * @param groupType the type of group to list
   * @param pageRel URL or relation name (e.g. '', 'first', 'next', full path)
   * @param filter optional filter string to apply to the query
   */
  listGroups(groupType: string, pageRel: string = '', filter?: string): Observable<Page<Group[]>> {
    const pagePath = pageRel || `/${groupType}`;
    return from(this.listGroupsAsync(groupType, pagePath, filter));
  }

  /**
   * Async implementation of listGroups with relation-based URL
   */
  private async listGroupsAsync(groupType: string, pagePath: string, filter?: string): Promise<Page<Group[]>> {
    const model = await lastValueFrom(this.modelService.getRegistryModel());
    const apis = this.modelService.getApiEndpointsForGroupType(groupType);
    if (apis.length === 0) {
      return { items: [], links: {} };
    }

    // For absolute URLs (pagination), use the original single-API logic
    if (pagePath.startsWith('http')) {
      // Extract the API base from the absolute URL to determine which API to use
      const targetApi = apis.find(api => pagePath.startsWith(api)) || apis[0];
      try {
        const response = await lastValueFrom(
          this.http.get<{ [id: string]: any }>(pagePath, { observe: 'response' as const })
        );
        const data = response.body || {};

        // Parse RFC5988 Link header
        const linkHeader = response.headers.get('Link') || '';
        this.debug.log(`Link header received for groups: ${linkHeader}`);

        const links: any = {};
        linkHeader.split(',').forEach(part => {
          const match = part.trim().match(/<([^>]+)>;\s*rel="?([a-zA-Z0-9_-]+)"?/i);
          if (match) {
            links[match[2]] = match[1];
            this.debug.log(`Found link relation: ${match[2]} -> ${match[1]}`);
          } else {
            this.debug.warn(`Failed to parse link header part: ${part}`);
          }
        });

        // Map entries to Group[]
        const meta = model.groups[groupType] || { singular: groupType, attributes: {} };
        const groups: Group[] = Object.entries(data).map(([key, entry]: [string, any]) => {
          const idKey = meta.singular + 'id';
          return {
            id: entry[idKey] || entry.id || key,
            name: entry.name,
            createdAt: entry.createdat,
            modifiedAt: entry.modifiedat,
            origin: targetApi,
            ...entry
          } as Group;
        });
        return { items: groups, links };
      } catch (err) {
        this.debug.error(`Failed to list groups from absolute URL ${pagePath}:`, err);
        return { items: [], links: {} };
      }
    }

    // For relative URLs (initial load), query ALL APIs in parallel and merge results
    this.debug.log(`Querying ${apis.length} APIs for group type '${groupType}': ${apis.join(', ')}`);

    const apiRequests = apis.map(async (api) => {
      try {
        const url = this.getApiUrl(api, pagePath, filter);
        this.debug.log(`Requesting groups from: ${url}`);

        const response = await lastValueFrom(
          this.http.get<{ [id: string]: any }>(url, { observe: 'response' as const })
        );
        const data = response.body || {};

        // Map entries to Group[] with origin tracking
        const meta = model.groups[groupType] || { singular: groupType, attributes: {} };
        const groups: Group[] = Object.entries(data).map(([key, entry]: [string, any]) => {
          const idKey = meta.singular + 'id';
          return {
            id: entry[idKey] || entry.id || key,
            name: entry.name,
            createdAt: entry.createdat,
            modifiedAt: entry.modifiedat,
            origin: api,
            ...entry
          } as Group;
        });

        this.debug.log(`Successfully loaded ${groups.length} groups from ${api}`);
        return { api, groups, success: true };
      } catch (err) {
        this.debug.error(`Failed to list groups from ${api}:`, err);
        return { api, groups: [], success: false };
      }
    });

    // Wait for all API requests to complete
    const results = await Promise.all(apiRequests);

    // Merge all successful results
    const allGroups: Group[] = [];
    const successfulApis: string[] = [];

    results.forEach(result => {
      if (result.success && result.groups.length > 0) {
        allGroups.push(...result.groups);
        successfulApis.push(result.api);
      }
    });

    this.debug.log(`Merged ${allGroups.length} total groups from ${successfulApis.length} successful APIs: ${successfulApis.join(', ')}`);

    // For pagination links, we'll use the first successful API's pattern
    // In a multi-API scenario, pagination becomes complex as each API has its own pagination
    // For now, we disable pagination when merging multiple APIs
    const links: any = {};

    return { items: allGroups, links };
  }

}
