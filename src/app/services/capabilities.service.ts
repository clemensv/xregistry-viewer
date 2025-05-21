import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Capabilities } from '../models/registry.model';
import { catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class CapabilitiesService {
  private currentApiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    // Use the first apiEndpoints entry as the current API URL
    const config = this.configService.getConfig();
    this.currentApiUrl = config?.apiEndpoints?.[0] || '';
    // Subscribe to config changes if needed
    this.configService.config$.subscribe(cfg => {
      this.currentApiUrl = cfg?.apiEndpoints?.[0] || '';
      console.info('CapabilitiesService: API URL updated to:', this.currentApiUrl);
    });
  }

  getCapabilities(): Observable<Capabilities> {
    return this.http.get<Capabilities>(`${this.currentApiUrl}/capabilities`).pipe(
      catchError(error => {
        // Return a basic fallback capabilities if the server request fails
        return of({
          apis: ['v1'],
          schemas: ['openapi-v3'],
          pagination: false
        } as Capabilities);
      })
    );
  }
}
