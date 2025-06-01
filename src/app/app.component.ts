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
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
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

  private loadConfiguration(): void {
    this.configService.loadConfigFromJson('/config.json')
      .then(config => {
        this.debug.log('AppComponent: Configuration loaded successfully:', config);
        this.debug.log('AppComponent: Config has', config?.apiEndpoints?.length || 0, 'API endpoints');

        // Clear ModelService cache so it can reload with the new configuration
        this.modelService.clearAllCaches();
        this.configLoaded = true;

        // Update base URL
        this.baseUrlService.updateBaseHref();

        // Restore route after configuration is loaded (delay to ensure router has processed initial navigation)
        if (this.isBrowser) {
          setTimeout(() => {
            this.routePersistenceService.restoreRoute();
          }, 500);
        }
      })
      .catch(err => {
        this.configError = 'Failed to load application configuration.';
        this.debug.error('Error loading configuration:', err);
        // Use default config to allow app to function
        this.configLoaded = true;

        // Still try to restore route even with default config
        if (this.isBrowser) {
          setTimeout(() => {
            this.routePersistenceService.restoreRoute();
          }, 500);
        }
      });
  }
}
