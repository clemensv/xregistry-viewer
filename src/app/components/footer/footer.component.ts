import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';
import { CapabilitiesService } from '../../services/capabilities.service';
import { ConfigService } from '../../services/config.service';
import { Observable } from 'rxjs';
import { Capabilities } from '../../models/registry.model';

@Component({
  standalone: true,
  selector: 'app-footer',
  imports: [CommonModule, MatToolbarModule, MatDividerModule, RouterModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  capabilities$!: Observable<Capabilities>;

  constructor(
    private capabilitiesService: CapabilitiesService,
    private configService: ConfigService
  ) {}

  ngOnInit(): void {
    this.capabilities$ = this.capabilitiesService.getCapabilities();
  }

  /**
   * Check if an API endpoint should be handled as an internal route
   */
  isInternalRoute(api: string): boolean {
    const internalRoutes = ['/model', 'model'];
    return internalRoutes.includes(api) || internalRoutes.includes('/' + api);
  }

  /**
   * Get the internal route path for an API endpoint
   */
  getInternalRoute(api: string): string {
    // Remove leading slash if present and return the route
    const route = api.startsWith('/') ? api.substring(1) : api;
    return '/' + route;
  }

  /**
   * Get the external API URL for an API endpoint
   */
  getExternalApiUrl(api: string): string {
    const config = this.configService.getConfig();
    const baseUrl = config?.apiEndpoints?.[0] || '';

    // Ensure the API path starts with a slash
    const apiPath = api.startsWith('/') ? api : '/' + api;
    return baseUrl + apiPath;
  }
}
