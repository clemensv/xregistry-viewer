import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../../services/config.service';

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

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private snackBar: MatSnackBar
  ) {
    this.defaultApiUrl = this.configService.getApiBaseUrl();
  }

  ngOnInit(): void {
    this.configForm = this.fb.group({
      apiBaseUrl: [this.configService.getApiBaseUrl(), [Validators.required, Validators.pattern('https?://.*')]]
    });
  }

  onSubmit(): void {
    if (this.configForm.valid) {
      try {
        const newApiUrl = this.configForm.get('apiBaseUrl')?.value;
        this.configService.setApiBaseUrl(newApiUrl);
        this.snackBar.open('API URL updated successfully', 'Close', {
          duration: 3000
        });
      } catch (error) {
        this.snackBar.open('Failed to update API URL', 'Close', {
          duration: 3000
        });
      }
    }
  }

  resetToDefault(): void {
    this.configService.resetToDefault();
    this.configForm.patchValue({
      apiBaseUrl: this.defaultApiUrl
    });
    this.snackBar.open('Reset to default API URL', 'Close', {
      duration: 3000
    });
  }
}
