import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-api-tester',
  imports: [CommonModule],
  template: `
    <div class="api-tester" style="padding: 20px; margin: 20px; background: #f0f0f0; border: 1px solid #ccc;">
      <h2>API Test Results</h2>

      <div *ngIf="loading">
        Testing API endpoints, please wait...
      </div>

      <div *ngIf="!loading">
        <h3>Registry Model Test</h3>
        <div *ngIf="modelError" style="color: red;">
          <strong>Error:</strong> {{ modelError }}
        </div>
        <div *ngIf="modelData">
          <div><strong>Group Types:</strong> {{ groupTypes.join(', ') }}</div>
          <div *ngFor="let groupType of groupTypes">
            <strong>{{ groupType }} Resources:</strong> {{ getResourceTypes(groupType).join(', ') }}
          </div>
        </div>

        <h3>Configuration Test</h3>
        <div *ngIf="configError" style="color: red;">
          <strong>Error:</strong> {{ configError }}
        </div>
        <div *ngIf="configData">
          <div><strong>API Endpoints:</strong> {{ configData.apiEndpoints?.join(', ') }}</div>
          <div><strong>Base URL:</strong> {{ configData.baseUrl }}</div>
        </div>

        <h3>API Tests</h3>
        <div *ngFor="let test of apiTests">
          <div>
            <strong>{{ test.name }} ({{ test.url }}):</strong>
            <span [style.color]="test.status === 'Success' ? 'green' : 'red'">{{ test.status }}</span>
          </div>
          <div *ngIf="test.error" style="color: red; margin-left: 20px;">{{ test.error }}</div>
          <div *ngIf="test.data" style="margin-left: 20px;">
            <pre>{{ JSON.stringify(test.data, null, 2) | slice:0:200 }}{{ test.data.length > 200 ? '...' : '' }}</pre>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ApiTesterComponent implements OnInit {
  loading = true;
  modelData: any = null;
  modelError: string | null = null;
  configData: any = null;
  configError: string | null = null;
  JSON = JSON;

  apiTests: Array<{
    name: string;
    url: string;
    status: 'Success' | 'Error';
    data?: any;
    error?: string;
  }> = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.testConfig();
  }

  private testConfig() {
    this.http.get('/config.json').subscribe({
      next: (data: any) => {
        this.configData = data;
        console.log('Config loaded:', data);
        this.testModel();
      },
      error: (err) => {
        this.configError = err.message || 'Failed to load configuration';
        this.loading = false;
      }
    });
  }

  private testModel() {
    const apiBaseUrl = environment.apiBaseUrl || 'http://localhost:8080';

    this.http.get(`${apiBaseUrl}/model`).subscribe({
      next: (data: any) => {
        this.modelData = data;
        console.log('Model loaded:', data);
        this.testEndpoints();
      },
      error: (err) => {
        this.modelError = err.message || 'Failed to load registry model';
        this.testEndpoints();
      }
    });
  }

  private testEndpoints() {
    if (!this.configData || !this.configData.apiEndpoints || this.configData.apiEndpoints.length === 0) {
      this.loading = false;
      return;
    }

    // Test each endpoint
    const promises = this.configData.apiEndpoints.map((endpoint: string) => {
      return this.testEndpoint(endpoint);
    });

    Promise.all(promises).finally(() => {
      this.loading = false;
    });
  }

  private testEndpoint(endpoint: string) {
    return new Promise<void>((resolve) => {
      this.http.get(`${endpoint}`).subscribe({
        next: (data: any) => {
          this.apiTests.push({
            name: `Endpoint Test`,
            url: endpoint,
            status: 'Success',
            data: data
          });
          resolve();
        },
        error: (err) => {
          this.apiTests.push({
            name: `Endpoint Test`,
            url: endpoint,
            status: 'Error',
            error: err.message || 'Request failed'
          });
          resolve();
        }
      });
    });
  }

  get groupTypes(): string[] {
    if (!this.modelData || !this.modelData.groups) {
      return [];
    }
    return Object.keys(this.modelData.groups);
  }

  getResourceTypes(groupType: string): string[] {
    if (!this.modelData || !this.modelData.groups || !this.modelData.groups[groupType]) {
      return [];
    }
    return Object.keys(this.modelData.groups[groupType].resources || {});
  }
}
