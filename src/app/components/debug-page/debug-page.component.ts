import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-debug-page',
  imports: [CommonModule],
  template: `
    <div style="padding: 20px; background: #f0f0f0; margin: 20px;">
      <h2>Debug Page</h2>
      <h3>Route Parameters:</h3>
      <pre>{{ routeParams | json }}</pre>

      <h3>All Route Data:</h3>
      <pre>{{ routeData | json }}</pre>

      <h3>Current URL:</h3>
      <pre>{{ currentUrl }}</pre>
    </div>
  `
})
export class DebugPageComponent implements OnInit {
  routeParams: any = {};
  routeData: any = {};
  currentUrl: string = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    console.log('DebugPageComponent initialized');

    this.route.paramMap.subscribe(params => {
      this.routeParams = {};
      params.keys.forEach(key => {
        this.routeParams[key] = params.get(key);
      });
      console.log('Route params:', this.routeParams);
    });

    this.route.data.subscribe(data => {
      this.routeData = data;
      console.log('Route data:', this.routeData);
    });

    this.currentUrl = window.location.href;
    console.log('Current URL:', this.currentUrl);
  }
}
