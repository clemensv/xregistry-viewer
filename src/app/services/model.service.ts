import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, BehaviorSubject, merge, timer } from 'rxjs';
import { RegistryModel } from '../models/registry.model';
import { map, catchError, tap, startWith, scan, shareReplay, timeout, race } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { ConfigService } from '../services/config.service';
import { DebugService } from '../services/debug.service';

// Interface for tracking endpoint load status
interface EndpointStatus {
  model: RegistryModel | null;
  status: 'loading' | 'success' | 'failed' | 'timeout';
  loadTime?: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModelService {
  private servedFromServer: boolean;

  // Persistent cache that survives navigation
  private static cachedModel: RegistryModel | null = null;
  private static endpointCache: { [endpoint: string]: EndpointStatus } = {};
  private static progressiveCache: BehaviorSubject<{
    model: RegistryModel;
    isComplete: boolean;
    loadedCount: number;
    totalCount: number;
  }> | null = null;

  // Cache for ongoing requests to prevent duplicates
  private ongoingModelRequest: Observable<RegistryModel> | null = null;
  private ongoingProgressiveRequest: Observable<{
    model: RegistryModel;
    isComplete: boolean;
    loadedCount: number;
    totalCount: number;
  }> | null = null;

  // Constants
  private readonly MAX_LOAD_TIME = 15000; // 15 seconds

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private configService: ConfigService,
    private debug: DebugService
  ) {
    // Compute the base URL for the app (from config or fallback to '/')
    const configBaseUrl = (this.configService.getConfig()?.baseUrl || '/').replace(/\/$/, '');
    function proxyUrl(path: string) {
      return `${configBaseUrl}/proxy${path}`;
    }

    // Detect if running in a server context by checking for /proxy API
    this.servedFromServer = false;
    if (isPlatformBrowser(this.platformId)) {
      // Browser: check if /proxy endpoint is available (relative to baseUrl)
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
    // Return cached model if available
    if (ModelService.cachedModel) {
      this.debug.log('ModelService: Returning cached model');
      return of(ModelService.cachedModel);
    }

    // Return ongoing request if there is one to prevent multiple simultaneous requests
    if (this.ongoingModelRequest) {
      this.debug.log('ModelService: Returning ongoing request to prevent multiple calls');
      return this.ongoingModelRequest;
    }

    const config = this.configService.getConfig();
    const modelUris = config?.modelUris || [];
    const apiEndpoints = config?.apiEndpoints || [];
    this.debug.log('ModelService: Model URIs:', modelUris, 'API Endpoints:', apiEndpoints);

    // Compute the base URL for the app (from config or fallback to '/')
    const configBaseUrl = (this.configService.getConfig()?.baseUrl || '/').replace(/\/$/, '');
    function proxyUrl(path: string) {
      return `${configBaseUrl}/proxy${path}`;
    }

    // Fetch all models from modelUris and all /model endpoints
    const modelRequests: Observable<RegistryModel>[] = [];

    // Process model URIs
    for (const uri of modelUris) {
      const cached = ModelService.endpointCache[uri];
      if (cached && (cached.status === 'success' || cached.status === 'failed' || cached.status === 'timeout')) {
        // Use cached result (success, failed, or timeout)
        if (cached.status === 'success' && cached.model) {
          modelRequests.push(of(cached.model));
        } else {
          this.debug.log(`ModelService: Skipping ${uri} - previous ${cached.status}: ${cached.error || 'unknown'}`);
          modelRequests.push(of(null as any));
        }
      } else {
        // Need to load this endpoint
        this.debug.log(`ModelService: Fetching new model for URI ${uri}`);
        ModelService.endpointCache[uri] = { model: null, status: 'loading' };

        const uriToFetch = this.servedFromServer ? proxyUrl(`?target=${encodeURIComponent(uri)}`) : uri;
        const startTime = Date.now();

                        modelRequests.push(
          this.http.get<RegistryModel>(uriToFetch).pipe(
            timeout(this.MAX_LOAD_TIME),
            tap(m => {
              const loadTime = Date.now() - startTime;
              if (m) {
                this.debug.log(`ModelService: Successfully loaded model from ${uri} (${loadTime}ms)`);
                ModelService.endpointCache[uri] = { model: m, status: 'success', loadTime };
              } else {
                this.debug.log(`ModelService: Received null/empty model from ${uri}`);
                ModelService.endpointCache[uri] = { model: null, status: 'failed', error: 'Empty model', loadTime };
              }
            }),
            catchError(err => {
              const loadTime = Date.now() - startTime;
              if (err.name === 'TimeoutError') {
                this.debug.warn(`ModelService: Timeout loading model from ${uri} after ${this.MAX_LOAD_TIME}ms`);
                ModelService.endpointCache[uri] = {
                  model: null,
                  status: 'timeout',
                  error: `Timeout after ${this.MAX_LOAD_TIME}ms`,
                  loadTime: this.MAX_LOAD_TIME
                };
              } else {
                this.debug.error('Failed to load model from', uri, err);
                ModelService.endpointCache[uri] = {
                  model: null,
                  status: 'failed',
                  error: `HTTP ${err.status}: ${err.statusText}`,
                  loadTime
                };
              }
              return of(null as any);
            })
          )
        );
      }
    }

    // Process API endpoints
    for (const api of apiEndpoints) {
      const cached = ModelService.endpointCache[api];
      if (cached && (cached.status === 'success' || cached.status === 'failed' || cached.status === 'timeout')) {
        // Use cached result (success, failed, or timeout)
        if (cached.status === 'success' && cached.model) {
          modelRequests.push(of(cached.model));
        } else {
          this.debug.log(`ModelService: Skipping ${api} - previous ${cached.status}: ${cached.error || 'unknown'}`);
          modelRequests.push(of(null as any));
        }
      } else {
                // Need to load this endpoint
        this.debug.log(`ModelService: Fetching new model for API ${api}`);
        ModelService.endpointCache[api] = { model: null, status: 'loading' };

        const apiToFetch = this.servedFromServer ? proxyUrl(`?target=${encodeURIComponent(api + '/model')}`) : `${api}/model`;
        const startTime = Date.now();

        modelRequests.push(
          this.http.get<RegistryModel>(apiToFetch).pipe(
            timeout(this.MAX_LOAD_TIME),
            tap(m => {
              const loadTime = Date.now() - startTime;
              if (m) {
                this.debug.log(`ModelService: Successfully loaded model from ${api} (${loadTime}ms)`);
                ModelService.endpointCache[api] = { model: m, status: 'success', loadTime };
              } else {
                this.debug.log(`ModelService: Received null/empty model from ${api}`);
                ModelService.endpointCache[api] = { model: null, status: 'failed', error: 'Empty model', loadTime };
              }
            }),
            catchError(err => {
              const loadTime = Date.now() - startTime;
              if (err.name === 'TimeoutError') {
                this.debug.warn(`ModelService: Timeout loading model from ${api} after ${this.MAX_LOAD_TIME}ms`);
                ModelService.endpointCache[api] = {
                  model: null,
                  status: 'timeout',
                  error: `Timeout after ${this.MAX_LOAD_TIME}ms`,
                  loadTime: this.MAX_LOAD_TIME
                };
              } else {
                this.debug.error(`Failed to load model from ${api}:`, err);
                ModelService.endpointCache[api] = {
                  model: null,
                  status: 'failed',
                  error: `HTTP ${err.status}: ${err.statusText}`,
                  loadTime
                };
              }
              return of(null as any);
            })
          )
        );
      }
    }

    if (modelRequests.length === 0) {
      this.debug.log('ModelService: No model requests to make, returning default model');
      return of(this.getDefaultModel());
    }

    // Cache the observable to prevent multiple simultaneous requests
    this.ongoingModelRequest = forkJoin(modelRequests).pipe(
      map((models: (RegistryModel | null)[]) => {
        this.debug.log('ModelService: Received models from forkJoin:', models);

        // Deep merge models
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

          // Debug logging for packages.mcpxreg.com
          const modelDesc = model.description || 'no description';
          if (modelDesc.includes('container registries')) {
            this.debug.log('ModelService: Processing packages.mcpxreg.com model:');
            this.debug.log('  - Groups available:', model.groups ? Object.keys(model.groups) : 'none');
            this.debug.log('  - Has specversion:', !!model.specversion);
            this.debug.log('  - Has registryid:', !!model.registryid);
            this.debug.log('  - Has name:', !!model.name);
            this.debug.log('  - Has capabilities:', !!model.capabilities);
          }

          merged.specversion = model.specversion || merged.specversion;
          merged.registryid = model.registryid || merged.registryid;
          merged.name = model.name || merged.name;
          merged.description = model.description || merged.description;

          // Merge capabilities
          merged.capabilities.apis = Array.from(new Set([...merged.capabilities.apis, ...(model.capabilities?.apis || [])]));
          merged.capabilities.schemas = Array.from(new Set([...merged.capabilities.schemas, ...(model.capabilities?.schemas || [])]));
          merged.capabilities.pagination = model.capabilities?.pagination ?? merged.capabilities.pagination;

          // Deep merge groups
          if (model.groups) {
            for (const groupType of Object.keys(model.groups)) {
              const group = model.groups[groupType];

              // Debug logging for packages.mcpxreg.com groups
              if (modelDesc.includes('container registries')) {
                this.debug.log(`ModelService: Adding group type '${groupType}' from packages.mcpxreg.com`);
                this.debug.log(`  - Group description: ${group.description || 'none'}`);
                this.debug.log(`  - Group resources: ${group.resources ? Object.keys(group.resources) : 'none'}`);
              }

              if (!merged.groups[groupType]) {
                merged.groups[groupType] = JSON.parse(JSON.stringify(group));
              } else {
                // Merge existing group
                const mergedGroup = merged.groups[groupType];
                mergedGroup.plural = group.plural || mergedGroup.plural;
                mergedGroup.singular = group.singular || mergedGroup.singular;
                mergedGroup.description = group.description || mergedGroup.description;
                mergedGroup.attributes = { ...(mergedGroup.attributes || {}), ...(group.attributes || {}) };

                // Merge resources
                mergedGroup.resources = mergedGroup.resources || {};
                for (const resourceType of Object.keys(group.resources || {})) {
                  const resource = group.resources[resourceType];
                  if (!mergedGroup.resources[resourceType]) {
                    mergedGroup.resources[resourceType] = JSON.parse(JSON.stringify(resource));
                  } else {
                    const mergedResource = mergedGroup.resources[resourceType];
                    mergedResource.plural = resource.plural || mergedResource.plural;
                    mergedResource.singular = resource.singular || mergedResource.singular;
                    mergedResource.description = resource.description || mergedResource.description;
                    mergedResource.hasdocument = resource.hasdocument ?? mergedResource.hasdocument;
                    mergedResource.maxversions = resource.maxversions ?? mergedResource.maxversions;
                    mergedResource.attributes = { ...(mergedResource.attributes || {}), ...(resource.attributes || {}) };
                  }
                }
              }
            }
          }
        }

        const finalModel = foundModel ? merged : this.getDefaultModel();

        // Cache the final model persistently
        ModelService.cachedModel = finalModel;
        this.debug.log('ModelService: Cached final merged model with', Object.keys(finalModel.groups).length, 'group types');
        this.debug.log('ModelService: Final group types:', Object.keys(finalModel.groups));

        // Debug: Check if packages.mcpxreg.com groups are present
        const packageGroups = ['noderegistries', 'pythonregistries', 'javaregistries', 'dotnetregistries', 'containerregistries'];
        const foundPackageGroups = packageGroups.filter(gt => finalModel.groups[gt]);
        this.debug.log('ModelService: packages.mcpxreg.com groups in final model:', foundPackageGroups);

        // Clear ongoing request
        this.ongoingModelRequest = null;

        return finalModel;
      }),
      tap(() => {
        // Log cache status
        this.logCacheStatus();
      }),
      shareReplay(1)
    );

    return this.ongoingModelRequest;
  }

