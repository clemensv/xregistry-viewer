import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Capabilities } from '../models/registry.model';
import { catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class CapabilitiesService {

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {}

  getCapabilities(): Observable<Capabilities> {
    const apiUrl = this.configService.getApiBaseUrl();
    return this.http.get<Capabilities>(`${apiUrl}/capabilities`).pipe(
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
