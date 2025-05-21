import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationRef } from '@angular/core';

// Export the bootstrap function as the only export
export function bootstrap(): Promise<ApplicationRef> {
  return bootstrapApplication(AppComponent, config);
}