  /**
   * Get progressive registry model updates as endpoints load
   * This method emits updated models as each endpoint responds, rather than waiting for all
   */
  getProgressiveRegistryModel(): Observable<{ model: RegistryModel; isComplete: boolean; loadedCount: number; totalCount: number }> {
    // Return cached progressive model if available
    if (ModelService.progressiveCache) {
      this.debug.log('ModelService: Returning cached progressive model');
      return ModelService.progressiveCache.asObservable();
    }

    // Return ongoing progressive request if there is one
    if (this.ongoingProgressiveRequest) {
      this.debug.log('ModelService: Returning ongoing progressive request');
      return this.ongoingProgressiveRequest;
    }

    const config = this.configService.getConfig();
    const modelUris = config?.modelUris || [];
    const apiEndpoints = config?.apiEndpoints || [];
    const totalEndpoints = modelUris.length + apiEndpoints.length;

    if (totalEndpoints === 0) {
      const defaultModel = this.getDefaultModel();
      const result = {
        model: defaultModel,
        isComplete: true,
        loadedCount: 1,
        totalCount: 1
      };
      ModelService.progressiveCache = new BehaviorSubject(result);
      return of(result);
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
      if (ModelService.endpointCache[uri] && (ModelService.endpointCache[uri].status === 'success' || ModelService.endpointCache[uri].status === 'failed' || ModelService.endpointCache[uri].status === 'timeout')) {
        modelStreams.push(of({ endpoint: uri, model: ModelService.endpointCache[uri].model }));
      } else {
        const uriToFetch = this.servedFromServer ? proxyUrl(`?target=${encodeURIComponent(uri)}`) : uri;
        const startTime = Date.now();
        modelStreams.push(
          this.http.get<RegistryModel>(uriToFetch).pipe(
            timeout(this.MAX_LOAD_TIME),
            tap(model => {
              if (model) {
                this.debug.log(`Progressive ModelService: Loaded model from ${uri}`);
                ModelService.endpointCache[uri] = { model: model, status: 'success', loadTime: Date.now() - startTime };
              }
            }),
            map(model => ({ endpoint: uri, model })),
            catchError(err => {
              const loadTime = Date.now() - startTime;
              if (err.name === 'TimeoutError') {
                this.debug.warn(`Progressive ModelService: Timeout loading model from ${uri} after ${this.MAX_LOAD_TIME}ms`);
                ModelService.endpointCache[uri] = {
                  model: null,
                  status: 'timeout',
                  error: `Timeout after ${this.MAX_LOAD_TIME}ms`,
                  loadTime: this.MAX_LOAD_TIME
                };
              } else {
                this.debug.error(`Progressive ModelService: Failed to load model from ${uri}:`, err);
                ModelService.endpointCache[uri] = {
                  model: null,
                  status: 'failed',
                  error: `HTTP ${err.status}: ${err.statusText}`,
                  loadTime
                };
              }
              return of({ endpoint: uri, model: null });
            })
          )
        );
      }
    }

    // Add API endpoints
    for (const api of apiEndpoints) {
      if (ModelService.endpointCache[api] && (ModelService.endpointCache[api].status === 'success' || ModelService.endpointCache[api].status === 'failed' || ModelService.endpointCache[api].status === 'timeout')) {
        modelStreams.push(of({ endpoint: api, model: ModelService.endpointCache[api].model }));
      } else {
        const apiToFetch = this.servedFromServer ? proxyUrl(`?target=${encodeURIComponent(api + '/model')}`) : `${api}/model`;
        const startTime = Date.now();
        modelStreams.push(
          this.http.get<RegistryModel>(apiToFetch).pipe(
            timeout(this.MAX_LOAD_TIME),
            tap(model => {
              if (model) {
                this.debug.log(`Progressive ModelService: Loaded model from ${api}`);
                ModelService.endpointCache[api] = { model: model, status: 'success', loadTime: Date.now() - startTime };
              }
            }),
            map(model => ({ endpoint: api, model })),
            catchError(err => {
              const loadTime = Date.now() - startTime;
              if (err.name === 'TimeoutError') {
                this.debug.warn(`Progressive ModelService: Timeout loading model from ${api} after ${this.MAX_LOAD_TIME}ms`);
                ModelService.endpointCache[api] = {
                  model: null,
                  status: 'timeout',
                  error: `Timeout after ${this.MAX_LOAD_TIME}ms`,
                  loadTime: this.MAX_LOAD_TIME
                };
              } else {
                this.debug.error(`Progressive ModelService: Failed to load model from ${api}:`, err);
                ModelService.endpointCache[api] = {
                  model: null,
                  status: 'failed',
                  error: `HTTP ${err.status}: ${err.statusText}`,
                  loadTime
                };
              }
              return of({ endpoint: api, model: null });
            })
          )
        );
      }
    }

    // Merge all streams and accumulate models progressively
    this.ongoingProgressiveRequest = merge(...modelStreams).pipe(
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
        // Prepare the current result
        const currentResult = {
          model: result.mergedModel,
          isComplete: result.loadedEndpoints.size === totalEndpoints,
          loadedCount: result.loadedEndpoints.size,
          totalCount: totalEndpoints
        };

        // Cache the progressive model when complete
        if (currentResult.isComplete) {
          ModelService.progressiveCache = new BehaviorSubject(currentResult);
          ModelService.cachedModel = result.mergedModel; // Also cache the final model
          this.debug.log('Progressive ModelService: All endpoints loaded, caching final model');
          this.ongoingProgressiveRequest = null; // Clear ongoing request
        }

        return currentResult;
      }),
      startWith({
        model: this.getDefaultModel(),
        isComplete: false,
        loadedCount: 0,
        totalCount: totalEndpoints
      }) // Start with default model
    );

    return this.ongoingProgressiveRequest;
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
   * For 'pythonregistries' group type, only return localhost:3002 endpoint
   */
  getApiEndpointsForGroupType(groupType: string): string[] {
    const config = this.configService.getConfig();
    const apiEndpoints = config?.apiEndpoints || [];

    this.debug.log(`ModelService.getApiEndpointsForGroupType('${groupType}'):`);
    this.debug.log('  - Available API endpoints:', apiEndpoints);
    this.debug.log('  - Loaded endpoint models:', Object.keys(ModelService.endpointCache));
    this.debug.log('  - Full endpointModels:', ModelService.endpointCache);

    // Special case for pythonregistries: only use localhost:3002
    if (groupType === 'pythonregistries') {
      const localhostEndpoint = apiEndpoints.find(api => api.includes('localhost:3002'));
      if (localhostEndpoint) {
        this.debug.log('Using only localhost:3002 endpoint for pythonregistries group');
        return [localhostEndpoint];
      }
    }

    // For other group types, return all available endpoints
    const filteredEndpoints = apiEndpoints.filter(api => {
      const hasModel = ModelService.endpointCache[api];
      const hasGroupType = hasModel && ModelService.endpointCache[api].model && ModelService.endpointCache[api].model.groups?.hasOwnProperty(groupType);
      this.debug.log(`  - Endpoint ${api}: hasModel=${!!hasModel}, hasGroupType=${hasGroupType}`);
      if (hasModel && hasModel.model && hasModel.model.groups) {
        this.debug.log(`    - Available group types: ${Object.keys(hasModel.model.groups)}`);
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
    ModelService.cachedModel = null;
    ModelService.endpointCache = {};
    this.ongoingModelRequest = null;
  }

  /**
   * Clear all caches including individual endpoint models - forces complete reload
   */
  clearAllCaches(): void {
    // All cache clear operation - logging suppressed to reduce noise
    ModelService.cachedModel = null;
    ModelService.endpointCache = {};
    ModelService.progressiveCache = null;
    this.ongoingModelRequest = null;
    this.ongoingProgressiveRequest = null;
  }

  /**
   * Get the current cache status for debugging
   */
  getCacheStatus(): { mergedModelCached: boolean; endpointModelCount: number; cachedEndpoints: string[] } {
    return {
      mergedModelCached: !!ModelService.cachedModel,
      endpointModelCount: Object.keys(ModelService.endpointCache).length,
      cachedEndpoints: Object.keys(ModelService.endpointCache)
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

  private logCacheStatus(): void {
    this.debug.log('ModelService: Current cache status:', this.getCacheStatus());
  }
}
