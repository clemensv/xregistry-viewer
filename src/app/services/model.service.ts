import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { RegistryModel } from '../models/registry.model';
import { map, catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ModelService {
  private readonly apiUrl = environment.apiBaseUrl;
  private isBrowser: boolean;
  private cachedModel: RegistryModel | null = null;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
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
      return of(this.getDefaultModel());    }

    return this.http.get<RegistryModel>(`${this.apiUrl}/model`).pipe(
      map((model: RegistryModel) => {
        // Recursively process attributes for GroupType and ResourceType
        const processAttributes = (attributes: any) => {
          if (!attributes) return;
          Object.keys(attributes).forEach(key => {
            const attr = attributes[key];
            if (attr.type === 'object' && attr.attributes) {
              processAttributes(attr.attributes);
            } else if (attr.type === 'array' && attr.item && attr.item.attributes) {
              processAttributes(attr.item.attributes);
            }
          });
        };

        Object.values(model.groups).forEach(group => {
          processAttributes(group.attributes);
          Object.values(group.resources).forEach(resource => {
            processAttributes(resource.attributes);
          });
        });

        // Cache the processed model
        this.cachedModel = model;
        return model;
      }),
      catchError(err => {
        console.error('Error loading registry model:', err);
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
