import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../../services/config.service';
import { BaseUrlService } from '../../services/base-url.service';
import { DebugService } from '../../services/debug.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-bootstrap',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bootstrap-container">
      <div class="loading-container">
        <div class="logo-container">
          <img src="xregistry-logo.svg" alt="xRegistry Logo" class="logo" />
        </div>
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading application...</p>
        <p class="config-text" *ngIf="configLoaded">Configuration loaded, starting application...</p>
        <p class="error-text" *ngIf="error">{{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    .bootstrap-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f8f9fa;
      z-index: 9999;
    }

    .loading-container {
      text-align: center;
      padding: 2rem;
    }

    .logo-container {
      margin-bottom: 2rem;
    }

    .logo {
      max-width: 200px;
      height: auto;
    }

    .loading-spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 2s linear infinite;
      margin: 0 auto 1rem;
    }

    .loading-text {
      font-size: 1.2rem;
      color: #6c757d;
      margin-bottom: 0.5rem;
    }

    .config-text {
      font-size: 0.9rem;
      color: #28a745;
    }

    .error-text {
      color: #dc3545;
      margin-top: 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class BootstrapComponent implements OnInit {
  configLoaded = false;
  error: string | null = null;

  constructor(
    private configService: ConfigService,
    private baseUrlService: BaseUrlService,
    private debug: DebugService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Setup effect to monitor loading state from signal
    this.setupLoadingEffect();

    // Setup effect to monitor error state from signal
    this.setupErrorEffect();

    // Try multiple config locations in sequence
    this.tryLoadConfiguration(['/config.json', './config.json', '/assets/config.json']);
  }

  /**
   * Sets up effect to monitor loading state changes
   */
  private setupLoadingEffect(): void {
    // We'll use a simple polling approach since signals don't have subscribe
    const checkLoadingState = () => {
      const isLoading = this.configService.loading();

      // If not loading and config not yet marked as loaded, check if we have config
      if (!isLoading && !this.configLoaded) {
        const config = this.configService.getConfig();
        if (config) {
          this.handleSuccessfulConfigLoad(config);
        }
      }

      // Continue polling while not loaded
      if (!this.configLoaded) {
        setTimeout(checkLoadingState, 300);
      }
    };

    // Start the polling
    setTimeout(checkLoadingState, 300);
  }

  /**
   * Sets up effect to monitor error state changes
   */
  private setupErrorEffect(): void {
    // We'll use a simple polling approach for error state too
    const checkErrorState = () => {
      const currentError = this.configService.error();

      if (currentError && !this.error) {
        this.error = `Failed to load configuration: ${currentError.message}`;
        this.debug.error('Bootstrap: Configuration loading error:', currentError);
      }

      // Continue polling while not loaded
      if (!this.configLoaded) {
        setTimeout(checkErrorState, 500);
      }
    };

    // Start the polling
    setTimeout(checkErrorState, 500);
  }

  /**
   * Tries to load configuration from multiple locations
   * @param configPaths Array of paths to try loading config from
   * @param index Current index in the array
   */
  private tryLoadConfiguration(configPaths: string[], index: number = 0): void {
    if (index >= configPaths.length) {
      this.error = 'Failed to load application configuration from all possible locations.';
      this.debug.error('Bootstrap: All config locations failed');

      // Check if we have a fallback config
      const config = this.configService.getConfig();
      if (config) {
        this.debug.log('Bootstrap: Using fallback configuration');
        this.handleSuccessfulConfigLoad(config);
      }
      return;
    }

    const configPath = configPaths[index];
    this.debug.log(`Bootstrap: Attempting to load configuration from ${configPath}`);

    this.configService.loadConfigFromJson(configPath)
      .then(config => {
        if (config) {
          this.debug.log(`Bootstrap: Successfully loaded config from ${configPath}`, config);
          this.handleSuccessfulConfigLoad(config);
        } else {
          throw new Error('Config loaded but returned null');
        }
      })
      .catch(err => {
        this.debug.warn(`Bootstrap: Failed to load config from ${configPath}:`, err);
        // Try next location
        this.tryLoadConfiguration(configPaths, index + 1);
      });
  }

  /**
   * Handles successful configuration loading
   * @param config The loaded configuration
   */
  private handleSuccessfulConfigLoad(config: any): void {
    this.configLoaded = true;
    this.debug.log('Bootstrap: Configuration loaded successfully');

    // Update base URL
    const baseUrlUpdateSuccess = this.baseUrlService.updateBaseHref();
    if (!baseUrlUpdateSuccess) {
      this.debug.warn('Bootstrap: Failed to update base URL, but continuing');
    }

    // Check both router URL and browser location for deep link detection
    const currentUrl = this.router.url;
    const browserPath = window.location.pathname;
    this.debug.log('Bootstrap: URL check:', { currentUrl, browserPath });

    // Don't redirect if the user has navigated to a specific route (deep link)
    // Check browser path first as it's more reliable during initialization
    const isAtRoot = (browserPath === '/' || browserPath === '' || browserPath.startsWith('/?')) &&
                     (currentUrl === '/' || currentUrl === '' || currentUrl.startsWith('/?'));

    if (isAtRoot) {
      this.debug.log('Bootstrap: User is at root, navigating to home page');
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 1000);
    } else {
      this.debug.log('Bootstrap: User is on a specific route, not redirecting');
      // Just mark as loaded without redirecting
    }
  }
}
