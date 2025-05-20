import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
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

  listGroups(groupType: string): Observable<Group[]> {
    // In SSR environment, return empty array to avoid HTTP requests
    if (!this.isBrowser) {
      return of([]);
    }

    return this.modelService.getRegistryModel().pipe(
      switchMap((model) => {
        if (!model.groups[groupType]) {
          console.warn(`Group type '${groupType}' not found in registry model`);
          return of([]);
        }

        return this.http
          .get<{ [key: string]: any }>(`${this.currentApiUrl}/${groupType}`)
          .pipe(
            map((res) => {
              const groupMeta = model.groups[groupType];
              const attrs = groupMeta.attributes || {};
              return Object.values(res).map((entry: any) => {
                const group: any = {
                  id: entry[groupMeta['singular'] + 'id'] || entry.id,
                  name: entry.name,
                  createdAt: entry.createdat, // map createdat
                  modifiedAt: entry.modifiedat, // map modifiedat
                };
                // include all other metadata attributes
                Object.keys(attrs).forEach((key) => {
                  if (
                    [groupMeta['singular'] + 'id', 'id', 'name'].includes(key)
                  )
                    return;
                  if (entry[key] != null) {
                    group[key] = entry[key];
                  }
                });
                return group;
              });
            }),
            catchError((err) => {
              console.error(
                `Error loading groups for type '${groupType}':`,
                err
              );
              return of([]);
            })
          );
      })
    );
  }

  listResources(
    groupType: string,
    groupId: string,
    resourceType: string
  ): Observable<ResourceDocument[]> {
    return this.modelService.getRegistryModel().pipe(
      switchMap((model) => {
        const resMeta = model.groups[groupType].resources[resourceType];
        const attrs = resMeta.attributes || {};
        return this.http
          .get<{ [key: string]: any }>(
            `${this.currentApiUrl}/${groupType}/${groupId}/${resourceType}`
          )
          .pipe(
            map((res) =>
              Object.values(res).map((entry: any) => {
                const resource: any = {
                  id: entry[resMeta['singular'] + 'id'] || entry.id,
                  name: entry.name,
                  description: entry.description,
                  createdAt: entry.createdat, // map createdat to createdAt
                  modifiedAt: entry.modifiedat, // map modifiedat to modifiedAt
                };
                Object.keys(attrs).forEach((key) => {
                  if (entry[key] != null) {
                    resource[key] = entry[key];
                  }
                });
                return resource;
              })
            )
          );
      })
    );
  }

  getGroup(groupType: string, groupId: string): Observable<Group> {
    return this.modelService.getRegistryModel().pipe(
      switchMap((model) => {
        const groupMeta = model.groups[groupType];
        if (!groupMeta) {
          console.error(`Group type ${groupType} not found in registry model`);
          return throwError(
            () =>
              new Error(`Group type ${groupType} not found in registry model`)
          );
        }

        const attrs = groupMeta.attributes || {};
        const singularIdKey = `${groupMeta.singular}id`;

        return this.http
          .get<any>(`${this.currentApiUrl}/${groupType}/${groupId}`)
          .pipe(
            map((entry) => {
              const group: any = {
                id: entry[singularIdKey] || entry.id,
                name:
                  entry.name || entry.title || entry[singularIdKey] || entry.id,
                description: entry.description,
                createdAt: entry.createdat,
                modifiedAt: entry.modifiedat,
              };

              // Include all resource counts (which end with 'count')
              Object.keys(entry).forEach((key) => {
                if (key.endsWith('count')) {
                  group[key] = entry[key];
                }
              });

              // Include all resource URLs (which end with 'url')
              Object.keys(entry).forEach((key) => {
                if (key.endsWith('url')) {
                  group[key] = entry[key];
                }
              });

              // Include all other metadata attributes
              Object.keys(attrs).forEach((key) => {
                if ([singularIdKey, 'id', 'name', 'description'].includes(key))
                  return;
                if (entry[key] != null) {
                  group[key] = entry[key];
                }
              });

              return group as Group;
            }),
            catchError((error) => {
              console.error(
                `Error getting group ${groupId} of type ${groupType}:`,
                error
              );
              return throwError(() => error);
            })
          );
      })
    );
  }

  getResource(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string
  ): Observable<ResourceDocument> {
    return this.modelService.getRegistryModel().pipe(
      switchMap((model) => {
        const resourceMeta = model.groups[groupType]?.resources?.[resourceType];
        if (!resourceMeta) {
          console.error(
            `Resource type ${resourceType} not found in group type ${groupType}`
          );
          return throwError(
            () =>
              new Error(
                `Resource type ${resourceType} not found in group type ${groupType}`
              )
          );
        }

        const singularIdKey = `${resourceMeta.singular}id`;
        // Determine if this resource type has document support
        const hasDocument = resourceMeta.hasdocument === true;

        return this.http
          .get<any>(
            `${this.currentApiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}`
          )
          .pipe(
            map((entry) => {
              // First process basic resource properties
              let resource: any = {
                id: entry[singularIdKey] || entry.id,
                name:
                  entry.name || entry.title || entry[singularIdKey] || entry.id,
                description: entry.description,
                createdAt: entry.createdat,
                modifiedAt: entry.modifiedat,
                // Include version-related information that's critical for resource display
                versionscount: entry['versionscount'],
                versionsurl: entry['versionsurl'],
                defaultversionid: entry.meta?.['defaultversionid'],
              };

              // Include all metadata attributes
              if (entry.meta) {
                Object.keys(entry.meta).forEach((key) => {
                  if (!resource[key]) {
                    resource[key] = entry.meta[key];
                  }
                });
              }

              // Copy all other properties that aren't explicitly mapped
              Object.keys(entry).forEach((key) => {
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

              // Process document fields if this resource type supports documents
              if (hasDocument) {
                return this.processDocumentFields(
                  resource,
                  resourceType,
                  hasDocument
                );
              }

              return resource as ResourceDocument;
            }),
            catchError((error) => {
              console.error(
                `Error getting resource ${resourceId} of type ${resourceType}:`,
                error
              );
              return throwError(() => error);
            })
          );
      })
    );
  }
  /**
   * Fetches the details of a specific version of a resource
   * @param groupType The type of group (e.g., 'datapoints', 'events')
   * @param groupId The ID of the group
   * @param resourceType The type of resource (e.g., 'datapoint', 'event')
   * @param resourceId The ID of the resource
   * @param versionId The ID of the version to fetch
   * @param hasDocument Whether the resource type has document support
   * @returns An observable containing the version details
   */
  getVersionDetail(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    versionId: string,
    hasDocument: boolean
  ): Observable<ResourceDocument> {
    // Construct the URLs for both with and without $details
    const detailsUrl = `${this.currentApiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}/versions/${versionId}$details`;
    const regularUrl = `${this.currentApiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}/versions/${versionId}`;

    // Use the appropriate URL based on hasDocument
    const primaryUrl = hasDocument ? detailsUrl : regularUrl;

    console.log(`Fetching version detail from: ${primaryUrl}`);
    console.log(`hasDocument flag is: ${hasDocument}`);

    // Try the primary URL first, and if it fails with a 404, fallback to the regular URL
    return this.http.get<any>(primaryUrl).pipe(
      tap((response) => {
        console.log('API response received for version detail:', response);
      }),
      map((response) => {
        if (hasDocument && (!response['resource'] && !response['resourceUrl'] && !response['resourceBase64'])) {
          this.resolveDocument(regularUrl, response, resourceType);
        }
        return this.processDocumentFields(response, resourceType, hasDocument)
      }
      ),
      catchError((error) => {
        console.error(
          `Error fetching version detail from ${primaryUrl}:`,
          error
        );

        // If hasDocument is true and we get a 404, fall back to the regular URL
        if (hasDocument && error.status === 404) {
          console.warn(
            `$details URL returned 404, falling back to regular URL: ${regularUrl}`
          );

          return this.http.get<any>(regularUrl).pipe(
            tap((response) => {
              console.log('API response received from fallback URL:', response);
            }),
            map((response) =>
              this.processDocumentFields(response, resourceType, hasDocument)
            ),
            catchError((fallbackError) => {
              console.error(
                `Error fetching version detail from fallback URL ${regularUrl}:`,
                fallbackError
              );
              return throwError(() => fallbackError);
            })
          );
        }

        // Otherwise, propagate the error
        return throwError(() => error);
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

  /**
   * Fetches the details of a specific resource
   * @param groupType The type of group (e.g., 'datapoints', 'events')
   * @param groupId The ID of the group
   * @param resourceType The type of resource (e.g., 'datapoint', 'event')
   * @param resourceId The ID of the resource
   * @param hasDocument Whether the resource type has document support
   * @returns An observable containing the resource details
   */
  getResourceDetail(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    hasDocument: boolean
  ): Observable<ResourceDocument> {
    // Construct the URLs for both with and without $details
    const detailsUrl = `${this.currentApiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}$details`;
    const regularUrl = `${this.currentApiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}`;

    // Use the appropriate URL based on hasDocument
    const primaryUrl = hasDocument ? detailsUrl : regularUrl;

    console.log(`Fetching resource detail from: ${primaryUrl}`);
    console.log(`hasDocument flag is: ${hasDocument}`);

    // Try the primary URL first, and if it fails with a 404, fallback to the regular URL
    return this.http.get<any>(primaryUrl).pipe(
      tap((response) => {
        console.log('API response received for resource detail:', response);
      }),
      map((response) => {
        if (hasDocument && (!response['resource'] && !response['resourceUrl'] && !response['resourceBase64'])) {
          this.resolveDocument(regularUrl, response, resourceType);
        }
        return this.processDocumentFields(response, resourceType, hasDocument)
      }
      ),
      catchError((error) => {
        console.error(
          `Error fetching resource detail from ${primaryUrl}:`,
          error
        );

        // If hasDocument is true and we get a 404, fall back to the regular URL
        if (hasDocument && error.status === 404) {
          console.warn(
            `$details URL returned 404, falling back to regular URL: ${regularUrl}`
          );

          return this.http.get<any>(regularUrl).pipe(
            tap((response) => {
              console.log('API response received from fallback URL:', response);
            }),
            map((response) =>
              this.processDocumentFields(response, resourceType, hasDocument)
            ),
            catchError((fallbackError) => {
              console.error(
                `Error fetching resource detail from fallback URL ${regularUrl}:`,
                fallbackError
              );
              return throwError(() => fallbackError);
            })
          );
        }

        // Otherwise, propagate the error
        return throwError(() => error);
      })
    );
  }

  getResourceVersions(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string
  ): Observable<ResourceDocument[]> {
    const url = `${this.currentApiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}/versions`;
    return this.http.get<any>(url).pipe(
      map((response) => {
        // If the response isn't an array (could be an object with values), convert it
        if (!Array.isArray(response)) {
          return Object.values(response);
        }
        return response;
      }),
      catchError((error) => {
        console.error(`Error fetching resource versions:`, error);
        return throwError(() => error);
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
            hasDocument
          );
        } else if (resource['versionscount'] && resource['versionscount'] > 0) {
          // If there are versions but no default specified, fetch the versions list
          // and use the first one
          return this.getResourceVersions(
            groupType,
            groupId,
            resourceType,
            resourceId
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
                  hasDocument
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
}
