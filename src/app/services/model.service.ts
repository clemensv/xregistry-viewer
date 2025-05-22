import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { RegistryModel } from '../models/registry.model';
import { map, catchError, tap } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { ConfigService } from '../services/config.service';

@Injectable({
  providedIn: 'root'
})
export class ModelService {
  private servedFromServer: boolean;
  private cachedModel: RegistryModel | null = null;
  // Map API endpoint URL to loaded RegistryModel
  private endpointModels: { [endpoint: string]: RegistryModel } = {};

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private configService: ConfigService
  ) {
    // Compute the base URL for the app (from config or fallback to '/')
    const configBaseUrl = (this.configService.getConfig()?.baseUrl || '/').replace(/\/$/, '');
    function proxyUrl(path: string) {
      return `${configBaseUrl}/proxy${path}`;
    }
    // Detect if running in a server context by checking for /proxy API
    // (servedFromServer = true if /proxy is available)
    this.servedFromServer = false;
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

  getRegistryModel(): Observable<RegistryModel> {
    // Return cached model if available (keep endpointModels intact)
    if (this.cachedModel) {
      return of(this.cachedModel);
    }
    // Reset mapping before fresh fetch
    this.endpointModels = {};

    const config = this.configService.getConfig();
    const modelUris = config?.modelUris || [];
    const apiEndpoints = config?.apiEndpoints || [];

    // Compute the base URL for the app (from config or fallback to '/')
    const configBaseUrl = (this.configService.getConfig()?.baseUrl || '/').replace(/\/$/, '');
    function proxyUrl(path: string) {
      return `${configBaseUrl}/proxy${path}`;
    }

    // Fetch all models from modelUris and all /model endpoints
    const modelRequests: Observable<RegistryModel>[] = [];
    for (const uri of modelUris) {
      const uriToFetch = this.servedFromServer ? proxyUrl(`?target=${encodeURIComponent(uri)}`) : uri;
      modelRequests.push(this.http.get<RegistryModel>(uriToFetch).pipe(
        catchError(err => {
          console.error('Failed to load model from', uri, err);
          return of(null as any);
        })
      ));
    }
    for (const api of apiEndpoints) {
      const apiToFetch = this.servedFromServer ? proxyUrl(`?target=${encodeURIComponent(api + '/model')}`) : `${api}/model`;
      // For each API, tap to save its model if loaded
      modelRequests.push(this.http.get<RegistryModel>(apiToFetch).pipe(
        tap(m => {
          if (m) {
            this.endpointModels[api] = m;
          }
        }),
        catchError(err => {
          console.error('Failed to load model from', api, err);
          return of(null as any);
        })
      ));
    }

    if (modelRequests.length === 0) {
      return of(this.getDefaultModel());
    }

    return forkJoin(modelRequests).pipe(
      map((models: (RegistryModel | null)[]) => {
        // Deep merge models: merge all groupTypes, resourceTypes, and attributes
        const merged: RegistryModel = {
          specversion: '',
          registryid: '',
          name: '',
          description: '',
          capabilities: { apis: [], schemas: [], pagination: false },
          groups: {}
        };
        let foundModel = false;
        for (const model of models) {
          if (!model) continue;
          foundModel = true;
          merged.specversion = model.specversion || merged.specversion;
          merged.registryid = model.registryid || merged.registryid;
          merged.name = model.name || merged.name;
          merged.description = model.description || merged.description;
          // Merge capabilities (union arrays, last wins for bool)
          merged.capabilities.apis = Array.from(new Set([...merged.capabilities.apis, ...(model.capabilities?.apis || [])]));
          merged.capabilities.schemas = Array.from(new Set([...merged.capabilities.schemas, ...(model.capabilities?.schemas || [])]));
          merged.capabilities.pagination = model.capabilities?.pagination ?? merged.capabilities.pagination;
          // Deep merge groups
          if (model.groups) {
            for (const groupType of Object.keys(model.groups)) {
              const group = model.groups[groupType];
              if (!merged.groups[groupType]) {
                merged.groups[groupType] = JSON.parse(JSON.stringify(group));
              } else {
                // Merge groupType fields
                const mergedGroup = merged.groups[groupType];
                mergedGroup.plural = group.plural || mergedGroup.plural;
                mergedGroup.singular = group.singular || mergedGroup.singular;
                mergedGroup.description = group.description || mergedGroup.description;
                // Merge group attributes
                mergedGroup.attributes = { ...(mergedGroup.attributes || {}), ...(group.attributes || {}) };
                // Merge resources
                mergedGroup.resources = mergedGroup.resources || {};
                for (const resourceType of Object.keys(group.resources || {})) {
                  const resource = group.resources[resourceType];
                  if (!mergedGroup.resources[resourceType]) {
                    mergedGroup.resources[resourceType] = JSON.parse(JSON.stringify(resource));
                  } else {
                    // Merge resourceType fields
                    const mergedResource = mergedGroup.resources[resourceType];
                    mergedResource.plural = resource.plural || mergedResource.plural;
                    mergedResource.singular = resource.singular || mergedResource.singular;
                    mergedResource.description = resource.description || mergedResource.description;
                    mergedResource.hasdocument = resource.hasdocument ?? mergedResource.hasdocument;
                    mergedResource.maxversions = resource.maxversions ?? mergedResource.maxversions;
                    // Merge resource attributes
                    mergedResource.attributes = { ...(mergedResource.attributes || {}), ...(resource.attributes || {}) };
                  }
                }
              }
            }
          }
        }
        if (!foundModel) {
          return this.getDefaultModel();
        }
        this.cachedModel = merged;
        return merged;
      }),
      catchError(err => {
        console.error('Error merging registry models:', err);
        return of(this.getDefaultModel());
      })
    );
  }

  /**
   * Returns only those API endpoints whose loaded model defines the given group type
   * For 'pythonregistries' group type, only return localhost:3000 endpoint
   */
  getApiEndpointsForGroupType(groupType: string): string[] {
    const config = this.configService.getConfig();
    const apiEndpoints = config?.apiEndpoints || [];

    // Special case for pythonregistries: only use localhost:3000
    if (groupType === 'pythonregistries') {
      const localhostEndpoint = apiEndpoints.find(api => api.includes('localhost:3000'));
      if (localhostEndpoint) {
        console.log('Using only localhost:3000 endpoint for pythonregistries group');
        return [localhostEndpoint];
      }
    }

    // For other group types, return all available endpoints
    return apiEndpoints.filter(api =>
      this.endpointModels[api] && this.endpointModels[api].groups?.hasOwnProperty(groupType)
    );
  }

  private getDefaultModel(): RegistryModel {
    // Return a minimal model to allow the application to function during SSR
    return {
      specversion: '1.0',
      registryid: 'default-registry',
      name: 'Default Registry',
      description: 'Fallback registry for SSR or when API is unavailable',
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
    } as RegistryModel;
  }
}
