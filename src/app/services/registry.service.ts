import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { Group, Resource, ResourceDocument } from '../models/registry.model';
import { ModelService } from './model.service';
import { ConfigService } from './config.service';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class RegistryService {
  private isBrowser: boolean;
  private currentApiUrl: string;

  constructor(
    private http: HttpClient,
    private modelService: ModelService,
    private configService: ConfigService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    // Initialize with current value
    this.currentApiUrl = this.configService.getApiBaseUrl();

    // Subscribe to API URL changes
    this.configService.apiBaseUrl$.subscribe((newUrl) => {
      this.currentApiUrl = newUrl;
      console.info('RegistryService: API URL updated to:', newUrl);
    });
  }

  private getApiEndpoints(): string[] {
    const config = this.configService.getConfig();
    return config?.apiEndpoints || [];
  }

  listGroups(groupType: string): Observable<Group[]> {
    const apis = this.getApiEndpoints();
    if (apis.length === 0) return of([]);
    const requests = apis.map(api =>
      this.http.get<Group[]>(`${api}/${groupType}`).pipe(
        map(groups => (groups || []).map(g => ({ ...g, origin: api }))),
        catchError(err => {
          console.error('Failed to list groups from', api, err);
          return of([]);
        })
      )
    );
    return forkJoin(requests).pipe(
      map(results => {
        // Merge: higher-ranked API shadows lower for same group id
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
      })
    );
  }

  listResources(
    groupType: string,
    groupId: string,
    resourceType: string
  ): Observable<ResourceDocument[]> {
    const apis = this.getApiEndpoints();
    if (apis.length === 0) return of([]);
    const requests = apis.map(api =>
      this.http.get<ResourceDocument[]>(`${api}/${groupType}/${groupId}/${resourceType}`).pipe(
        map(resources => (resources || []).map(r => ({ ...r, origin: api }))),
        catchError(err => {
          console.error('Failed to list resources from', api, err);
          return of([]);
        })
      )
    );
    return forkJoin(requests).pipe(
      map(results => {
        // Merge: higher-ranked API shadows lower for same resource id
        const seen = new Set<string>();
        const merged: ResourceDocument[] = [];
        for (const resourceList of results) {
          for (const resource of resourceList) {
            if (!seen.has(resource.id)) {
              merged.push(resource);
              seen.add(resource.id);
            }
          }
        }
        return merged;
      })
    );
  }

  getGroup(groupType: string, groupId: string): Observable<Group> {
    // Find the first API that returns the group
    const apis = this.getApiEndpoints();
    if (apis.length === 0) return of(null as any);
    const requests = apis.map(api =>
      this.http.get<Group>(`${api}/${groupType}/${groupId}`).pipe(
        map(g => g ? { ...g, origin: api } : null),
        catchError(() => of(null))
      )
    );
    return forkJoin(requests).pipe(
      map(results => results.find(g => !!g) as Group)
    );
  }

  getResource(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string
  ): Observable<ResourceDocument> {
    // Find the first API that returns the resource
    const apis = this.getApiEndpoints();
    if (apis.length === 0) return of(null as any);
    const requests = apis.map(api =>
      this.http.get<ResourceDocument>(`${api}/${groupType}/${groupId}/${resourceType}/${resourceId}`).pipe(
        map(r => r ? { ...r, origin: api } : null),
        catchError(() => of(null))
      )
    );
    return forkJoin(requests).pipe(
      map(results => results.find(r => !!r) as ResourceDocument)
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
    const apis = origin ? [origin] : this.getApiEndpoints();
    if (apis.length === 0) return of(null as any);
    const requests = apis.map(api =>
      this.http.get<ResourceDocument>(`${api}/${groupType}/${groupId}/${resourceType}/${resourceId}/versions/${versionId}`).pipe(
        map(v => v ? { ...v, origin: api } : null),
        catchError(() => of(null))
      )
    );
    return forkJoin(requests).pipe(
      map(results => results.find(v => !!v) as ResourceDocument)
    );
  }

  getResourceDetail(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    hasDocument: boolean,
    origin?: string // use origin if provided
  ): Observable<ResourceDocument> {
    const apis = origin ? [origin] : this.getApiEndpoints();
    if (apis.length === 0) return of(null as any);
    const requests = apis.map(api =>
      this.http.get<ResourceDocument>(`${api}/${groupType}/${groupId}/${resourceType}/${resourceId}`).pipe(
        map(r => r ? { ...r, origin: api } : null),
        catchError(() => of(null))
      )
    );
    return forkJoin(requests).pipe(
      map(results => results.find(r => !!r) as ResourceDocument)
    );
  }

  getResourceVersions(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    origin?: string // use origin if provided
  ): Observable<ResourceDocument[]> {
    const apis = origin ? [origin] : this.getApiEndpoints();
    if (apis.length === 0) return of([]);
    const requests = apis.map(api =>
      this.http.get<ResourceDocument[]>(`${api}/${groupType}/${groupId}/${resourceType}/${resourceId}/versions`).pipe(
        map(versions => (versions || []).map(v => ({ ...v, origin: api }))),
        catchError(() => of([]))
      )
    );
    return forkJoin(requests).pipe(
      map(results => {
        // Merge: higher-ranked API shadows lower for same version id
        const seen = new Set<string>();
        const merged: ResourceDocument[] = [];
        for (const versionList of results) {
          for (const version of versionList) {
            const versionKey = version.versionId ?? (version.id ?? JSON.stringify(version));
            if (!seen.has(versionKey)) {
              merged.push(version);
              seen.add(versionKey);
            }
          }
        }
        return merged;
      })
    );
  }

  fetchDocument(url: string): Observable<string> {
    // In SSR environment, return empty observable to avoid HTTP requests
    if (!this.isBrowser) {
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
   */
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
      console.log(`Using singular name for ${resourceType}: ${singularName}`);

      // Check if we have any document-related fields
      const hasSpecificDocument = !!(
        response[singularName] ||
        response[`${singularName}url`] ||
        response[`${singularName}base64`]
      );

      if (hasSpecificDocument) {
        // If the document is in a specific field, standardize to our common field names
        if (response[singularName]) {
          result['resource'] = response[singularName];
        } else if (response[`${singularName}url`]) {
          result['resourceUrl'] = response[`${singularName}url`];
        } else if (response[`${singularName}base64`]) {
          result['resourceBase64'] = response[`${singularName}base64`];
        }

        console.log(
          `Document field found for ${resourceType}: ${hasSpecificDocument}, singular name: ${singularName}`
        );
      }
    }

    return result as ResourceDocument;
  }

  /**
   * Loads the default version for a resource
   * This is useful since a resource's content is essentially the content of its default version
   */
  getResourceDefaultVersion(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    hasDocument: boolean
  ): Observable<ResourceDocument> {
    // First get the resource to find the default version ID
    return this.getResource(groupType, groupId, resourceType, resourceId).pipe(
      switchMap((resource) => {
        if (resource['defaultversionid']) {
          // If there's a default version, fetch its details including document if requested
          return this.getVersionDetail(
            groupType,
            groupId,
            resourceType,
            resourceId,
            resource['defaultversionid'],
            hasDocument,
            resource.origin // use origin for nested fetch
          );
        } else if (resource['versionscount'] && resource['versionscount'] > 0) {
          // If there are versions but no default specified, fetch the versions list
          // and use the first one
          return this.getResourceVersions(
            groupType,
            groupId,
            resourceType,
            resourceId,
            resource.origin // use origin for nested fetch
          ).pipe(
            switchMap((versions) => {
              if (versions && versions.length > 0) {
                // Assume first version is default if not specified
                const firstVersion = versions[0];
                const versionId = firstVersion['versionid'] || firstVersion.id;

                return this.getVersionDetail(
                  groupType,
                  groupId,
                  resourceType,
                  resourceId,
                  versionId,
                  hasDocument,
                  resource.origin // use origin for nested fetch
                );
              } else {
                // No versions found, return the resource itself
                return of(resource);
              }
            })
          );
        } else {
          // No versions available, return the resource itself
          return of(resource);
        }
      })
    );
  }

  resolveDocument(
    url: string,
    response: any,
    resourceType: string
  ): ResourceDocument {
    // In SSR environment, return response synchronously without HTTP requests
    if (!this.isBrowser) {
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
}
