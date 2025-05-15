import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../../services/config.service';
import { BaseUrlService } from '../../services/base-url.service';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule
  ],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss'
})
export class ConfigComponent implements OnInit {
  configForm!: FormGroup;
  defaultApiUrl: string;
  defaultBaseUrl: string;
  restartRequired = false;

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private baseUrlService: BaseUrlService,
    private snackBar: MatSnackBar
  ) {
    this.defaultApiUrl = this.configService.getApiBaseUrl();
    this.defaultBaseUrl = this.configService.getBaseUrl();
  }
  ngOnInit(): void {
    this.configForm = this.fb.group({
      apiBaseUrl: [
        this.configService.getApiBaseUrl(), 
        [Validators.required, Validators.pattern('https?://.*')]
      ],
      baseUrl: [
        this.configService.getBaseUrl(),
        [Validators.required]
      ]
    });
  }

  onSubmit(): void {
    if (this.configForm.valid) {
      try {
        const newApiUrl = this.configForm.get('apiBaseUrl')?.value;
        const newBaseUrl = this.configForm.get('baseUrl')?.value;
        const oldBaseUrl = this.configService.getBaseUrl();
        
        // Update API URL
        this.configService.setApiBaseUrl(newApiUrl);
        
        // Update base URL
        this.configService.setBaseUrl(newBaseUrl);
        
        // If base URL changed, update the base href and show message
        if (oldBaseUrl !== newBaseUrl) {
          this.baseUrlService.updateBaseHref();
          this.restartRequired = true;
        }

        // Save changes to the configuration
        const config = this.configService.getConfig();
        if (config) {
          config.apiBaseUrl = newApiUrl;
          config.baseUrl = newBaseUrl;
          this.configService.saveConfig(config);
        }
          // Show success message
        this.snackBar.open(
          'Configuration updated. API and base URL changes will apply to new requests, but you may need to refresh the page for all changes to take effect.',
          'Close', 
          { duration: 7000 }
        );
      } catch (error) {
        console.error('Error updating configuration:', error);
        this.snackBar.open('Failed to update configuration', 'Close', {
          duration: 3000
        });
      }
    }
  }

  resetToDefault(): void {
    // Reset config to default values
    this.configService.resetToDefault();
    
    // Update the form
    this.configForm.patchValue({
      apiBaseUrl: this.defaultApiUrl,
      baseUrl: this.defaultBaseUrl
    });
    
    // Update base href
    this.baseUrlService.updateBaseHref();
    
    // Show a notification
    this.snackBar.open('Configuration reset to defaults', 'Close', {
      duration: 3000
    });
  }
}
