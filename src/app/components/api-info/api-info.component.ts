import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-api-info',
  standalone: true,
  imports: [CommonModule, MatChipsModule, MatIconModule],  template: `
    <div class="api-info-container">
      <mat-chip-listbox aria-label="API Connection">
        <mat-chip highlighted [color]="'accent'" class="api-chip">
          <mat-icon>cloud</mat-icon>
          API: {{ apiUrl }}
        </mat-chip>
      </mat-chip-listbox>
    </div>
  `,
  styles: [] // Styles moved to global styles.scss
})
export class ApiInfoComponent implements OnInit {
  apiUrl = '';

  constructor(private configService: ConfigService) {}

  ngOnInit(): void {
    this.apiUrl = this.configService.getApiBaseUrl();
    this.configService.apiBaseUrl$.subscribe(url => {
      this.apiUrl = url;
    });
  }
}
