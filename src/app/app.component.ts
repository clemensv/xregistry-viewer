import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { BreadcrumbComponent } from './components/breadcrumb/breadcrumb.component';
import { FooterComponent } from './components/footer/footer.component';
import { FontService } from './services/font.service';
import { ThemeService } from './services/theme.service';
import { ConfigService } from './services/config.service';
import { BaseUrlService } from './services/base-url.service';
import { ModelService } from './services/model.service';
import { CommonModule } from '@angular/common';
import { BootstrapComponent } from './components/bootstrap/bootstrap.component';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, HeaderComponent, BreadcrumbComponent, FooterComponent, BootstrapComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
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

  private loadConfiguration(): void {
    this.configService.loadConfigFromJson('/config.json')
      .then(config => {
        console.log('AppComponent: Configuration loaded successfully:', config);
        console.log('AppComponent: Config has', config?.apiEndpoints?.length || 0, 'API endpoints');

        // Clear ModelService cache so it can reload with the new configuration
        this.modelService.clearCache();
        this.configLoaded = true;

        // Update base URL
        this.baseUrlService.updateBaseHref();
      })
      .catch(err => {
        this.configError = 'Failed to load application configuration.';
        console.error('Error loading configuration:', err);
        // Use default config to allow app to function
        this.configLoaded = true;
      });
  }
}
