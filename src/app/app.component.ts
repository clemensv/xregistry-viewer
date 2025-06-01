import { Component, OnInit, Inject, PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { FontService } from './services/font.service';
import { ThemeService } from './services/theme.service';
import { ConfigService } from './services/config.service';
import { BaseUrlService } from './services/base-url.service';
import { ModelService } from './services/model.service';
import { RoutePersistenceService } from './services/route-persistence.service';
import { DebugService } from './services/debug.service';
import { CommonModule } from '@angular/common';
import { BootstrapComponent } from './components/bootstrap/bootstrap.component';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent, BootstrapComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: [`
    .config-error-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
      background-color: #f8f9fa;
    }

    .error-content {
      text-align: center;
      max-width: 600px;
      padding: 2rem;
      border-radius: 8px;
      background-color: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .error-content h2 {
      color: #dc3545;
      margin-bottom: 1rem;
    }

    .error-content button {
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .error-content button:hover {
      background-color: #0069d9;
    }

    .bootstrap-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1000;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'xregistry-viewer';
  private isBrowser: boolean;
  configLoaded = false;
  configError: string | null = null;

  constructor(
    private fontService: FontService,
    private themeService: ThemeService,
    private configService: ConfigService,
    private baseUrlService: BaseUrlService,
    private modelService: ModelService,
    private routePersistenceService: RoutePersistenceService,
    private debug: DebugService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    // Dynamically load Inter font if in browser
    this.fontService.loadInterFont();
    // Theme service is automatically initialized via dependency injection

    // Load configuration first
    this.loadConfiguration();
  }

  ngAfterViewInit() {
    // No need for extra checks here, just let it be empty
  }

  /**
   * Loads application configuration from available sources
   * Made public to allow template to trigger reloads
   */
  loadConfiguration(): void {
    // Check multiple possible locations for config.json
    const configLocations = ['/config.json', './config.json', 'config.json', '/assets/config.json'];

    // Log the base href - this can affect where files are loaded from
    const baseElement = document.querySelector('base');
    const baseHref = baseElement ? baseElement.getAttribute('href') : '/';
    this.debug.log(`AppComponent: Current base href is: ${baseHref}`);

    // First try to verify the config file exists at primary location
    const checkConfigUrl = '/config.json';

    this.debug.log(`AppComponent: Checking for config at ${checkConfigUrl}`);
    fetch(checkConfigUrl, {
      method: 'HEAD',
      // Add cache-busting to prevent cached responses
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    })
      .then(response => {
        if (response.ok) {
          this.debug.log(`AppComponent: Config file verified at ${checkConfigUrl}`);
          return this.loadConfigFile(checkConfigUrl);
        } else {
          this.debug.warn(`AppComponent: Config file not found at primary location ${checkConfigUrl}, status: ${response.status}`);
          throw new Error(`Config file not accessible at primary location: ${response.status}`);
        }
      })
      .catch(err => {
        this.debug.warn('AppComponent: Error checking primary config file:', err);
        // Try all config locations in sequence until one works
        this.tryConfigLocations(configLocations, 0);
      });
  }

  /**
   * Tries to load configuration from multiple possible locations
   * @param locations Array of configuration file locations to try
   * @param index Current index in the locations array
   */
  private tryConfigLocations(locations: string[], index: number): void {
    if (index >= locations.length) {
      // All locations failed, try to load from default location as last resort
      this.debug.error('AppComponent: All config locations failed, using last resort');
      this.loadConfigFile('/config.json')
        .catch(err => {
          this.debug.error('AppComponent: Last resort config load failed:', err);
          this.configError = 'Failed to load configuration from any location.';
          // Still mark as loaded so the app can function with defaults
          this.configLoaded = true;
        });
      return;
    }

    const location = locations[index];
    this.debug.log(`AppComponent: Trying config location: ${location}`);

    this.loadConfigFile(location)
      .then(() => {
        this.debug.log(`AppComponent: Successfully loaded config from ${location}`);
      })
      .catch(err => {
        this.debug.warn(`AppComponent: Failed to load from ${location}:`, err);
        // Try next location
        this.tryConfigLocations(locations, index + 1);
      });
  }

  /**
   * Loads configuration from a specific file path
   * @param configPath Path to the configuration file
   * @returns Promise that resolves when configuration is loaded
   */
  private loadConfigFile(configPath: string = '/config.json'): Promise<any> {
    this.debug.log(`AppComponent: Loading configuration from ${configPath}`);

    return this.configService.loadConfigFromJson(configPath)
      .then(config => {
        this.debug.log('AppComponent: Configuration loaded successfully:', config);
        this.debug.log('AppComponent: Config has', config?.apiEndpoints?.length || 0, 'API endpoints');

        // Clear ModelService cache so it can reload with the new configuration
        this.modelService.clearAllCaches();
        this.configLoaded = true;
        this.configError = null;

        // Update base URL - retry up to 3 times if it fails
        this.updateBaseHrefWithRetry(3);

        // Restore route after configuration is loaded (delay to ensure router has processed initial navigation)
        if (this.isBrowser) {
          setTimeout(() => {
            this.routePersistenceService.restoreRoute();
          }, 500);
        }

        return config;
      })
      .catch(err => {
        this.configError = `Failed to load application configuration from ${configPath}`;
        this.debug.error('AppComponent: Error loading configuration:', err);

        // Re-throw the error for the tryConfigLocations cascade
        throw err;
      });
  }

  /**
   * Updates the base href with retry logic
   * @param maxRetries Maximum number of retries
   * @param attempt Current attempt number
   */
  private updateBaseHrefWithRetry(maxRetries: number, attempt: number = 1): void {
    const success = this.baseUrlService.updateBaseHref();

    if (!success && attempt < maxRetries) {
      this.debug.warn(`AppComponent: Base href update failed, retry ${attempt} of ${maxRetries}`);
      setTimeout(() => {
        this.updateBaseHrefWithRetry(maxRetries, attempt + 1);
      }, 200 * attempt); // Increasing delay for each retry
    } else if (!success) {
      this.debug.error('AppComponent: Failed to update base href after multiple attempts');
    } else {
      this.debug.log('AppComponent: Base href updated successfully');
    }
  }
}
