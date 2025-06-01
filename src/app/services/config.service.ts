import { Injectable, Inject, PLATFORM_ID, inject, signal } from '@angular/core';
import { 
  BehaviorSubject, 
  Observable, 
  Subject, 
  catchError, 
  firstValueFrom, 
  from, 
  map, 
  mergeMap, 
  of, 
  retry, 
  shareReplay, 
  tap, 
  throwError 
} from 'rxjs';
import { environment } from '../../environments/environment';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

/**
 * Application configuration interface
 * @description Defines the structure of the application configuration
 */
export interface AppConfig {
  /** API endpoints for registry services */
  apiEndpoints?: string[];
  /** Model URIs for data sources */
  modelUris?: string[];
  /** Base URL for application */
  baseUrl: string;
  /** Default document view setting */
  defaultDocumentView: boolean;
  /** Feature flags for application capabilities */
  features: {
    /** Enable filtering capability */
    enableFilters: boolean;
    /** Enable search capability */
    enableSearch: boolean;
    /** Enable document download capability */
    enableDocDownload: boolean;
  };
}

/**
 * Configuration service for managing application settings
 * @description Handles loading, caching, and persisting application configuration
 */
@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  /** Signal for loading state */
  readonly loading = signal<boolean>(false);
  /** Signal for error state */
  readonly error = signal<Error | null>(null);
  
  /** Subject for base URL updates */
  private baseUrlSubject = new BehaviorSubject<string>(environment.baseUrl || '/');
  /** Observable of current base URL */
  readonly baseUrl$: Observable<string> = this.baseUrlSubject.asObservable().pipe(
    shareReplay(1)
  );

  /** Subject for configuration updates */
  private configSubject = new BehaviorSubject<AppConfig | null>(null);
  /** Observable of current configuration */
  readonly config$: Observable<AppConfig | null> = this.configSubject.asObservable().pipe(
    shareReplay(1)
  );

  /** Flag indicating if configuration has been loaded */
  private configLoaded = false;
  /** Flag indicating if configuration is currently loading */
  private configLoading = false;
  /** Flag indicating if running in browser environment */
  private readonly isBrowser: boolean;

  /** HTTP client for API requests */
  private readonly http = inject(HttpClient);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Load from local storage if available and in browser environment
    if (this.isBrowser) {
      try {
        const savedBaseUrl = localStorage.getItem('baseUrl');
        if (savedBaseUrl) {
          this.baseUrlSubject.next(savedBaseUrl);
        }
      } catch (err) {
        console.warn('Failed to load baseUrl from localStorage:', err);
      }
    }
  }

  getBaseUrl(): string {
    return this.baseUrlSubject.value;
  }
  /**
   * Sets the base URL with proper normalization
   * @param url The URL to set
   * @throws Error if URL format is invalid
   */
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
      this.error.set(new Error(`Invalid base URL format: ${url}`));
      throw new Error(`Invalid base URL format: ${url}`);
    }
  }
  /**
   * Resets configuration to default values
   */
  resetToDefault(): void {
    this.configLoaded = false;
    this.baseUrlSubject.next(environment.baseUrl);
    this.configSubject.next(this.getDefaultConfig());
    
    if (this.isBrowser) {
      localStorage.removeItem('baseUrl');
      localStorage.removeItem('appConfig');
    }
  }
  /**
   * Load configuration from a JSON file
   * @param configPath Path to the configuration JSON file
   * @returns Promise that resolves when configuration is loaded
   */  /**
   * Loads configuration from a JSON file with enhanced reliability
   * @param configPath Path to the configuration JSON file
   * @returns Promise that resolves when configuration is loaded
   */
  loadConfigFromJson(configPath: string): Promise<AppConfig | null> {
    console.log(`ConfigService: Loading configuration from ${configPath}`);
    
    // If already loading, return the existing promise
    if (this.configLoading) {
      console.log('ConfigService: Configuration already loading, returning existing promise');
      return firstValueFrom(this.config$.pipe(
        // Filter out null values to ensure we return valid config
        map(config => {
          if (config === null) {
            throw new Error('Configuration loading in progress but no valid configuration found');
          }
          return config;
        })
      )).catch(err => {
        console.warn('ConfigService: Error waiting for existing config load:', err);
        // If the existing promise fails, we'll attempt to load again
        this.configLoading = false;
        return this.forceLoadConfig(configPath);
      });
    }

    // If already loaded, return the current config
    if (this.configLoaded) {
      console.log('ConfigService: Configuration already loaded, returning existing config');
      const existingConfig = this.configSubject.getValue();
      
      // Verify the config is valid
      if (existingConfig && this.validateConfig(existingConfig)) {
        return Promise.resolve(existingConfig);
      } else {
        console.warn('ConfigService: Existing configuration is invalid, reloading');
        return this.forceLoadConfig(configPath);
      }
    }

    // Normal load path
    return this.forceLoadConfig(configPath);
  }

  /**
   * Forces a reload of the configuration from the specified path
   * @param configPath Path to the configuration JSON file
   * @returns Promise that resolves when configuration is loaded
   * @private
   */
  private forceLoadConfig(configPath: string): Promise<AppConfig | null> {
    this.configLoading = true;
    this.loading.set(true);
    this.error.set(null);
    console.log('ConfigService: Starting configuration load...');

    return firstValueFrom(
      this.http.get<AppConfig>(configPath).pipe(
        // Retry up to 5 times with exponential backoff
        retry({
          count: 5,
          delay: (error, retryCount) => {
            console.warn(`ConfigService: Retry attempt ${retryCount} for config load...`, error);
            // Exponential backoff with jitter - more aggressive for earlier retries
            const baseDelay = Math.min(Math.pow(1.5, retryCount) * 1000, 10000);
            const jitter = baseDelay * 0.2 * Math.random();
            const delay = baseDelay + jitter;
            console.log(`ConfigService: Waiting ${delay}ms before retry ${retryCount}`);
            return of(delay);
          }
        }),
        map(config => {
          console.log('ConfigService: Raw configuration loaded:', config);
          if (!config) {
            throw new Error('Received empty configuration from server');
          }
          // Normalize the configuration
          return this.normalizeConfig(config);
        }),
        tap(config => {
          console.log('ConfigService: Configuration normalized successfully');
          
          // Validate the configuration
          if (!this.validateConfig(config)) {
            throw new Error('Configuration validation failed');
          }
          
          // Update state with new configuration
          this.configSubject.next(config);
          this.configLoaded = true;
          this.configLoading = false;
          this.loading.set(false);

          if (config.baseUrl) {
            console.log(`ConfigService: Updating base URL to ${config.baseUrl}`);
            this.baseUrlSubject.next(config.baseUrl);          }

          // Persist configuration to localStorage if in browser
          this.persistConfig(config);
          console.log('ConfigService: Configuration load completed successfully');
          return config;
        }),
        catchError((error: HttpErrorResponse) => {
          const errorMessage = `Failed to load configuration from ${configPath}: ${error.message}`;
          console.error('ConfigService:', errorMessage, error);
          const configError = new Error(errorMessage);
            console.error('ConfigService: Error details:', {
            status: error.status,
            statusText: error.statusText,
            url: error.url,
            headers: error.headers ? Object.fromEntries(error.headers.keys().map(key => [key, error.headers.get(key)])) : 'No headers',
            body: error.error
          });
          
          // Try loading from localStorage if available before falling back to defaults
          if (this.isBrowser) {
            try {
              const storedConfig = localStorage.getItem('appConfig');
              if (storedConfig) {
                const parsedConfig = JSON.parse(storedConfig) as AppConfig;
                if (this.validateConfig(parsedConfig)) {
                  console.log('ConfigService: Using stored configuration from localStorage');
                  this.configSubject.next(parsedConfig);
                  this.configLoaded = true;
                  this.configLoading = false;
                  this.loading.set(false);
                  this.error.set(null); // Clear error since we found valid config
                  return of(parsedConfig);
                } else {
                  console.warn('ConfigService: Stored configuration is invalid');
                }
              }
            } catch (storageError) {
              console.warn('ConfigService: Error reading from localStorage:', storageError);
            }
          }
          
          this.configLoading = false;
          this.loading.set(false);
          this.error.set(configError);

          // Use default config on error as last resort
          const defaultConfig = this.getDefaultConfig();
          console.log('ConfigService: Using default configuration due to error', defaultConfig);
          this.configSubject.next(defaultConfig);
          this.configLoaded = true;

          // Only return default config if we're not going to try another source
          return of(defaultConfig);
        })
      )
    );
  }

  /**
   * Normalizes a configuration object ensuring all required fields are present
   * @param config The configuration to normalize
   * @returns The normalized configuration
   */
  private normalizeConfig(config: AppConfig): AppConfig {
    return {
      ...config,
      apiEndpoints: config.apiEndpoints || [],
      modelUris: config.modelUris || [],
      baseUrl: config.baseUrl || '/',
      defaultDocumentView: config.defaultDocumentView ?? true,
      features: {
        enableFilters: config.features?.enableFilters ?? true,
        enableSearch: config.features?.enableSearch ?? true,
        enableDocDownload: config.features?.enableDocDownload ?? true
      }
    };
  }

  /**
   * Persists configuration to localStorage if in browser environment
   * @param config The configuration to persist
   */
  private persistConfig(config: AppConfig): void {
    if (this.isBrowser) {
      try {
        localStorage.setItem('appConfig', JSON.stringify(config));
      } catch (err) {
        console.warn('Failed to persist configuration to localStorage:', err);
      }
    }
  }

  /**
   * Save the current configuration
   * @param config Configuration to save
   */  /**
   * Saves the current configuration
   * @param config Configuration to save
   * @returns Promise that resolves when configuration is saved
   */
  saveConfig(config: AppConfig): Promise<void> {
    try {
      const normalizedConfig = this.normalizeConfig(config);
      this.configSubject.next(normalizedConfig);

      if (normalizedConfig.baseUrl) {
        this.setBaseUrl(normalizedConfig.baseUrl);
      }

      this.persistConfig(normalizedConfig);
      return Promise.resolve();
    } catch (error) {
      console.error('Error saving configuration:', error);
      this.error.set(error instanceof Error ? error : new Error('Unknown error saving configuration'));
      return Promise.reject(error);
    }
  }

  /**
   * Get the current configuration
   * @returns The current configuration
   */  /**
   * Gets the current configuration
   * @returns The current configuration
   */
  getConfig(): AppConfig | null {
    const config = this.configSubject.getValue();
    if (!config) {
      return null;
    }
    
    return this.normalizeConfig(config);
  }

  /**
   * Get default configuration from environment
   */  /**
   * Gets default configuration from environment
   * @returns Default application configuration
   */
  private getDefaultConfig(): AppConfig {
    return {
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

  /**
   * Validates that a configuration object has all required fields
   * @param config The configuration to validate
   * @returns True if configuration is valid, false otherwise
   */
  private validateConfig(config: AppConfig): boolean {
    if (!config) {
      console.error('ConfigService: Configuration is null or undefined');
      return false;
    }

    // Validate required top-level fields
    const requiredFields: Array<keyof AppConfig> = ['baseUrl', 'features'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      console.error(`ConfigService: Configuration is missing required fields: ${missingFields.join(', ')}`);
      return false;
    }
    
    // Validate features object
    if (!config.features) {
      console.error('ConfigService: features object is missing');
      return false;
    }
    
    const requiredFeatures: Array<keyof AppConfig['features']> = ['enableFilters', 'enableSearch', 'enableDocDownload'];
    const missingFeatures = requiredFeatures.filter(feature => config.features[feature] === undefined);
    
    if (missingFeatures.length > 0) {
      console.warn(`ConfigService: features object is missing fields: ${missingFeatures.join(', ')}`);
      // Not failing validation for missing feature flags, just warning
    }
    
    // Validate arrays
    if (config.apiEndpoints && !Array.isArray(config.apiEndpoints)) {
      console.error('ConfigService: apiEndpoints is not an array');
      return false;
    }
    
    if (config.modelUris && !Array.isArray(config.modelUris)) {
      console.error('ConfigService: modelUris is not an array');
      return false;
    }

    return true;
  }
}
