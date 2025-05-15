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
    // Initialize with current API URL
    this.currentApiUrl = this.configService.getApiBaseUrl();
    
    // Subscribe to API URL changes
    this.configService.apiBaseUrl$.subscribe(newUrl => {
      this.currentApiUrl = newUrl;
      console.info('CapabilitiesService: API URL updated to:', newUrl);
    });
  }

  getCapabilities(): Observable<Capabilities> {
    return this.http.get<Capabilities>(`${this.currentApiUrl}/capabilities`).pipe(
      catchError(error => {
        //console.warn('Error fetching capabilities, using fallback', error);        // Return a basic fallback capabilities if the server request fails
        return of({
          apis: ['v1'],
          schemas: ['openapi-v3'],
          pagination: false
        } as Capabilities);
      })
    );
  }
}
