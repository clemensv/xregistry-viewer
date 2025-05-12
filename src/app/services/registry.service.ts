import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { Group, Resource, VersionDetail } from '../models/registry.model';
import { ModelService } from './model.service';
import { ConfigService } from './config.service';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class RegistryService {
  private isBrowser: boolean;

  private get apiUrl(): string {
    return this.configService.getApiBaseUrl();
  }

  constructor(
    private http: HttpClient,
    private modelService: ModelService,
    private configService: ConfigService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  listGroups(groupType: string): Observable<Group[]> {
    // In SSR environment, return empty array to avoid HTTP requests
    if (!this.isBrowser) {
      return of([]);
    }

    return this.modelService.getRegistryModel().pipe(
      switchMap(model => {
        if (!model.groups[groupType]) {
          console.warn(`Group type '${groupType}' not found in registry model`);
          return of([]);
        }

        return this.http.get<{ [key: string]: any }>(`${this.apiUrl}/${groupType}`).pipe(
          map(res => {
            const groupMeta = model.groups[groupType];
            const attrs = groupMeta.attributes || {};
            return Object.values(res).map((entry: any) => {
              const group: any = {
                id: entry[groupMeta['singular']+'id'] || entry.id,
                name: entry.name,
                createdAt: entry.createdat,    // map createdat
                modifiedAt: entry.modifiedat  // map modifiedat
              };
              // include all other metadata attributes
              Object.keys(attrs).forEach(key => {
                if ([groupMeta['singular']+'id', 'id', 'name'].includes(key)) return;
                if (entry[key] != null) {
                  group[key] = entry[key];
                }
              });
              return group;
            });
          }),
          catchError(err => {
            console.error(`Error loading groups for type '${groupType}':`, err);
            return of([]);
          })
        );
      })
    );
  }

  listResources(groupType: string, groupId: string, resourceType: string): Observable<Resource[]> {
    return this.modelService.getRegistryModel().pipe(
      switchMap(model => {
        const resMeta = model.groups[groupType].resources[resourceType];
        const attrs = resMeta.attributes || {};
        return this.http
          .get<{ [key: string]: any }>(`${this.apiUrl}/${groupType}/${groupId}/${resourceType}`)
          .pipe(
            map(res =>
              Object.values(res).map((entry: any) => {
                const resource: any = {
                  id: entry[resMeta['singular']+'id'] || entry.id,
                  name: entry.name,
                  createdAt: entry.createdat,    // map createdat to createdAt
                  modifiedAt: entry.modifiedat  // map modifiedat to modifiedAt
                };
                Object.keys(attrs).forEach(key => {
                  if ([resMeta['singular']+'id', 'id', 'name'].includes(key)) return;
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
  }  getGroup(groupType: string, groupId: string): Observable<Group> {
    return this.modelService.getRegistryModel().pipe(
      switchMap(model => {        const groupMeta = model.groups[groupType];
        if (!groupMeta) {
          console.error(`Group type ${groupType} not found in registry model`);
          return throwError(() => new Error(`Group type ${groupType} not found in registry model`));
        }

        const attrs = groupMeta.attributes || {};
        const singularIdKey = `${groupMeta.singular}id`;

        return this.http.get<any>(`${this.apiUrl}/${groupType}/${groupId}`).pipe(
          map(entry => {
            const group: any = {
              id: entry[singularIdKey] || entry.id,
              name: entry.name || entry.title || entry[singularIdKey] || entry.id,
              description: entry.description,
              createdAt: entry.createdat,
              modifiedAt: entry.modifiedat
            };

            // Include all resource counts (which end with 'count')
            Object.keys(entry).forEach(key => {
              if (key.endsWith('count')) {
                group[key] = entry[key];
              }
            });

            // Include all resource URLs (which end with 'url')
            Object.keys(entry).forEach(key => {
              if (key.endsWith('url')) {
                group[key] = entry[key];
              }
            });

            // Include all other metadata attributes
            Object.keys(attrs).forEach(key => {
              if ([singularIdKey, 'id', 'name', 'description'].includes(key)) return;
              if (entry[key] != null) {
                group[key] = entry[key];
              }
            });

            return group as Group;
          }),          catchError(error => {
            console.error(`Error getting group ${groupId} of type ${groupType}:`, error);
            return throwError(() => error);
          })
        );
      })
    );
  }
  getResource(groupType: string, groupId: string, resourceType: string, resourceId: string): Observable<Resource> {
    return this.modelService.getRegistryModel().pipe(
      switchMap(model => {
        const resourceMeta = model.groups[groupType]?.resources?.[resourceType];
        if (!resourceMeta) {
          console.error(`Resource type ${resourceType} not found in group type ${groupType}`);
          return throwError(() => new Error(`Resource type ${resourceType} not found in group type ${groupType}`));
        }

        const singularIdKey = `${resourceMeta.singular}id`;

        return this.http.get<any>(`${this.apiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}`).pipe(
          map(entry => {
            const resource: any = {
              id: entry[singularIdKey] || entry.id,
              name: entry.name || entry.title || entry[singularIdKey] || entry.id,
              description: entry.description,
              createdAt: entry.createdat,
              modifiedAt: entry.modifiedat,
              // Include version-related information that's critical for resource display
              versionscount: entry.versionscount,
              versionsurl: entry.versionsurl,
              defaultversionid: entry.meta?.defaultversionid
            };

            // Include all metadata attributes
            if (entry.meta) {
              Object.keys(entry.meta).forEach(key => {
                if (!resource[key]) {
                  resource[key] = entry.meta[key];
                }
              });
            }

            // Copy all other properties that aren't explicitly mapped
            Object.keys(entry).forEach(key => {
              if (!['id', 'name', 'description', 'createdat', 'modifiedat', 'meta'].includes(key) && !resource[key]) {
                resource[key] = entry[key];
              }
            });

            return resource as Resource;
          }),
          catchError(error => {
            console.error(`Error getting resource ${resourceId} of type ${resourceType}:`, error);
            return throwError(() => error);
          })
        );
      })
    );
  }

  getVersionDetail(groupType: string, groupId: string, resourceType: string, resourceId: string, versionId: string, hasDocument: boolean): Observable<VersionDetail> {
    const url = hasDocument
      ? `${this.apiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}/versions/${versionId}/$details`
      : `${this.apiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}/versions/${versionId}`;
    return this.http.get<VersionDetail>(url);
  }
  /**
   * Fetch full xRegistry metadata and document representations for the default/latest version of a resource
   */
  getResourceDetail(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string,
    hasDocument: boolean
  ): Observable<VersionDetail> {
    const url = hasDocument
      ? `${this.apiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}$details` :
        `${this.apiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}`;
    return this.http.get<VersionDetail>(url);
  }
  /**
   * Fetch all versions of a resource
   */
  getResourceVersions(
    groupType: string,
    groupId: string,
    resourceType: string,
    resourceId: string
  ): Observable<VersionDetail[]> {
    const url = `${this.apiUrl}/${groupType}/${groupId}/${resourceType}/${resourceId}/versions`;
    return this.http.get<any>(url).pipe(
      map(response => {
        // The response might be an object with each version, so we convert it to an array if needed
        if (!Array.isArray(response)) {
          return Object.values(response);
        }
        return response;
      })
    );
  }
}
