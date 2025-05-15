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
  ) {}

  /**
   * Update the base href in the document head based on the
   * configured base URL
   */
  updateBaseHref(): void {
    const baseUrl = this.configService.getBaseUrl();
    
    // Normalize the base URL to ensure it ends with a slash
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);
    
    // Find the base element in the document head
    let baseElement = this.document.querySelector('base');
    
    // If no base element exists, create one
    if (!baseElement) {
      baseElement = this.document.createElement('base');
      this.document.head.appendChild(baseElement);
    }
    
    // Update the href attribute
    baseElement.setAttribute('href', normalizedBaseUrl);
    
    // Log the update for debugging
    console.info(`Base URL set to: ${normalizedBaseUrl}`);
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
