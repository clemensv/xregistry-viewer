import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelService } from '../../services/model.service';
import { DebugService } from '../../services/debug.service';
import { map, tap } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-debug-model',
  imports: [CommonModule],
  template: `
    <div style="padding: 20px; background: #f8f8f8; border: 1px solid #ccc; margin: 20px;">
      <h2>Registry Model Debug</h2>

      <div *ngIf="loading">Loading model data...</div>

      <div *ngIf="error" style="color: red;">
        <h3>Error Loading Model</h3>
        <pre>{{ error }}</pre>
      </div>

      <div *ngIf="!loading && !error">
        <h3>Available Group Types:</h3>
        <ul>
          <li *ngFor="let groupType of groupTypes">
            <strong>{{ groupType }}</strong> - Resources:
            <span *ngFor="let resourceType of getResourceTypes(groupType); let last = last">
              {{ resourceType }}{{ !last ? ', ' : '' }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  `
})
export class DebugModelComponent implements OnInit {
  loading = true;
  error: string | null = null;
  groupTypes: string[] = [];
  modelData: any = null;

  constructor(
    private modelService: ModelService,
    private debug: DebugService
  ) {}

  ngOnInit(): void {
    this.debug.log('DebugModelComponent initialized');
    this.loadModelData();
  }

  private loadModelData(): void {
    this.modelService.getRegistryModel()
      .pipe(
        tap(model => {
          this.debug.log('Registry model loaded in debug component:', model);
          this.modelData = model;
        }),
        map(model => {
          if (!model || !model.groups) {
            throw new Error('Model or model.groups is undefined');
          }
          return Object.keys(model.groups || {});
        })
      )
      .subscribe({
        next: (groupTypes) => {
          this.debug.log('Group types:', groupTypes);
          this.groupTypes = groupTypes;
          this.loading = false;
        },
        error: (err) => {
          this.debug.error('Error loading registry model:', err);
          this.error = err.message || 'Unknown error loading registry model';
          this.loading = false;
        }
      });
  }

  getResourceTypes(groupType: string): string[] {
    if (!this.modelData || !this.modelData.groups || !this.modelData.groups[groupType]) {
      return [];
    }

    return Object.keys(this.modelData.groups[groupType].resources || {});
  }
}
