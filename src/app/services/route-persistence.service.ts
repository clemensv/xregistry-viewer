import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class RoutePersistenceService {
  private readonly ROUTE_STORAGE_KEY = 'xregistry_last_route';
  private readonly NAVIGATION_TYPE_KEY = 'xregistry_nav_type';
  private isBrowser: boolean;
  private hasRestoredRoute = false;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      this.initializeRouteTracking();
      this.detectNavigationType();
    }
  }

  /**
   * Detect if this is a page reload vs direct navigation
   */
  private detectNavigationType(): void {
    if (!this.isBrowser) return;

    try {
      // Mark this as a direct navigation (not a reload)
      sessionStorage.setItem(this.NAVIGATION_TYPE_KEY, 'direct');

      // Listen for beforeunload to detect when user leaves
      window.addEventListener('beforeunload', () => {
        // Mark that the next load will be a reload
        sessionStorage.setItem(this.NAVIGATION_TYPE_KEY, 'reload');
      });
    } catch (error) {
      console.warn('Failed to set navigation type:', error);
    }
  }

  /**
   * Initialize route tracking to store current route in sessionStorage
   */
  private initializeRouteTracking(): void {
    // Listen to navigation events and store the route
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        // Don't store root route or routes that are just redirects
        if (event.url !== '/' && event.url !== '' && !event.url.startsWith('/?')) {
          this.storeRoute(event.url);
        }
      });
  }

  /**
   * Store the current route in sessionStorage
   */
  private storeRoute(url: string): void {
    if (!this.isBrowser) return;

    try {
      sessionStorage.setItem(this.ROUTE_STORAGE_KEY, url);
    } catch (error) {
      console.warn('Failed to store route in sessionStorage:', error);
    }
  }

    /**
   * Restore the last route if application was reloaded
   * Should be called during app initialization
   */
  restoreRoute(): void {
    if (!this.isBrowser || this.hasRestoredRoute) return;

    this.hasRestoredRoute = true;

    try {
      const storedRoute = sessionStorage.getItem(this.ROUTE_STORAGE_KEY);
      const navigationType = sessionStorage.getItem(this.NAVIGATION_TYPE_KEY);
      const currentUrl = this.router.url;
      const currentLocation = window.location.pathname;

      // Only restore if:
      // 1. We have a stored route
      // 2. This was marked as a reload (not direct navigation)
      // 3. We're currently at the root (indicating a reload to the base URL)
      const isReload = navigationType === 'reload';
      const atRoot = (currentUrl === '/' || currentUrl === '') && (currentLocation === '/' || currentLocation === '');

      if (storedRoute && isReload && atRoot) {
        console.log('RoutePersistenceService: Detected page reload at root, restoring route:', storedRoute);

        // Navigate to the stored route
        this.router.navigateByUrl(storedRoute).then(success => {
          if (success) {
            console.log('RoutePersistenceService: Successfully restored route');
          } else {
            console.warn('RoutePersistenceService: Failed to restore route');
          }
        }).catch(error => {
          console.error('RoutePersistenceService: Error restoring route:', error);
        });
      } else {
        console.log('RoutePersistenceService: Not restoring route - isReload:', isReload, 'atRoot:', atRoot, 'storedRoute:', !!storedRoute);
      }

      // Reset navigation type for next time
      sessionStorage.setItem(this.NAVIGATION_TYPE_KEY, 'direct');
    } catch (error) {
      console.warn('RoutePersistenceService: Failed to restore route from sessionStorage:', error);
    }
  }

  /**
   * Clear the stored route (useful for logout or explicit navigation to home)
   */
  clearStoredRoute(): void {
    if (!this.isBrowser) return;

    try {
      sessionStorage.removeItem(this.ROUTE_STORAGE_KEY);
      sessionStorage.removeItem(this.NAVIGATION_TYPE_KEY);
    } catch (error) {
      console.warn('Failed to clear stored route:', error);
    }
  }

  /**
   * Get the currently stored route without navigating to it
   */
  getStoredRoute(): string | null {
    if (!this.isBrowser) return null;

    try {
      return sessionStorage.getItem(this.ROUTE_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to get stored route:', error);
      return null;
    }
  }
}
