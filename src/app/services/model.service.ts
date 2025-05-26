import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, BehaviorSubject, merge } from 'rxjs';
import { RegistryModel } from '../models/registry.model';
import { map, catchError, tap, startWith, scan, shareReplay } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { ConfigService } from '../services/config.service';
import { DebugService } from '../services/debug.service';

@Injectable({
  providedIn: 'root'
})
export class ModelService {
    private servedFromServer: boolean;
  private cachedModel: RegistryModel | null = null;
  // Map API endpoint URL to loaded RegistryModel
  private endpointModels: { [endpoint: string]: RegistryModel } = {};

  // Subject for progressive model updates
  private progressiveModelSubject!: BehaviorSubject<RegistryModel>;

  // Cache for ongoing getRegistryModel request to prevent multiple requests
  private ongoingModelRequest: Observable<RegistryModel> | null = null;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private configService: ConfigService,
    private debug: DebugService
  ) {
    // Initialize progressive model subject after dependencies are injected
    this.progressiveModelSubject = new BehaviorSubject<RegistryModel>(this.getDefaultModel());
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
      // Cache hit - suppress logging for cache hits
      return of(this.cachedModel);
    }

    // Return ongoing request if there is one to prevent multiple simultaneous requests
    if (this.ongoingModelRequest) {
      this.debug.log('ModelService: Returning ongoing request to prevent multiple calls');
      return this.ongoingModelRequest;
    }

    // Keep existing endpointModels - don't reset the cache

    const config = this.configService.getConfig();
    this.debug.log('ModelService: Got config:', config);
    const modelUris = config?.modelUris || [];
    const apiEndpoints = config?.apiEndpoints || [];
    this.debug.log('ModelService: Model URIs:', modelUris, 'API Endpoints:', apiEndpoints);
    this.debug.log('ModelService: servedFromServer:', this.servedFromServer);
    // Cache status logging suppressed to reduce noise

    // Compute the base URL for the app (from config or fallback to '/')
    const configBaseUrl = (this.configService.getConfig()?.baseUrl || '/').replace(/\/$/, '');
    function proxyUrl(path: string) {
      return `${configBaseUrl}/proxy${path}`;
    }

    // Fetch all models from modelUris and all /model endpoints
    const modelRequests: Observable<RegistryModel>[] = [];

    // Only fetch modelUris that haven't been cached yet
    for (const uri of modelUris) {
      if (this.endpointModels[uri]) {
        // Cache hit - suppress logging for cache hits
        modelRequests.push(of(this.endpointModels[uri]));
      } else {
        this.debug.log(`ModelService: Fetching new model for URI ${uri}`);
        const uriToFetch = this.servedFromServer ? proxyUrl(`?target=${encodeURIComponent(uri)}`) : uri;
        modelRequests.push(this.http.get<RegistryModel>(uriToFetch).pipe(
          tap(m => {
            if (m) {
              this.debug.log(`ModelService: Successfully loaded model from ${uri}:`, m);
              this.endpointModels[uri] = m;
            } else {
              this.debug.log(`ModelService: Received null/empty model from ${uri}`);
            }
          }),
          catchError(err => {
            this.debug.error('Failed to load model from', uri, err);
            return of(null as any);
          })
        ));
      }
    }
    // Only fetch API endpoints that haven't been cached yet
    for (const api of apiEndpoints) {
      if (this.endpointModels[api]) {
        // Cache hit - suppress logging for cache hits
        modelRequests.push(of(this.endpointModels[api]));
      } else {
        this.debug.log(`ModelService: Fetching new model for API ${api}`);
        const apiToFetch = this.servedFromServer ? proxyUrl(`?target=${encodeURIComponent(api + '/model')}`) : `${api}/model`;
        this.debug.log(`ModelService: Fetching model from ${api} via URL: ${apiToFetch}`);
        this.debug.log(`ModelService: servedFromServer=${this.servedFromServer}, original API=${api}`);

        // Special handling for schemas.mcpxreg.com
        if (api.includes('schemas.mcpxreg.com')) {
          this.debug.log(`ModelService: Processing schemas.mcpxreg.com endpoint`);
          this.debug.log(`ModelService: Full URL will be: ${apiToFetch}`);
        }

        // For each API, tap to save its model if loaded
        modelRequests.push(this.http.get<RegistryModel>(apiToFetch).pipe(
          tap(m => {
            if (m) {
              this.debug.log(`ModelService: Successfully loaded model from ${api}:`, m);
              this.debug.log(`ModelService: Model groups for ${api}:`, Object.keys(m.groups || {}));
              this.endpointModels[api] = m;
            } else {
              this.debug.log(`ModelService: Received null/empty model from ${api}`);
            }
          }),
          catchError(err => {
            this.debug.error(`Failed to load model from ${api}:`, err);
            this.debug.error(`Error details for ${api}:`, {
              status: err.status,
              statusText: err.statusText,
              message: err.message,
              url: err.url
            });
            return of(null as any);
          })
        ));
      }
    }

    if (modelRequests.length === 0) {
      this.debug.log('ModelService: No model requests to make, returning default model');
      return of(this.getDefaultModel());
    }

    // Count cached vs new requests (cache hit details suppressed)
    const totalEndpoints = modelUris.length + apiEndpoints.length;
    const cachedCount = Object.keys(this.endpointModels).filter(key =>
      modelUris.includes(key) || apiEndpoints.includes(key)
    ).length;
    const newRequests = totalEndpoints - cachedCount;

    // Only log if there are new requests to avoid cache hit spam
    if (newRequests > 0) {
      this.debug.log(`ModelService: Processing ${totalEndpoints} total endpoints - ${newRequests} new requests`);
    }

    // Cache the observable to prevent multiple simultaneous requests
    this.ongoingModelRequest = forkJoin(modelRequests).pipe(
      map((models: (RegistryModel | null)[]) => {
        this.debug.log('ModelService: Received models from forkJoin:', models);
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
          if (!model) {
            this.debug.log('ModelService: Skipping null model');
            continue;
          }
          this.debug.log('ModelService: Processing model:', model);
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
          this.debug.log('ModelService: No models found, returning default model');
          return this.getDefaultModel();
        }
        this.debug.log('ModelService: Successfully merged model with groups:', Object.keys(merged.groups));
        this.debug.log('ModelService: Merged model details:', {
          groupsCount: Object.keys(merged.groups).length,
          groupNames: Object.keys(merged.groups),
          fullModel: merged
        });
        this.cachedModel = merged;
        // Clear the ongoing request cache since we're done
        this.ongoingModelRequest = null;
        // Model cached for future requests (cache hit logging suppressed)
        return merged;
      }),
      catchError(err => {
        this.debug.error('Error merging registry models:', err);
        this.debug.log('ModelService: Falling back to default model due to error');
        // Clear the ongoing request cache on error too
        this.ongoingModelRequest = null;
        return of(this.getDefaultModel());
      }),
      shareReplay(1) // Share the result with multiple subscribers
    );

    return this.ongoingModelRequest;
  }

  /**
   * Get progressive registry model updates as endpoints load
   * This method emits updated models as each endpoint responds, rather than waiting for all
   */
  getProgressiveRegistryModel(): Observable<{ model: RegistryModel; isComplete: boolean; loadedCount: number; totalCount: number }> {
    // Return cached model if available
    if (this.cachedModel) {
      return of({
        model: this.cachedModel,
        isComplete: true,
        loadedCount: 1,
        totalCount: 1
      });
    }

    const config = this.configService.getConfig();
    const modelUris = config?.modelUris || [];
    const apiEndpoints = config?.apiEndpoints || [];
    const totalEndpoints = modelUris.length + apiEndpoints.length;

    if (totalEndpoints === 0) {
      const defaultModel = this.getDefaultModel();
      return of({
        model: defaultModel,
        isComplete: true,
        loadedCount: 1,
        totalCount: 1
      });
    }

    // Compute the base URL for the app (from config or fallback to '/')
    const configBaseUrl = (this.configService.getConfig()?.baseUrl || '/').replace(/\/$/, '');
    function proxyUrl(path: string) {
      return `${configBaseUrl}/proxy${path}`;
    }

    // Create individual observables for each endpoint
    const modelStreams: Observable<{ endpoint: string; model: RegistryModel | null }>[] = [];

    // Add model URIs
    for (const uri of modelUris) {
      if (this.endpointModels[uri]) {
        modelStreams.push(of({ endpoint: uri, model: this.endpointModels[uri] }));
      } else {
        const uriToFetch = this.servedFromServer ? proxyUrl(`?target=${encodeURIComponent(uri)}`) : uri;
        modelStreams.push(
          this.http.get<RegistryModel>(uriToFetch).pipe(
            tap(model => {
              if (model) {
                this.debug.log(`Progressive ModelService: Loaded model from ${uri}`);
                this.endpointModels[uri] = model;
              }
            }),
            map(model => ({ endpoint: uri, model })),
            catchError(err => {
              this.debug.error(`Progressive ModelService: Failed to load model from ${uri}:`, err);
              return of({ endpoint: uri, model: null });
            })
          )
        );
      }
    }

    // Add API endpoints
    for (const api of apiEndpoints) {
      if (this.endpointModels[api]) {
        modelStreams.push(of({ endpoint: api, model: this.endpointModels[api] }));
      } else {
        const apiToFetch = this.servedFromServer ? proxyUrl(`?target=${encodeURIComponent(api + '/model')}`) : `${api}/model`;
        modelStreams.push(
          this.http.get<RegistryModel>(apiToFetch).pipe(
            tap(model => {
              if (model) {
                this.debug.log(`Progressive ModelService: Loaded model from ${api}`);
                this.endpointModels[api] = model;
              }
            }),
            map(model => ({ endpoint: api, model })),
            catchError(err => {
              this.debug.error(`Progressive ModelService: Failed to load model from ${api}:`, err);
              return of({ endpoint: api, model: null });
            })
          )
        );
      }
    }

        // Merge all streams and accumulate models progressively
    return merge(...modelStreams).pipe(
      scan((accumulator: { mergedModel: RegistryModel; loadedEndpoints: Set<string> }, current) => {
        // Add the current endpoint to loaded endpoints
        const newLoadedEndpoints = new Set(accumulator.loadedEndpoints);
        newLoadedEndpoints.add(current.endpoint);

        // Merge the new model into the accumulated model
        let newMergedModel = { ...accumulator.mergedModel };

        if (current.model) {
          newMergedModel = this.mergeModels(newMergedModel, current.model);
          this.debug.log(`Progressive ModelService: Merged model from ${current.endpoint}, now have ${Object.keys(newMergedModel.groups).length} group types`);
        }

        return {
          mergedModel: newMergedModel,
          loadedEndpoints: newLoadedEndpoints
        };
      }, {
        mergedModel: this.getDefaultModel(),
        loadedEndpoints: new Set<string>()
      }),
      map(result => {
        // Cache the final model when all endpoints are loaded
        const isComplete = result.loadedEndpoints.size === totalEndpoints;
        if (isComplete) {
          this.cachedModel = result.mergedModel;
          this.debug.log('Progressive ModelService: All endpoints loaded, caching final model');
        }
        return {
          model: result.mergedModel,
          isComplete,
          loadedCount: result.loadedEndpoints.size,
          totalCount: totalEndpoints
        };
      }),
      startWith({
        model: this.getDefaultModel(),
        isComplete: false,
        loadedCount: 0,
        totalCount: totalEndpoints
      }) // Start with default model
    );
  }

  /**
   * Helper method to merge two registry models
   */
  private mergeModels(base: RegistryModel, addition: RegistryModel): RegistryModel {
    const merged: RegistryModel = JSON.parse(JSON.stringify(base)); // Deep clone

    // Merge basic properties
    merged.specversion = addition.specversion || merged.specversion;
    merged.registryid = addition.registryid || merged.registryid;
    merged.name = addition.name || merged.name;
    merged.description = addition.description || merged.description;

    // Merge capabilities
    merged.capabilities.apis = Array.from(new Set([
      ...merged.capabilities.apis,
      ...(addition.capabilities?.apis || [])
    ]));
    merged.capabilities.schemas = Array.from(new Set([
      ...merged.capabilities.schemas,
      ...(addition.capabilities?.schemas || [])
    ]));
    merged.capabilities.pagination = addition.capabilities?.pagination ?? merged.capabilities.pagination;

    // Deep merge groups
    if (addition.groups) {
      for (const groupType of Object.keys(addition.groups)) {
        const group = addition.groups[groupType];
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

    return merged;
  }

  /**
   * Returns only those API endpoints whose loaded model defines the given group type
   * For 'pythonregistries' group type, only return localhost:3000 endpoint
   */
  getApiEndpointsForGroupType(groupType: string): string[] {
    const config = this.configService.getConfig();
    const apiEndpoints = config?.apiEndpoints || [];

    this.debug.log(`ModelService.getApiEndpointsForGroupType('${groupType}'):`);
    this.debug.log('  - Available API endpoints:', apiEndpoints);
    this.debug.log('  - Loaded endpoint models:', Object.keys(this.endpointModels));
    this.debug.log('  - Full endpointModels:', this.endpointModels);

    // Special case for pythonregistries: only use localhost:3000
    if (groupType === 'pythonregistries') {
      const localhostEndpoint = apiEndpoints.find(api => api.includes('localhost:3000'));
      if (localhostEndpoint) {
        this.debug.log('Using only localhost:3000 endpoint for pythonregistries group');
        return [localhostEndpoint];
      }
    }

    // For other group types, return all available endpoints
    const filteredEndpoints = apiEndpoints.filter(api => {
      const hasModel = this.endpointModels[api];
      const hasGroupType = hasModel && this.endpointModels[api].groups?.hasOwnProperty(groupType);
      this.debug.log(`  - Endpoint ${api}: hasModel=${!!hasModel}, hasGroupType=${hasGroupType}`);
      if (hasModel && hasModel.groups) {
        this.debug.log(`    - Available group types: ${Object.keys(hasModel.groups)}`);
      }
      return hasGroupType;
    });

    this.debug.log(`  - Filtered endpoints for '${groupType}':`, filteredEndpoints);

    // If no endpoints have the specific group type, return all endpoints as fallback
    if (filteredEndpoints.length === 0) {
      this.debug.log(`  - No endpoints found for group type '${groupType}', returning all endpoints as fallback`);
      return apiEndpoints;
    }

    return filteredEndpoints;
  }

  /**
   * Clear the cached model to force reload on next getRegistryModel() call
   */
  clearCache(): void {
    // Cache clear operation - logging suppressed to reduce noise
    this.cachedModel = null;
    this.ongoingModelRequest = null;
  }

  /**
   * Clear all caches including individual endpoint models - forces complete reload
   */
  clearAllCaches(): void {
    // All cache clear operation - logging suppressed to reduce noise
    this.cachedModel = null;
    this.endpointModels = {};
    this.ongoingModelRequest = null;
  }

  /**
   * Get the current cache status for debugging
   */
  getCacheStatus(): { mergedModelCached: boolean; endpointModelCount: number; cachedEndpoints: string[] } {
    return {
      mergedModelCached: !!this.cachedModel,
      endpointModelCount: Object.keys(this.endpointModels).length,
      cachedEndpoints: Object.keys(this.endpointModels)
    };
  }

  private getDefaultModel(): RegistryModel {
    this.debug.log('ModelService: Creating default model for fallback');
    // Return a more comprehensive model to allow the application to function during development
    return {
      specversion: '1.0',
      registryid: 'default-registry',
      name: 'Default Registry',
      description: 'Fallback registry for development or when API is unavailable',
      capabilities: {
        apis: ['v1'],
        schemas: ['openapi-v3'],
        pagination: false
      },
      groups: {
        'messagegroups': {
          plural: 'messagegroups',
          singular: 'messagegroup',
          description: 'Groups for organizing message definitions',
          attributes: {},
          resources: {
            'messages': {
              plural: 'messages',
              singular: 'message',
              description: 'Message definitions',
              hasdocument: true,
              maxversions: 0,
              attributes: {}
            }
          }
        },
        'schemagroups': {
          plural: 'schemagroups',
          singular: 'schemagroup',
          description: 'Groups for organizing schema definitions',
          attributes: {},
          resources: {
            'schemas': {
              plural: 'schemas',
              singular: 'schema',
              description: 'Schema definitions',
              hasdocument: true,
              maxversions: 0,
              attributes: {}
            }
          }
        },
        'endpointgroups': {
          plural: 'endpointgroups',
          singular: 'endpointgroup',
          description: 'Groups for organizing API endpoints',
          attributes: {},
          resources: {
            'endpoints': {
              plural: 'endpoints',
              singular: 'endpoint',
              description: 'API endpoint definitions',
              hasdocument: true,
              maxversions: 0,
              attributes: {}
            }
          }
        }
      }
    } as RegistryModel;
  }
}
