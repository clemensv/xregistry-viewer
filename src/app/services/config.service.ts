import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable, Subject, catchError, firstValueFrom, from, mergeMap, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface AppConfig {
  apiBaseUrl?: string; // legacy, optional
  apiEndpoints?: string[]; // new, multi-endpoint
  modelUris?: string[]; // new, multi-model
  baseUrl: string;
  defaultDocumentView: boolean;
  features: {
    enableFilters: boolean;
    enableSearch: boolean;
    enableDocDownload: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private apiBaseUrlSubject = new BehaviorSubject<string>(environment.apiBaseUrl);
  public apiBaseUrl$: Observable<string> = this.apiBaseUrlSubject.asObservable();

  private baseUrlSubject = new BehaviorSubject<string>(environment.baseUrl || '/');
  public baseUrl$: Observable<string> = this.baseUrlSubject.asObservable();

  private configSubject = new BehaviorSubject<AppConfig | null>(null);
  public config$: Observable<AppConfig | null> = this.configSubject.asObservable();

  private configLoaded = false;
  private configLoading = false;

  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Load from local storage if available and in browser environment
    if (this.isBrowser) {
      const savedApiBaseUrl = localStorage.getItem('apiBaseUrl');
      if (savedApiBaseUrl) {
        this.apiBaseUrlSubject.next(savedApiBaseUrl);
      }

      const savedBaseUrl = localStorage.getItem('baseUrl');
      if (savedBaseUrl) {
        this.baseUrlSubject.next(savedBaseUrl);
      }
    }
  }  getApiBaseUrl(): string {
    return this.apiBaseUrlSubject.value;
  }

  getBaseUrl(): string {
    return this.baseUrlSubject.value;
  }

  setApiBaseUrl(url: string): void {
    // Validate URL - be more forgiving with relative URLs
    try {
      // For relative URLs, we'll just accept them
      if (url.startsWith('/')) {
        this.apiBaseUrlSubject.next(url);
        if (this.isBrowser) {
          localStorage.setItem('apiBaseUrl', url);
        }
        return;
      }

      // For absolute URLs, attempt to validate
      new URL(url); // This will throw if the URL is invalid
      this.apiBaseUrlSubject.next(url);
      if (this.isBrowser) {
        localStorage.setItem('apiBaseUrl', url);
      }
    } catch (e) {
      console.error('Invalid URL format:', url);
      throw new Error('Invalid URL format');
    }
  }

  setBaseUrl(url: string): void {
    try {
      // Normalize the base URL
      let normalizedUrl = url;

      // Ensure base URL starts with a slash
      if (!normalizedUrl.startsWith('/') && !normalizedUrl.startsWith('http')) {
        normalizedUrl = '/' + normalizedUrl;
      }

      // Ensure base URL ends with a slash
      if (!normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl + '/';
      }

      this.baseUrlSubject.next(normalizedUrl);
      if (this.isBrowser) {
        localStorage.setItem('baseUrl', normalizedUrl);
      }
    } catch (e) {
      console.error('Invalid base URL format:', url);
      throw new Error('Invalid base URL format');
    }
  }

  resetToDefault(): void {
    this.apiBaseUrlSubject.next(environment.apiBaseUrl);
    this.baseUrlSubject.next(environment.baseUrl);
    if (this.isBrowser) {
      localStorage.removeItem('apiBaseUrl');
      localStorage.removeItem('baseUrl');
    }
  }
  /**
   * Load configuration from a JSON file
   * @param configPath Path to the configuration JSON file
   * @returns Promise that resolves when configuration is loaded
   */
  loadConfigFromJson(configPath: string): Promise<AppConfig | null> {
    // If already loading, return the existing promise
    if (this.configLoading) {
      return firstValueFrom(this.config$);
    }

    // If already loaded, return the current config
    if (this.configLoaded) {
      return Promise.resolve(this.configSubject.getValue());
    }

    this.configLoading = true;

    return firstValueFrom(
      this.http.get<AppConfig>(configPath).pipe(
        tap(config => {
          // Backward compatibility: migrate legacy config
          if (!config.apiEndpoints && config.apiBaseUrl) {
            config.apiEndpoints = [config.apiBaseUrl];
          }
          if (!config.modelUris) {
            config.modelUris = [];
          }
          this.configSubject.next(config);
          this.configLoaded = true;
          this.configLoading = false;

          // Update the base URLs from the config
          if (config.apiBaseUrl) {
            this.apiBaseUrlSubject.next(config.apiBaseUrl);
          }

          if (config.baseUrl) {
            this.baseUrlSubject.next(config.baseUrl);
          }

          console.info('Configuration loaded successfully:', config);
        }),
        catchError(error => {
          console.error('Error loading configuration:', error);
          this.configLoading = false;

          // Return default config on error
          const defaultConfig = this.getDefaultConfig();

          this.configSubject.next(defaultConfig);
          this.configLoaded = true;

          return of(defaultConfig);
        })
      )
    );
  }

  /**
   * Save the current configuration
   * @param config Configuration to save
   */
  saveConfig(config: AppConfig): Promise<void> {
    // Backward compatibility: always set apiBaseUrl to first apiEndpoints if present
    if (config.apiEndpoints && config.apiEndpoints.length > 0) {
      config.apiBaseUrl = config.apiEndpoints[0];
    }
    // Update current configuration
    this.configSubject.next(config);

    // Update base URLs
    if (config.apiBaseUrl) {
      this.setApiBaseUrl(config.apiBaseUrl);
    }

    if (config.baseUrl) {
      this.setBaseUrl(config.baseUrl);
    }

    // In a real application, you might want to persist this to a server
    // For now, we'll just store it in localStorage
    if (this.isBrowser) {
      localStorage.setItem('appConfig', JSON.stringify(config));
    }

    return Promise.resolve();
  }

  /**
   * Get the current configuration
   * @returns The current configuration
   */
  getConfig(): AppConfig | null {
    // Backward compatibility: migrate legacy config
    const config = this.configSubject.getValue();
    if (config && !config.apiEndpoints && config.apiBaseUrl) {
      config.apiEndpoints = [config.apiBaseUrl];
    }
    if (config && !config.modelUris) {
      config.modelUris = [];
    }
    return config;
  }

  /**
   * Get default configuration from environment
   */
  private getDefaultConfig(): AppConfig {
    return {
      apiBaseUrl: environment.apiBaseUrl,
      apiEndpoints: [environment.apiBaseUrl],
      modelUris: [],
      baseUrl: environment.baseUrl,
      defaultDocumentView: true,
      features: {
        enableFilters: true,
        enableSearch: true,
        enableDocDownload: true
      }
    };
  }
}
