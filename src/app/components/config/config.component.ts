import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConfigService, AppConfig } from '../../services/config.service';
import { BaseUrlService } from '../../services/base-url.service';
import { Router } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-config',
  standalone: true,  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss'
})
export class ConfigComponent implements OnInit {
  configForm!: FormGroup;
  restartRequired = false;
  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private baseUrlService: BaseUrlService,
    private router: Router
  ) {}
  async ngOnInit(): Promise<void> {
    // Load configuration asynchronously first
    let config = this.configService.getConfig();
    if (!config) {
      // Try to load from default config.json if not already loaded
      config = await this.configService.loadConfigFromJson('/config.json');
    }
    
    this.configForm = this.fb.group({
      apiEndpoints: this.fb.array((config?.apiEndpoints || []).map(url => this.fb.control(url, [Validators.required, Validators.pattern('https?://.*')])), Validators.required),
      modelUris: this.fb.array((config?.modelUris || []).map(url => this.fb.control(url, [Validators.required])), Validators.required),
      baseUrl: [config?.baseUrl || '/', [Validators.required]]
    });
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
        };
        this.configService.saveConfig(config);
        if (oldBaseUrl !== baseUrl) {
          this.baseUrlService.updateBaseHref();
          this.restartRequired = true;
        }        this.showNotification(
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
}
