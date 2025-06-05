import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { DebugService } from '../../services/debug.service';

@Component({
  standalone: true,
  selector: 'app-url-debug',
  imports: [CommonModule],  template: `
    <div *ngIf="isDebugEnabled" style="padding: 20px; background: #f0f0f0; border: 1px solid #ccc; margin: 10px;">
      <h3>URL Debug Information</h3>
      <div><strong>Browser URL:</strong> {{ browserUrl }}</div>
      <div><strong>Angular Router URL:</strong> {{ routerUrl }}</div>
      <div><strong>Location Path:</strong> {{ locationPath }}</div>
      <div><strong>Route Params:</strong> {{ routeParams | json }}</div>
      <div><strong>URL Segments:</strong> {{ urlSegments | json }}</div>
      <div><strong>Are URLs in sync?:</strong> {{ urlsInSync ? 'YES' : 'NO' }}</div>
      <div><strong>Session Storage:</strong> {{ sessionStorageInfo | json }}</div>
      <button (click)="refreshDebugInfo()">Refresh Debug Info</button>
    </div>
  `
})
export class UrlDebugComponent implements OnInit {
  browserUrl: string = '';
  routerUrl: string = '';
  locationPath: string = '';
  routeParams: any = {};
  urlSegments: string[] = [];
  urlsInSync: boolean = false;
  sessionStorageInfo: any = {};
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private debug: DebugService
  ) {}
  ngOnInit(): void {
    this.refreshDebugInfo();
  }

  get isDebugEnabled(): boolean {
    return this.debug.isDebugEnabled();
  }

  refreshDebugInfo(): void {
    // Get browser URL from window
    this.browserUrl = typeof window !== 'undefined' ? window.location.pathname : 'N/A';

    // Get Angular router URL
    this.routerUrl = this.router.url;

    // Get location path
    this.locationPath = this.location.path();

    // Get route parameters
    this.routeParams = this.route.snapshot.params;

    // Get URL segments
    this.urlSegments = this.routerUrl.split('/').filter(seg => seg);

    // Check if URLs are in sync
    this.urlsInSync = this.browserUrl === this.routerUrl && this.routerUrl === this.locationPath;    // Get session storage info
    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.sessionStorageInfo = {
        storedRoute: sessionStorage.getItem('xregistry_last_route'),
        navigationType: sessionStorage.getItem('xregistry_nav_type'),
        allKeys: Object.keys(sessionStorage).filter(key => key.includes('xregistry'))
      };
    }

    // Only log to console if debug mode is enabled
    this.debug.log('=== URL DEBUG INFO ===');
    this.debug.log('Browser URL:', this.browserUrl);
    this.debug.log('Router URL:', this.routerUrl);
    this.debug.log('Location Path:', this.locationPath);
    this.debug.log('Route Params:', this.routeParams);
    this.debug.log('URL Segments:', this.urlSegments);
    this.debug.log('URLs in sync:', this.urlsInSync);
    this.debug.log('Session Storage:', this.sessionStorageInfo);
  }
}
