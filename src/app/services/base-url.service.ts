import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ConfigService } from './config.service';

/**
 * Service to manage the application's base URL
 * Handles dynamic updating of the base href element and ensures consistency
 */
@Injectable({
  providedIn: 'root'
})
export class BaseUrlService {
  constructor(
    @Inject(DOCUMENT) private document: Document,
    private configService: ConfigService
  ) {}  /**
   * Update the base href in the document head based on the
   * configured base URL with enhanced validation and error handling
   * @returns true if successful, false otherwise
   */
  updateBaseHref(): boolean {
    try {
      // Get base URL from config service
      const baseUrl = this.configService.getBaseUrl();
      if (!baseUrl) {
        console.error('BaseUrlService: Cannot update base href - base URL is empty or undefined');
        return false;
      }
      
      console.log(`BaseUrlService: Updating base href with URL: ${baseUrl}`);

      // Normalize the base URL to ensure it ends with a slash
      const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);
      console.log(`BaseUrlService: Normalized base URL: ${normalizedBaseUrl}`);

      // Validate the normalized URL
      if (!this.isValidBaseUrl(normalizedBaseUrl)) {
        console.error(`BaseUrlService: Invalid base URL format: ${normalizedBaseUrl}`);
        return false;
      }

      // Find the base element in the document head
      let baseElement = this.document.querySelector('base');
      console.log(`BaseUrlService: Base element found: ${!!baseElement}`);

      // If no base element exists, create one
      if (!baseElement) {
        console.log('BaseUrlService: Creating new base element');
        baseElement = this.document.createElement('base');
        this.document.head.appendChild(baseElement);
      }
      
      // Get the current href for comparison
      const currentHref = baseElement.getAttribute('href');
      
      // If the href is already set to the normalized URL, no need to update
      if (currentHref === normalizedBaseUrl) {
        console.log(`BaseUrlService: Base href already set to ${normalizedBaseUrl}`);
        return true;
      }
      
      // Update the href attribute
      baseElement.setAttribute('href', normalizedBaseUrl);
      console.log(`BaseUrlService: Base URL updated from "${currentHref}" to: "${normalizedBaseUrl}"`);
      
      // Verify the update was successful
      const newHref = baseElement.getAttribute('href');
      if (newHref !== normalizedBaseUrl) {
        console.error(`BaseUrlService: Failed to update base href. Expected "${normalizedBaseUrl}" but got "${newHref}"`);
        return false;
      }

      // Log the update for debugging
      console.info(`BaseUrlService: Base URL successfully set to: ${normalizedBaseUrl}`);
      
      // Update window location if necessary and we're at the root path
      if (window.location.pathname === '/' && normalizedBaseUrl !== '/' && !window.location.pathname.startsWith(normalizedBaseUrl)) {
        console.log(`BaseUrlService: Current path ${window.location.pathname} doesn't match base URL ${normalizedBaseUrl}, considering redirect`);
        // Only log the consideration, don't perform the redirect automatically as it can cause issues
      }
      
      return true;
    } catch (error) {
      console.error('BaseUrlService: Error updating base href:', error);
      return false;
    }
  }
  
  /**
   * Validates if a string is a valid base URL
   * @param url The URL to validate
   * @returns true if valid, false otherwise
   */
  private isValidBaseUrl(url: string): boolean {
    // Base URL must start with / or http:// or https://
    if (!url.startsWith('/') && !url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }
    
    // Base URL must end with /
    if (!url.endsWith('/')) {
      return false;
    }
    
    return true;
  }

  /**
   * Ensures the base URL has a trailing slash and is properly formatted
   */
  private normalizeBaseUrl(url: string): string {
    if (!url) {
      return '/';
    }

    // If the URL doesn't start with a slash and isn't a full URL, add a slash
    if (!url.startsWith('/') && !url.startsWith('http')) {
      url = '/' + url;
    }

    // Ensure the URL ends with a slash
    if (!url.endsWith('/')) {
      url = url + '/';
    }

    return url;
  }

  /**
   * Gets the asset URL path based on the current base URL
   * @param assetPath The relative path to the asset
   * @returns The full path to the asset
   */
  getAssetUrl(assetPath: string): string {
    const baseUrl = this.configService.getBaseUrl();

    // Remove leading slash from asset path if it exists
    const normalizedAssetPath = assetPath.startsWith('/')
      ? assetPath.substring(1)
      : assetPath;

    // Handle the case when baseUrl is '/'
    if (baseUrl === '/' || baseUrl === '') {
      return '/' + normalizedAssetPath;
    }

    // Normalize base URL
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);

    // Combine and return
    return normalizedBaseUrl + normalizedAssetPath;
  }

  /**
   * Resolves an asset path against the base URL
   * @param assetPath Relative path to an asset
   * @returns Full URL to the asset
   */
  resolveAssetUrl(assetPath: string): string {
    const baseUrl = this.configService.getBaseUrl();

    // Remove leading slash from asset path if needed
    const normalizedAssetPath = assetPath.startsWith('/')
      ? assetPath.substring(1)
      : assetPath;

    // If the asset URL starts with http, it's already an absolute URL
    if (normalizedAssetPath.startsWith('http')) {
      return normalizedAssetPath;
    }

    // Handle asset URLs with correct base path prefix
    return this.getAssetUrl(normalizedAssetPath);
  }
}
