import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, HostListener, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed, effect, inject, Injector } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule, Location } from '@angular/common';
import { ConfigService, AppConfig } from '../../services/config.service';
import { BaseUrlService } from '../../services/base-url.service';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toSignal, toObservable } from '@angular/core/rxjs-interop';
import { Observable, BehaviorSubject, firstValueFrom, filter } from 'rxjs';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfigComponent implements OnInit, OnDestroy {
  /** Form for configuration settings */
  configForm!: FormGroup;
  /** Flag indicating if restart is required */
  restartRequired = signal(false);

  /** Flag indicating if config is loading */
  loading = signal(true);

  /** Error message if config load failed */
  error = signal<string | null>(null);

  /** Original configuration for comparison */
  private originalConfig = signal<AppConfig | null>(null);

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private baseUrlService: BaseUrlService,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    event.preventDefault();
    this.onCancel();
  }  /**
   * Computed property for form validity
   */  formValid = computed(() => this.configForm?.valid ?? false);

  // Injector for use with runInInjectionContext
  private injector = inject(Injector);

  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(null);

    // Set up subscription to loading state using toSignal
    const loadingSignal = toSignal(
      toObservable(this.configService.loading).pipe(
        takeUntilDestroyed()
      ),
      { initialValue: true }
    );

    // Set up subscription to error state using toSignal
    const errorSignal = toSignal(
      toObservable(this.configService.error).pipe(
        takeUntilDestroyed()
      ),
      { initialValue: null }
    );

    // Create an effect to handle loading state updates
    effect(() => {
      const isLoading = loadingSignal();
      this.loading.set(isLoading);
      this.cdr.markForCheck();
    }, { injector: this.injector });

    // Create an effect to handle error state updates
    effect(() => {
      const err = errorSignal();
      if (err) {
        this.error.set(err.message);
      } else {
        this.error.set(null);
      }
      this.cdr.markForCheck();
    }, { injector: this.injector });

    // Initialize configuration - must be after effects are set up
    setTimeout(() => this.initializeConfig(), 0);
  }
    /**
   * Initializes configuration and form
   * Implements enhanced error handling and diagnostics
   */
  private async initializeConfig(): Promise<void> {
    console.log('ConfigComponent: Starting configuration initialization');
    try {
      // First check if we already have a loaded configuration
      let config = this.configService.getConfig();
      console.log('ConfigComponent: Initial config state:', config ? 'Available' : 'Not available');

      if (!config) {
        console.log('ConfigComponent: Loading config from /config.json');
        try {
          // Try to load from default config.json if not already loaded
          // Set explicit timeout to ensure we don't hang indefinitely
          const configPromise = this.configService.loadConfigFromJson('/config.json');
          config = await Promise.race([
            configPromise,
            new Promise<AppConfig | null>((_, reject) =>
              setTimeout(() => reject(new Error('Configuration loading timed out after 15 seconds')), 15000)
            )
          ]);
          console.log('ConfigComponent: Config loaded successfully:', config);
        } catch (loadError) {
          console.error('ConfigComponent: Error loading from /config.json:', loadError);

          // Try loading from assets folder as fallback
          console.log('ConfigComponent: Attempting to load from /assets/config.json as fallback');
          try {
            config = await this.configService.loadConfigFromJson('/assets/config.json');
            console.log('ConfigComponent: Fallback config loaded successfully');
          } catch (fallbackError) {
            console.error('ConfigComponent: Fallback loading failed:', fallbackError);
            throw new Error('Could not load configuration from primary or fallback location');
          }
        }
      }

      if (!config) {
        throw new Error('Failed to load configuration - config object is null');
      }

      // Validate required configuration fields
      this.validateConfig(config);

      // Store the original configuration for comparison later
      this.originalConfig.set(structuredClone(config));
      console.log('ConfigComponent: Original config stored for comparison');

      // Initialize form with loaded configuration
      this.initializeForm(config);
    } catch (error) {
      console.error('ConfigComponent: Failed to load configuration:', error);
      this.error.set(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Create form with default values
      this.initializeForm(null);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  /**
   * Initializes the form with configuration values
   * @param config The configuration to use for initialization
   */
  private initializeForm(config: AppConfig | null): void {
    this.configForm = this.fb.group({
      apiEndpoints: this.fb.array(
        (config?.apiEndpoints || []).map(url =>
          this.fb.control(url, [Validators.required, Validators.pattern('https?://.*')])
        ) || [this.fb.control('', [Validators.required, Validators.pattern('https?://.*')])],
        Validators.required
      ),
      modelUris: this.fb.array(
        (config?.modelUris || []).map(url =>
          this.fb.control(url, [Validators.required])
        ) || [this.fb.control('', [Validators.required])],
        Validators.required
      ),
      baseUrl: [config?.baseUrl || '/', [Validators.required]]
    });

    this.cdr.markForCheck();
  }

  get apiEndpoints() {
    return this.configForm.get('apiEndpoints') as FormArray;
  }
  get modelUris() {
    return this.configForm.get('modelUris') as FormArray;
  }

  get apiEndpointControls() {
    return (this.configForm.get('apiEndpoints') as FormArray).controls as FormControl[];
  }
  get modelUriControls() {
    return (this.configForm.get('modelUris') as FormArray).controls as FormControl[];
  }

  addApiEndpoint() {
    this.apiEndpoints.push(this.fb.control('', [Validators.required, Validators.pattern('https?://.*')]));
  }
  removeApiEndpoint(index: number) {
    this.apiEndpoints.removeAt(index);
  }
  moveApiEndpointUp(index: number) {
    if (index > 0) {
      const arr = this.apiEndpoints;
      const temp = arr.at(index - 1).value;
      arr.at(index - 1).setValue(arr.at(index).value);
      arr.at(index).setValue(temp);
    }
  }
  moveApiEndpointDown(index: number) {
    if (index < this.apiEndpoints.length - 1) {
      const arr = this.apiEndpoints;
      const temp = arr.at(index + 1).value;
      arr.at(index + 1).setValue(arr.at(index).value);
      arr.at(index).setValue(temp);
    }
  }

  addModelUri() {
    this.modelUris.push(this.fb.control('', [Validators.required]));
  }
  removeModelUri(index: number) {
    this.modelUris.removeAt(index);
  }
  moveModelUriUp(index: number) {
    if (index > 0) {
      const arr = this.modelUris;
      const temp = arr.at(index - 1).value;
      arr.at(index - 1).setValue(arr.at(index).value);
      arr.at(index).setValue(temp);
    }
  }
  moveModelUriDown(index: number) {
    if (index < this.modelUris.length - 1) {
      const arr = this.modelUris;
      const temp = arr.at(index + 1).value;
      arr.at(index + 1).setValue(arr.at(index).value);
      arr.at(index).setValue(temp);
    }
  }

  onSubmit(): void {
    if (this.configForm.valid) {
      try {
        const apiEndpoints = this.apiEndpoints.value.filter((v: string) => !!v);
        const modelUris = this.modelUris.value.filter((v: string) => !!v);
        const baseUrl = this.configForm.get('baseUrl')?.value;
        const oldBaseUrl = this.configService.getBaseUrl();
        const prevConfig = this.configService.getConfig() as Partial<AppConfig> || {};
        const config: AppConfig = {
          ...prevConfig,
          apiEndpoints,
          modelUris,
          baseUrl,
          defaultDocumentView: prevConfig.defaultDocumentView ?? true,
          features: prevConfig.features ?? { enableFilters: true, enableSearch: true, enableDocDownload: true }
        };        this.configService.saveConfig(config);
        if (oldBaseUrl !== baseUrl) {
          this.baseUrlService.updateBaseHref();
          this.restartRequired.set(true);
        }this.showNotification(
          'Configuration updated. Changes will apply to new requests, but you may need to refresh the page for all changes to take effect.'
        );
        setTimeout(() => this.router.navigate(['/']), 300); // Navigate to root after short delay
      } catch (error) {
        console.error('Error updating configuration:', error);
        this.showNotification('Failed to update configuration');
      }
    }
  }

  async resetToDefault(): Promise<void> {
    // Remove any locally cached config
    this.configService.resetToDefault();
    // Reload config from server (default config path)
    const config = await this.configService.loadConfigFromJson('/config.json');
    // Patch arrays by clearing and re-adding controls
    while (this.apiEndpoints.length > 0) this.apiEndpoints.removeAt(0);
    (config?.apiEndpoints || []).forEach((url: string) => this.apiEndpoints.push(this.fb.control(url, [Validators.required, Validators.pattern('https?://.*')])));
    while (this.modelUris.length > 0) this.modelUris.removeAt(0);
    (config?.modelUris || []).forEach((url: string) => this.modelUris.push(this.fb.control(url, [Validators.required])));
    this.configForm.patchValue({
      baseUrl: config?.baseUrl || '/'
    });    // Update base href
    this.baseUrlService.updateBaseHref();
    this.showNotification('Configuration reset to server defaults');
  }
  onCancel(): void {
    // Navigate back to the previous location
    this.location.back();
  }

  ngOnDestroy(): void {
    // Cleanup if needed - currently no subscriptions to clean up
  }

  private showNotification(message: string): void {
    // Simple notification using browser API or console
    console.log(message);

    // Alternative: Use browser notification API if available
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('xRegistry Configuration', { body: message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('xRegistry Configuration', { body: message });
          }
        });
      }
    }
  }

  /**
   * Validates that the configuration has all required fields
   * @param config The configuration to validate
   * @throws Error if validation fails
   */
  private validateConfig(config: AppConfig): void {
    const requiredFields: Array<keyof AppConfig> = ['baseUrl', 'features'];
    const missingFields = requiredFields.filter(field => !config[field]);

    if (missingFields.length > 0) {
      throw new Error(`Configuration is missing required fields: ${missingFields.join(', ')}`);
    }

    if (!config.apiEndpoints || !Array.isArray(config.apiEndpoints)) {
      console.warn('ConfigComponent: apiEndpoints is missing or not an array, initializing as empty array');
      config.apiEndpoints = [];
    }

    if (!config.modelUris || !Array.isArray(config.modelUris)) {
      console.warn('ConfigComponent: modelUris is missing or not an array, initializing as empty array');
      config.modelUris = [];
    }

    if (!config.features) {
      console.warn('ConfigComponent: features object is missing, initializing with defaults');
      config.features = {
        enableFilters: true,
        enableSearch: true,
        enableDocDownload: true
      };
    }
  }
}
