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
          <img src="assets/xregistry-logo.svg" alt="xRegistry Logo" class="logo" />
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
    // Load configuration
    this.configService.loadConfigFromJson('/config.json')
      .then(config => {
        this.configLoaded = true;
        this.debug.log('Configuration loaded successfully:', config);

        // Update base URL
        this.baseUrlService.updateBaseHref();

        // Navigate to home page after a brief delay
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 1000);
      })
      .catch(err => {
        this.error = 'Failed to load application configuration. Please try again.';
        this.debug.error('Error loading configuration:', err);
      });
  }
}
