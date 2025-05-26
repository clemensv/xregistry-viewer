import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DebugService {
  private debugEnabled = environment.debugMode;

  /**
   * Logs to console only if debug mode is enabled
   */
  log(...args: any[]): void {
    if (this.debugEnabled) {
      console.log(...args);
    }
  }

  /**
   * Logs warnings to console only if debug mode is enabled
   */
  warn(...args: any[]): void {
    if (this.debugEnabled) {
      console.warn(...args);
    }
  }

  /**
   * Logs errors to console only if debug mode is enabled
   */
  error(...args: any[]): void {
    if (this.debugEnabled) {
      console.error(...args);
    }
  }

  /**
   * Returns whether debug mode is currently enabled
   */
  isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  /**
   * Enables or disables debug mode at runtime
   */
  setDebugMode(enabled: boolean): void {
    this.debugEnabled = enabled;
  }
}
