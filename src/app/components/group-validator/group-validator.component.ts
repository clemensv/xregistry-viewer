import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { DebugService } from '../../services/debug.service';
import { ModelService } from '../../services/model.service';

@Component({
  standalone: true,
  selector: 'app-group-validator',
  imports: [CommonModule],
  template: `
    <div class="group-validator" style="padding: 20px; margin: 20px; background: #f0f0f0; border: 1px solid #ccc;">
      <h2>URL Parameter Validation</h2>

      <div *ngIf="loading">
        Validating URL parameters...
      </div>

      <div *ngIf="!loading && error">
        <h3 style="color: red;">{{ errorTitle }}</h3>
        <p>{{ errorMessage }}</p>

        <div *ngIf="availableOptions.length > 0">
          <h4>Available Options:</h4>
          <ul>
            <li *ngFor="let option of availableOptions">{{ option }}</li>
          </ul>
        </div>

        <button
          style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;"
          (click)="goBack()">
          Go Back
        </button>
      </div>

      <div *ngIf="!loading && !error">
        <h3 style="color: green;">URL Parameters Valid</h3>
        <p>All parameters validated successfully.</p>

        <div>
          <strong>Group Type:</strong> {{ params.groupType }}
        </div>
        <div>
          <strong>Group ID:</strong> {{ params.groupId }}
        </div>
        <div>
          <strong>Resource Type:</strong> {{ params.resourceType }}
        </div>
        <div>
          <strong>Resource ID:</strong> {{ params.resourceId }}
        </div>
        <div>
          <strong>Version ID:</strong> {{ params.versionId }}
        </div>
      </div>
    </div>
  `
})
export class GroupValidatorComponent implements OnInit, OnDestroy {
  params: any = {};
  loading = true;
  error = false;
  errorTitle = '';
  errorMessage = '';
  availableOptions: string[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private modelService: ModelService,
    private debug: DebugService
  ) {}

  ngOnInit(): void {
    this.debug.log('GroupValidatorComponent initialized');

    this.route.paramMap.subscribe(params => {
      this.params = {
        groupType: params.get('groupType'),
        groupId: params.get('groupId'),
        resourceType: params.get('resourceType'),
        resourceId: params.get('resourceId'),
        versionId: params.get('versionId')
      };

      this.debug.log('URL parameters:', this.params);
      this.validateParams();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private validateParams(): void {
    this.loading = true;
    this.error = false;

    this.modelService.getRegistryModel()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (model) => {
          this.debug.log('Registry model received:', model);

          // Check if group type exists
          if (!model.groups || !model.groups[this.params.groupType]) {
            this.error = true;
            this.errorTitle = 'Invalid Group Type';
            this.errorMessage = `The group type '${this.params.groupType}' does not exist in the registry.`;
            this.availableOptions = Object.keys(model.groups || {});
          }
          // Check if resource type exists in the group
          else if (!model.groups[this.params.groupType].resources ||
                   !model.groups[this.params.groupType].resources[this.params.resourceType]) {
            this.error = true;
            this.errorTitle = 'Invalid Resource Type';
            this.errorMessage = `The resource type '${this.params.resourceType}' does not exist in group '${this.params.groupType}'.`;
            this.availableOptions = Object.keys(model.groups[this.params.groupType].resources || {});
          }

          this.loading = false;
        },
        error: (err) => {
          this.debug.error('Error loading registry model:', err);
          this.error = true;
          this.errorTitle = 'Registry Error';
          this.errorMessage = 'Failed to load registry model: ' + (err.message || 'Unknown error');
          this.loading = false;
        }
      });
  }

  goBack(): void {
    this.location.back();
  }
}
