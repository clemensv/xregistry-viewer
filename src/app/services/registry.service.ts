import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, forkJoin, from, lastValueFrom } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { Group, Resource, ResourceDocument } from '../models/registry.model';
import { ModelService } from './model.service';
import { ConfigService } from './config.service';
import { isPlatformBrowser } from '@angular/common';
import { LRUCache } from '../utils/lru-cache';

/**
 * Type to represent the key structure for API endpoint caching
 */
type ResourceKey = {
  groupType: string;
  groupId: string;
  resourceType: string;
  resourceId?: string;
};

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
  private getApiUrl(api: string, path: string): string {
    if (this.servedFromServer) {
      return `/proxy?target=${encodeURIComponent(api + path)}`;
    }
    return `${api}${path}`;
  }
  listGroups(groupType: string): Observable<Group[]> {
    // Ensure models are loaded and track endpoints per model before requesting groups
    return from(this.listGroupsAsync(groupType));
  }

  /**
   * Async implementation of listGroups
   */
  private async listGroupsAsync(groupType: string): Promise<Group[]> {
    const model = await lastValueFrom(this.modelService.getRegistryModel());
    const apis = this.modelService.getApiEndpointsForGroupType(groupType);

    if (apis.length === 0) {
      return [] as Group[];
    }

    // Check if we have a cached successful endpoint for this group type
    const cacheKey = this.getCacheKey({ groupType, groupId: '*', resourceType: '*' });
    const cachedApi = this.endpointCache.get(cacheKey);

    // If we have a cached API, try it first
    const apisToTry = cachedApi
      ? [cachedApi, ...apis.filter(a => a !== cachedApi)]
      : apis;

    const results: Group[][] = [];

    for (const api of apisToTry) {
      try {
        const url = this.getApiUrl(api, `/${groupType}`);
        const groupMap = await lastValueFrom(
          this.http.get<{ [id: string]: any }>(url)
        );

        const groupMeta = model.groups[groupType] || { singular: groupType, attributes: {} };
        const attrs = groupMeta.attributes || {};

        // Map each entry to Group with standardized fields
        const groups = Object.values(groupMap).map((entry: any) => {
          const singularIdKey = groupMeta.singular + 'id';
          const group: any = {
            id: entry[singularIdKey] || entry.id,
            name: entry.name,
            createdAt: entry.createdat,
            modifiedAt: entry.modifiedat,
          };

          // include additional attributes
          Object.keys(attrs).forEach(key => {
            if ([singularIdKey, 'id', 'name'].includes(key)) return;
            if (entry[key] != null) {
              group[key] = entry[key];
            }
          });

          return { ...group, origin: api } as Group;
        });

        results.push(groups);

        // Cache successful API endpoint
        this.endpointCache.set(cacheKey, api);
        break;
      } catch (err) {
        console.error('Failed to list groups from', api, err);
        continue;
      }
    }

    // Merge results from all successful API calls
    const seen = new Set<string>();
    const merged: Group[] = [];
    for (const groupList of results) {
      for (const group of groupList) {
        if (!seen.has(group.id)) {
          merged.push(group);
          seen.add(group.id);
        }
      }
    }

    return merged;
  }
  // Standardize resource mapping similar to listGroups
  listResources(
    groupType: string,
    groupId: string,
    resourceType: string
  ): Observable<ResourceDocument[]> {
    return from(this.listResourcesAsync(groupType, groupId, resourceType));
  }

  /**
   * Async implementation of listResources
   */
  private async listResourcesAsync(
    groupType: string,
    groupId: string,
    resourceType: string
  ): Promise<ResourceDocument[]> {
    const model = await lastValueFrom(this.modelService.getRegistryModel());

    // Check if we have a cached successful endpoint for this resource
    const cacheKey = this.getCacheKey({
      groupType,
      groupId,
      resourceType
    });
    const cachedApi = this.endpointCache.get(cacheKey);

    // Get all potential APIs
    const apis = this.getApiEndpoints();
    if (apis.length === 0) return [] as ResourceDocument[];

    // If we have a cached API, try it first
    const apisToTry = cachedApi
      ? [cachedApi, ...apis.filter(a => a !== cachedApi)]
      : apis;

    const results: ResourceDocument[][] = [];

    for (const api of apisToTry) {
      try {
        const url = this.getApiUrl(
          api,
          `/${groupType}/${groupId}/${resourceType}`
        );

        const resMap = await lastValueFrom(
          this.http.get<{ [key: string]: any }>(url)
        );

        const resMeta = model.groups[groupType]?.resources?.[resourceType] ||
          { singular: resourceType, attributes: {} };
        const attrs = resMeta.attributes || {};

        const resources = Object.values(resMap).map((entry: any) => {
          const singularIdKey = resMeta.singular + 'id';
          const resource: any = {
            id: entry[singularIdKey] || entry.id,
            name: entry.name,
            createdAt: entry.createdat,
            modifiedAt: entry.modifiedat,
          };

          // include other attributes
          Object.keys(attrs).forEach(key => {
            if ([singularIdKey, 'id', 'name'].includes(key)) return;
            if (entry[key] != null) resource[key] = entry[key];
          });

          return { ...resource, origin: api } as ResourceDocument;
        });

        results.push(resources);

        // Cache successful API endpoint
        this.endpointCache.set(cacheKey, api);
        break;
      } catch (err) {
        console.error('Failed to list resources from', api, err);
        continue;
      }
    }

    // Merge results, prioritizing first API endpoint's results
    const seen = new Set<string>();
    const merged: ResourceDocument[] = [];
    for (const list of results) {
      for (const item of list) {
        if (!seen.has(item.id)) {
          merged.push(item);
          seen.add(item.id);
        }
      }
    }

    return merged;
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
    const cachedApi = this.endpointCache.get(cacheKey);

    // Get all APIs to try
    const apis = this.getApiEndpoints();
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
      console.error(
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
  getResourceVersions(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    origin?: string // use origin if provided
  ): Observable<ResourceDocument[]> {
    return from(this.getResourceVersionsAsync(
      groupType,
      groupId,
      resourceType,
      resourceId,
      origin
    ));
  }

  /**
   * Async implementation of getResourceVersions
   */
  private async getResourceVersionsAsync(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    origin?: string
  ): Promise<ResourceDocument[]> {
    // Check cache for successful endpoint
    const cacheKey = this.getCacheKey({
      groupType,
      groupId,
      resourceType,
      resourceId: `${resourceId}/versions`
    });
    const cachedApi = this.endpointCache.get(cacheKey);

    // Get all APIs to try
    const apis = origin ? [origin] : this.getApiEndpoints();
    if (apis.length === 0) return [];

    // If we have a cached API, try it first
    const apisToTry = !origin && cachedApi
      ? [cachedApi, ...apis.filter(a => a !== cachedApi)]
      : apis;

    const results: any[][] = [];

    // Try each API
    for (const api of apisToTry) {
      try {
        const url = this.getApiUrl(
          api,
          `/${groupType}/${groupId}/${resourceType}/${resourceId}/versions`
        );

        let response = await lastValueFrom(this.http.get<any>(url));

        // If the response isn't an array (could be an object with values), convert it
        if (!Array.isArray(response)) {
          response = Object.values(response);
        }

        results.push(response);

        // Cache successful API endpoint
        this.endpointCache.set(cacheKey, api);
        break;
      } catch (err) {
        console.error(`Failed to get versions from ${api}:`, err);
        continue;
      }
    }

    // Merge and standardize the results
    const seen = new Set<string>();
    const merged: ResourceDocument[] = [];
    for (const versions of results) {
      for (const v of versions) {
        // Use consistent version ID field
        const key = v.versionId || v.id;
        if (!seen.has(key)) {
          // Standardize version object to match ResourceDocument interface
          merged.push({
            ...v,
            versionId: v.versionId || v.id,
            id: v.id || v.versionId
          });
          seen.add(key);
        }
      }
    }

    return merged;
  }

  fetchDocument(url: string): Observable<string> {
    // In SSR environment, return empty observable to avoid HTTP requests
    if (this.servedFromServer) {
      return of('');
    }

    return this.http.get(url, { responseType: 'text' }).pipe(
      catchError((error) => {
        console.error(`Error fetching document from ${url}:`, error);
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
    console.warn(
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
      // If there are versions but no default specified, get the first one
      const versions = await this.getResourceVersionsAsync(
        groupType,
        groupId,
        resourceType,
        resourceId,
        resource.origin
      );

      if (versions && versions.length > 0) {
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
        console.error(`Error fetching document from ${url}: Status ${xhr.status}`);
        response['resourceUrl'] = url;
      }
    } catch (error) {
      console.error(`Error fetching document from ${url}:`, error);
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
        console.error(`Error fetching document from ${url}: Status ${result.status}`);
        response.resourceUrl = url;
      }
    } catch (error) {
      console.error(`Error fetching document from ${url}:`, error);
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
    const cachedApi = this.endpointCache.get(endpointCacheKey);

    // Get APIs to try (use origin if provided, otherwise all endpoints)
    const apis = origin ? [origin] : this.getApiEndpoints();
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
        console.error(`Failed to get resource details from ${api}:`, err);
        continue;
      }
    }

    // If we reach this point, all APIs failed
    return null as any;
  }
}
