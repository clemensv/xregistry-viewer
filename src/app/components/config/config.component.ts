import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, HostListener, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed, effect, inject, Injector, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormArray, Validators, ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { CommonModule, Location } from '@angular/common';
import { ConfigService, AppConfig } from '../../services/config.service';
import { BaseUrlService } from '../../services/base-url.service';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toSignal, toObservable } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { IconComponent } from '../icon/icon.component';
import { PageHeaderComponent } from '../page-header/page-header.component';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IconComponent,
    PageHeaderComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfigComponent implements OnInit, OnDestroy {
  @ViewChild('editInput') editInput!: ElementRef<HTMLInputElement>;

  /** Form array for API endpoints */
  apiEndpoints = new FormArray<FormControl<string | null>>([]);

  /** New endpoint input */
  newEndpointUrl = '';
  newEndpointError = '';
  validatingEndpoint = false;

  /** Editing state */
  editingIndex = -1;

  /** Endpoint status tracking */
  endpointStatus: { [index: number]: 'online' | 'offline' | 'checking' } = {};

  /** Flag indicating if config is loading */
  loading = signal(true);

  /** Error message if config load failed */
  error = signal<string | null>(null);

  /** Original configuration for comparison */
  private originalConfig = signal<AppConfig | null>(null);

  // Injector for use with effects
  private injector = inject(Injector);

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private baseUrlService: BaseUrlService,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {
    // Set up effects in constructor after services are injected
    this.setupEffects();
  }

  private setupEffects(): void {
    // Loading signal setup
    const loadingSignal = toSignal(
      toObservable(this.configService.loading).pipe(
        takeUntilDestroyed()
      ),
      { initialValue: true }
    );

    // Error signal setup
    const errorSignal = toSignal(
      toObservable(this.configService.error).pipe(
        takeUntilDestroyed()
      ),
      { initialValue: null }
    );

    // Set up effects
    effect(() => {
      const isLoading = loadingSignal();
      this.loading.set(isLoading);
      this.cdr.markForCheck();
    }, { injector: this.injector });

    effect(() => {
      const err = errorSignal();
      if (err) {
        this.error.set(err.message);
      } else {
        this.error.set(null);
      }
      this.cdr.markForCheck();
    }, { injector: this.injector });
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.editingIndex >= 0) {
      this.cancelEdit();
      event.preventDefault();
    }
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(null);

    // Initialize configuration asynchronously
    setTimeout(() => this.initializeConfig(), 0);
  }

  /**
   * Initializes configuration and form
   */
  private async initializeConfig(): Promise<void> {
    try {
      let config = this.configService.getConfig();

      if (!config) {
        console.log('ConfigComponent: No config found in service, loading from JSON...');
        try {
          config = await this.configService.loadConfigFromJson('/config.json');
          console.log('ConfigComponent: Successfully loaded config from /config.json:', config);
        } catch (loadError) {
          console.error('ConfigComponent: Error loading from /config.json:', loadError);
          try {
            config = await this.configService.loadConfigFromJson('/assets/config.json');
            console.log('ConfigComponent: Successfully loaded config from /assets/config.json:', config);
          } catch (fallbackError) {
            console.error('ConfigComponent: Fallback loading failed:', fallbackError);

            // Use default config as last resort
            console.log('ConfigComponent: Using default configuration');
            config = {
              apiEndpoints: [],
              modelUris: [],
              baseUrl: '/',
              defaultDocumentView: true,
              features: {
                enableFilters: true,
                enableSearch: true,
                enableDocDownload: true
              }
            };
          }
        }
      } else {
        console.log('ConfigComponent: Using existing config from service:', config);
      }

      if (!config) {
        throw new Error('Failed to load configuration - config object is null');
      }

      this.validateConfig(config);
      this.originalConfig.set(structuredClone(config));
      this.initializeEndpoints(config);
      console.log('ConfigComponent: Configuration initialized successfully');
    } catch (error) {
      console.error('ConfigComponent: Failed to load configuration:', error);
      this.error.set(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Initialize with empty endpoints for editing
      this.initializeEndpoints({ apiEndpoints: [], modelUris: [], baseUrl: '/', defaultDocumentView: true, features: { enableFilters: true, enableSearch: true, enableDocDownload: true } });
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  /**
   * Initializes the endpoints form array
   */
  private initializeEndpoints(config: AppConfig): void {
    // Clear existing endpoints
    while (this.apiEndpoints.length > 0) {
      this.apiEndpoints.removeAt(0);
    }

    // Add endpoints from config
    (config.apiEndpoints || []).forEach(url => {
      this.apiEndpoints.push(this.fb.control(url, [Validators.required, Validators.pattern('https?://.*')]) as FormControl<string | null>);
    });

    // Start status checking for all endpoints
    this.checkAllEndpointStatus();
    this.cdr.markForCheck();
  }

  /**
   * Validates a new endpoint URL
   */
  validateNewEndpoint(): void {
    this.newEndpointError = '';

    if (!this.newEndpointUrl) {
      return;
    }

    // Basic URL validation
    try {
      const url = new URL(this.newEndpointUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        this.newEndpointError = 'URL must use HTTP or HTTPS protocol';
        return;
      }
    } catch {
      this.newEndpointError = 'Please enter a valid URL';
      return;
    }

    // Check if already exists
    const exists = this.apiEndpoints.controls.some(control => control.value === this.newEndpointUrl);
    if (exists) {
      this.newEndpointError = 'This endpoint already exists';
      return;
    }
  }

  /**
   * Adds a new endpoint after validation
   */
  async addEndpoint(): Promise<void> {
    this.validateNewEndpoint();

    if (this.newEndpointError || !this.newEndpointUrl) {
      return;
    }

    this.validatingEndpoint = true;
    this.cdr.markForCheck();

    try {
      // Validate CORS and endpoint
      await this.validateEndpointCors(this.newEndpointUrl);

      // Add to form array
      const newControl = this.fb.control(this.newEndpointUrl, [Validators.required, Validators.pattern('https?://.*')]) as FormControl<string | null>;
      this.apiEndpoints.push(newControl);

      // Immediately save to config service
      this.saveConfigurationImmediately();

      // Check status for new endpoint
      const newIndex = this.apiEndpoints.length - 1;
      this.checkEndpointStatus(newIndex);

      // Clear input
      this.newEndpointUrl = '';
      this.newEndpointError = '';

      console.log('Endpoint added and saved successfully');
    } catch (error) {
      this.newEndpointError = error instanceof Error ? error.message : 'Failed to validate endpoint';
    } finally {
      this.validatingEndpoint = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Validates that an endpoint supports CORS
   */
  private async validateEndpointCors(url: string): Promise<void> {
    try {
      // Try a simple HEAD request to check CORS
      const testUrl = url.endsWith('/') ? url + 'ping' : url + '/ping';

      await this.http.head(testUrl, {
        observe: 'response',
        responseType: 'text'
      }).toPromise();

    } catch (error: any) {
      // If we get a CORS error, that's actually expected for many valid endpoints
      // Check if it's a network error vs CORS issue
      if (error.status === 0) {
        // Could be CORS or network issue - try to be more lenient
        console.warn('CORS validation warning for', url, error);
        // Don't throw error for CORS issues as many valid endpoints may not have CORS enabled for HEAD requests
      } else if (error.status >= 400 && error.status < 500) {
        // Client error - endpoint might not support the test path, but server is reachable
        console.log('Endpoint reachable but test path not supported:', url);
      } else {
        throw new Error('Unable to reach endpoint. Please check the URL and try again.');
      }
    }
  }

  /**
   * Checks the status of all endpoints
   */
  private checkAllEndpointStatus(): void {
    this.apiEndpoints.controls.forEach((_, index) => {
      this.checkEndpointStatus(index);
    });
  }

  /**
   * Checks the status of a specific endpoint
   */
  private async checkEndpointStatus(index: number): Promise<void> {
    const endpoint = this.apiEndpoints.at(index);
    if (!endpoint || !endpoint.value) return;

    const url = endpoint.value;
    this.endpointStatus[index] = 'checking';
    this.cdr.markForCheck();

    try {
      // Try a simple HEAD request
      await this.http.head(url, {
        observe: 'response',
        responseType: 'text'
      }).toPromise();

      this.endpointStatus[index] = 'online';
    } catch (error) {
      this.endpointStatus[index] = 'offline';
    }

    this.cdr.markForCheck();
  }

  /**
   * Moves an endpoint up in the list
   */
  moveUp(index: number): void {
    if (index > 0) {
      const control = this.apiEndpoints.at(index);
      this.apiEndpoints.removeAt(index);
      this.apiEndpoints.insert(index - 1, control);

      // Update status tracking
      const status = this.endpointStatus[index];
      delete this.endpointStatus[index];
      this.endpointStatus[index - 1] = status;

      // Immediately save to config service
      this.saveConfigurationImmediately();
    }
  }

  /**
   * Moves an endpoint down in the list
   */
  moveDown(index: number): void {
    if (index < this.apiEndpoints.length - 1) {
      const control = this.apiEndpoints.at(index);
      this.apiEndpoints.removeAt(index);
      this.apiEndpoints.insert(index + 1, control);

      // Update status tracking
      const status = this.endpointStatus[index];
      delete this.endpointStatus[index];
      this.endpointStatus[index + 1] = status;

      // Immediately save to config service
      this.saveConfigurationImmediately();
    }
  }

  /**
   * Starts editing an endpoint
   */
  editEndpoint(index: number): void {
    this.editingIndex = index;
    this.cdr.markForCheck();

    // Focus the input after view update
    setTimeout(() => {
      if (this.editInput?.nativeElement) {
        this.editInput.nativeElement.focus();
        this.editInput.nativeElement.select();
      }
    }, 0);
  }

  /**
   * Saves the edit and immediately persists to config
   */
  saveEdit(index: number): void {
    if (this.editingIndex === index) {
      const control = this.apiEndpoints.at(index);
      if (control && control.valid) {
        // Immediately save to config service
        this.saveConfigurationImmediately();
        // Recheck status for the updated endpoint
        this.checkEndpointStatus(index);
      }
      this.editingIndex = -1;
      this.cdr.markForCheck();
    }
  }

  /**
   * Cancels the edit
   */
  cancelEdit(): void {
    this.editingIndex = -1;
    this.cdr.markForCheck();
  }

  /**
   * Removes an endpoint and immediately saves
   */
  removeEndpoint(index: number): void {
    this.apiEndpoints.removeAt(index);
    delete this.endpointStatus[index];

    // Shift status indices down
    const newStatus: { [index: number]: 'online' | 'offline' | 'checking' } = {};
    Object.keys(this.endpointStatus).forEach(key => {
      const idx = parseInt(key);
      if (idx > index) {
        newStatus[idx - 1] = this.endpointStatus[idx];
      } else if (idx < index) {
        newStatus[idx] = this.endpointStatus[idx];
      }
    });
    this.endpointStatus = newStatus;

    // Immediately save to config service
    this.saveConfigurationImmediately();
    this.cdr.markForCheck();
  }

  /**
   * Resets to default configuration
   */
  async resetToDefaults(): Promise<void> {
    try {
      this.configService.resetToDefault();
      const config = await this.configService.loadConfigFromJson('/config.json');
      if (config) {
        this.initializeEndpoints(config);
        this.originalConfig.set(structuredClone(config));
        this.showNotification('Configuration reset to defaults');
      } else {
        throw new Error('Failed to load default configuration');
      }
    } catch (error) {
      console.error('Error resetting configuration:', error);
      this.showNotification('Failed to reset configuration');
    }
  }

  ngOnDestroy(): void {
    // Cleanup handled by takeUntilDestroyed
  }

  private showNotification(message: string): void {
    console.log(message);
  }

  private validateConfig(config: AppConfig): void {
    if (!config.apiEndpoints || !Array.isArray(config.apiEndpoints)) {
      config.apiEndpoints = [];
    }

    if (!config.features) {
      config.features = {
        enableFilters: true,
        enableSearch: true,
        enableDocDownload: true
      };
    }
  }

  /**
   * Gets the appropriate status icon for an endpoint
   */
  getStatusIcon(index: number): string {
    const status = this.endpointStatus[index];
    switch (status) {
      case 'online':
        return 'checkmark_circle';
      case 'offline':
        return 'error_circle';
      case 'checking':
      default:
        return 'clock';
    }
  }

  updateEndpointValue(index: number, event: any): void {
    const control = this.apiEndpoints.at(index);
    if (control) {
      control.setValue(event.target.value);
    }
  }

  getStatusText(index: number): string {
    const status = this.endpointStatus[index];
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  }

  /**
   * Immediately saves current configuration
   */
  private saveConfigurationImmediately(): void {
    try {
      const apiEndpoints = this.apiEndpoints.value.filter((v: string | null) => !!v) as string[];
      const prevConfig = this.configService.getConfig() as Partial<AppConfig> || {};

      const config: AppConfig = {
        ...prevConfig,
        apiEndpoints,
        baseUrl: prevConfig.baseUrl || '/',
        defaultDocumentView: prevConfig.defaultDocumentView ?? true,
        features: prevConfig.features ?? {
          enableFilters: true,
          enableSearch: true,
          enableDocDownload: true
        }
      };

      this.configService.saveConfig(config);
      this.originalConfig.set(structuredClone(config));
    } catch (error) {
      console.error('Error saving configuration immediately:', error);
    }
  }
}
