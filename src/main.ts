import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { ConfigService } from './app/services/config.service';
import { BaseUrlService } from './app/services/base-url.service';
import { APP_INITIALIZER, importProvidersFrom } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

/**
 * Factory function to load configuration before app bootstrap
 * This ensures the base URL and API URL are set up before the app starts
 */
function configFactory(configService: ConfigService, baseUrlService: BaseUrlService) {
  return () => configService.loadConfigFromJson('/assets/config.json')
    .then(() => {
      // Update the base href after config is loaded
      baseUrlService.updateBaseHref();
      
      // Log successful initialization
      console.info('Application configuration loaded successfully');
    });
}

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...appConfig.providers,
    importProvidersFrom(HttpClientModule, RouterModule),
    {
      provide: APP_INITIALIZER,
      useFactory: configFactory,
      deps: [ConfigService, BaseUrlService],
      multi: true
    }
  ]
})
.catch((err) => console.error('Error bootstrapping app:', err));
