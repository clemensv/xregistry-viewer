import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private apiBaseUrlSubject = new BehaviorSubject<string>(environment.apiBaseUrl);
  public apiBaseUrl$: Observable<string> = this.apiBaseUrlSubject.asObservable();
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Load from local storage if available and in browser environment
    if (this.isBrowser) {
      const savedApiBaseUrl = localStorage.getItem('apiBaseUrl');
      if (savedApiBaseUrl) {
        this.apiBaseUrlSubject.next(savedApiBaseUrl);
      }
    }
  }
  getApiBaseUrl(): string {
    return this.apiBaseUrlSubject.value;
  }
  setApiBaseUrl(url: string): void {
    // Validate URL - be more forgiving with relative URLs
    try {
      // For relative URLs, we'll just accept them
      if (url.startsWith('/')) {
        this.apiBaseUrlSubject.next(url);
        if (this.isBrowser) {
          localStorage.setItem('apiBaseUrl', url);
        }
        return;
      }

      // For absolute URLs, attempt to validate
      new URL(url); // This will throw if the URL is invalid
      this.apiBaseUrlSubject.next(url);
      if (this.isBrowser) {
        localStorage.setItem('apiBaseUrl', url);
      }
    } catch (e) {
      console.error('Invalid URL format:', url);
      throw new Error('Invalid URL format');
    }
  }

  resetToDefault(): void {
    this.apiBaseUrlSubject.next(environment.apiBaseUrl);
    if (this.isBrowser) {
      localStorage.removeItem('apiBaseUrl');
    }
  }
}
