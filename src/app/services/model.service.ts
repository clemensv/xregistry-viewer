import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { RegistryModel } from '../models/registry.model';
import { map, catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { ConfigService } from '../services/config.service';

@Injectable({
  providedIn: 'root'
})
export class ModelService {
  private readonly apiUrl = environment.apiBaseUrl;
  private isBrowser: boolean;
  private cachedModel: RegistryModel | null = null;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private configService: ConfigService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  getRegistryModel(): Observable<RegistryModel> {
    // Return cached model if available
    if (this.cachedModel) {
      return of(this.cachedModel);
    }

    // In SSR, use a default empty model to avoid errors
    if (!this.isBrowser) {
      return of(this.getDefaultModel());
    }

    const config = this.configService.getConfig();
    const modelUris = config?.modelUris || [];
    const apiEndpoints = config?.apiEndpoints || [];

    // Fetch all models from modelUris and all /model endpoints
    const modelRequests: Observable<RegistryModel>[] = [];
    for (const uri of modelUris) {
      modelRequests.push(this.http.get<RegistryModel>(uri).pipe(
        catchError(err => {
          console.error('Failed to load model from', uri, err);
          return of(null as any);
        })
      ));
    }
    for (const api of apiEndpoints) {
      modelRequests.push(this.http.get<RegistryModel>(`${api}/model`).pipe(
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
        // Merge models: last loaded group type shadows previous
        const merged: RegistryModel = {
          specversion: '',
          registryid: '',
          name: '',
          description: '',
          capabilities: { apis: [], schemas: [], pagination: false },
          groups: {}
        };
        for (const model of models) {
          if (!model) continue;
          merged.specversion = model.specversion || merged.specversion;
          merged.registryid = model.registryid || merged.registryid;
          merged.name = model.name || merged.name;
          merged.description = model.description || merged.description;
          // Merge capabilities (union arrays, last wins for bool)
          merged.capabilities.apis = Array.from(new Set([...merged.capabilities.apis, ...(model.capabilities?.apis || [])]));
          merged.capabilities.schemas = Array.from(new Set([...merged.capabilities.schemas, ...(model.capabilities?.schemas || [])]));
          merged.capabilities.pagination = model.capabilities?.pagination ?? merged.capabilities.pagination;
          // Merge groups: last loaded group type shadows previous
          if (model.groups) {
            for (const groupType of Object.keys(model.groups)) {
              merged.groups[groupType] = model.groups[groupType];
            }
          }
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
