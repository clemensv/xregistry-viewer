import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, HostListener, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed, effect, inject, Injector } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule, Location } from '@angular/common';
import { ConfigService, AppConfig } from '../../services/config.service';
import { BaseUrlService } from '../../services/base-url.service';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toSignal, toObservable } from '@angular/core/rxjs-interop';

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

  // Injector for use with effects
  private injector = inject(Injector);

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private baseUrlService: BaseUrlService,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
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
    event.preventDefault();
    this.onCancel();
  }

  /**
   * Computed property for form validity
   */
  formValid = computed(() => this.configForm?.valid ?? false);
  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(null);
    
    // Initialize form immediately to prevent template errors
    this.initializeForm(null);
    
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
        try {
          config = await this.configService.loadConfigFromJson('/config.json');
        } catch (loadError) {
          console.error('ConfigComponent: Error loading from /config.json:', loadError);
          try {
            config = await this.configService.loadConfigFromJson('/assets/config.json');
          } catch (fallbackError) {
            console.error('ConfigComponent: Fallback loading failed:', fallbackError);
            throw new Error('Could not load configuration from primary or fallback location');
          }
        }
      }

      if (!config) {
        throw new Error('Failed to load configuration - config object is null');
      }

      this.validateConfig(config);
      this.originalConfig.set(structuredClone(config));
      this.initializeForm(config);
    } catch (error) {
      console.error('ConfigComponent: Failed to load configuration:', error);
      this.error.set(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.initializeForm(null);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  /**
   * Initializes the form with configuration values
   */
  private initializeForm(config: AppConfig | null = null): void {
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

  addModelUri() {
    this.modelUris.push(this.fb.control('', [Validators.required]));
  }

  removeModelUri(index: number) {
    this.modelUris.removeAt(index);
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
          features: prevConfig.features ?? { 
            enableFilters: true, 
            enableSearch: true, 
            enableDocDownload: true 
          }
        };

        this.configService.saveConfig(config);
        
        if (oldBaseUrl !== baseUrl) {
          this.baseUrlService.updateBaseHref();
          this.restartRequired.set(true);
        }

        this.showNotification('Configuration updated successfully');
        setTimeout(() => this.router.navigate(['/']), 300);
      } catch (error) {
        console.error('Error updating configuration:', error);
        this.showNotification('Failed to update configuration');
      }
    }
  }

  async resetToDefault(): Promise<void> {
    this.configService.resetToDefault();
    const config = await this.configService.loadConfigFromJson('/config.json');
    
    while (this.apiEndpoints.length > 0) this.apiEndpoints.removeAt(0);
    (config?.apiEndpoints || []).forEach((url: string) => 
      this.apiEndpoints.push(this.fb.control(url, [Validators.required, Validators.pattern('https?://.*')]))
    );
    
    while (this.modelUris.length > 0) this.modelUris.removeAt(0);
    (config?.modelUris || []).forEach((url: string) => 
      this.modelUris.push(this.fb.control(url, [Validators.required]))
    );
    
    this.configForm.patchValue({ baseUrl: config?.baseUrl || '/' });
    this.baseUrlService.updateBaseHref();
    this.showNotification('Configuration reset to defaults');
  }

  onCancel(): void {
    this.location.back();
  }

  ngOnDestroy(): void {
    // Cleanup handled by takeUntilDestroyed
  }

  private showNotification(message: string): void {
    console.log(message);
  }

  private validateConfig(config: AppConfig): void {
    const requiredFields: Array<keyof AppConfig> = ['baseUrl', 'features'];
    const missingFields = requiredFields.filter(field => !config[field]);

    if (missingFields.length > 0) {
      throw new Error(`Configuration is missing required fields: ${missingFields.join(', ')}`);
    }

    if (!config.apiEndpoints || !Array.isArray(config.apiEndpoints)) {
      config.apiEndpoints = [];
    }

    if (!config.modelUris || !Array.isArray(config.modelUris)) {
      config.modelUris = [];
    }

    if (!config.features) {
      config.features = {
        enableFilters: true,
        enableSearch: true,
        enableDocDownload: true
      };
    }
  }
}
