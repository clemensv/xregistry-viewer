import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, Subject, interval, of } from 'rxjs';
import { takeUntil, switchMap, tap, catchError } from 'rxjs/operators';
import { RegistryService } from '../../services/registry.service';
import { ModelService } from '../../services/model.service';
import { ConfigService } from '../../services/config.service';
import { Group } from '../../models/registry.model';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { ErrorBoundaryComponent } from '../error-boundary/error-boundary.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ResourceDocumentItemComponent } from '../resource-document-item/resource-document-item.component';
import { IconComponent } from '../icon/icon.component';
import { DeprecationIndicatorComponent } from '../deprecation-indicator/deprecation-indicator.component';
import { formatDateShort } from '../../utils/text.utils';

@Component({
  selector: 'app-group-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    LoadingIndicatorComponent,
    ErrorBoundaryComponent,
    EmptyStateComponent,
    ResourceDocumentItemComponent,
    IconComponent,
    DeprecationIndicatorComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './group-details.component.html',
  styleUrl: './group-details.component.scss'
})
export class GroupDetailsComponent implements OnInit, OnDestroy {
  groupType!: string;
  groupId!: string;
  group$!: Observable<Group>;
  groupAttributes: { [key: string]: any } = {};
  resourceTypes: Array<{ name: string; plural: string; description?: string; count?: number }> = [];
  loading = true;
  loadingProgress = true;
  
  // Error handling
  hasError = false;
  errorMessage: string | null = null;
  errorDetails: any = null;
  
  private destroy$ = new Subject<void>();
  private initialLoad = true;
  
  // Suppress these standard attributes from display
  private suppressAttributes = [
    'id', 'xid', 'self', 'epoch', 'name', 'description',
    'createdat', 'modifiedat', 'origin', 'deprecated'
  ];
  
  // Utility functions
  formatDateShort = formatDateShort;
  
  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    private modelService: ModelService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.groupType = params.get('groupType')!;
      this.groupId = params.get('groupId')!;
      
      // Reset state for new group
      this.resetComponentState();
      
      // Wait for config to be loaded
      this.waitForConfigAndLoadData();
    });
  }
  
  private resetComponentState(): void {
    console.log('GroupDetailsComponent: Resetting state for new group');
    this.loading = true;
    this.loadingProgress = true;
    this.initialLoad = true;
    this.hasError = false;
    this.errorMessage = null;
    this.errorDetails = null;
    this.groupAttributes = {};
    this.resourceTypes = [];
  }
  
  private waitForConfigAndLoadData(): void {
    const config = this.configService.getConfig();
    if (config && config.apiEndpoints && config.apiEndpoints.length > 0) {
      this.loadModelAndGroup();
      return;
    }
    
    // Wait for config
    let attempts = 0;
    const maxAttempts = 50;
    
    const checkInterval = interval(100).pipe(takeUntil(this.destroy$)).subscribe(() => {
      attempts++;
      const config = this.configService.getConfig();
      
      if (config && config.apiEndpoints && config.apiEndpoints.length > 0) {
        checkInterval.unsubscribe();
        this.loadModelAndGroup();
      } else if (attempts >= maxAttempts) {
        checkInterval.unsubscribe();
        console.error('GroupDetailsComponent: Timeout waiting for configuration');
        this.hasError = true;
        this.errorMessage = 'Configuration failed to load. Please refresh the page or check your settings.';
        this.loading = false;
        this.loadingProgress = false;
        this.cdr.markForCheck();
      }
    });
  }
  
  private loadModelAndGroup(): void {
    // Load group metadata using progressive loading
    this.modelService.getProgressiveRegistryModel()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const model = result.model;
          
          // Get group type metadata
          if (model.groups && model.groups[this.groupType]) {
            const groupTypeMeta = model.groups[this.groupType];
            this.groupAttributes = groupTypeMeta.attributes || {};
            
            // Build resource types list from model
            if (groupTypeMeta.resources) {
              this.resourceTypes = Object.keys(groupTypeMeta.resources).map(rtKey => ({
                name: rtKey,
                plural: groupTypeMeta.resources[rtKey].plural || rtKey,
                description: groupTypeMeta.resources[rtKey].description
              }));
            }
            
            // Load group data on initial model load or when model is complete
            if (this.initialLoad || result.isComplete) {
              console.log(`GroupDetailsComponent: Loading group (initialLoad=${this.initialLoad}, isComplete=${result.isComplete})`);
              this.loadGroup();
              if (this.initialLoad) {
                this.initialLoad = false;
              }
            }
          }
          
          // Update progress indicator
          if (result.isComplete) {
            this.loadingProgress = false;
          }
          
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('GroupDetailsComponent: Error loading registry model:', error);
          this.loading = false;
          this.loadingProgress = false;
          this.cdr.markForCheck();
        }
      });
  }
  
  private loadGroup(): void {
    console.log(`GroupDetailsComponent: Loading group ${this.groupType}/${this.groupId}`);
    this.hasError = false;
    this.errorMessage = null;
    this.errorDetails = null;
    
    this.group$ = this.registry.getGroup(this.groupType, this.groupId).pipe(
      tap((group) => {
        console.log(`GroupDetailsComponent: Group loaded:`, group);
        this.loading = false;
        this.hasError = false;
        
        // Count resources for each resource type if available
        if (group && this.resourceTypes.length > 0) {
          this.resourceTypes.forEach(rt => {
            // Check if group has a count property for this resource type
            const countKey = `${rt.name}count`;
            if (group[countKey] !== undefined) {
              rt.count = group[countKey];
            }
          });
        }
        
        this.cdr.markForCheck();
      }),
      catchError((err) => {
        console.error('GroupDetailsComponent: Error loading group:', err);
        this.loading = false;
        this.hasError = true;
        this.errorDetails = err;
        
        // Set appropriate error message
        if (err.status === 404) {
          this.errorMessage = `Group "${this.groupId}" not found in ${this.groupType}.`;
        } else if (err.status === 0) {
          this.errorMessage = `Unable to connect to the registry. Please check your network connection.`;
        } else if (err.status >= 500) {
          this.errorMessage = `Server error occurred while loading the group. Please try again later.`;
        } else {
          this.errorMessage = `Failed to load group: ${err.message || 'Unknown error'}`;
        }
        
        this.cdr.markForCheck();
        return of(null as any);
      })
    );
    
    // Set loading to false immediately so async pipe can subscribe
    this.loading = false;
    console.log('GroupDetailsComponent: Set loading=false, template should render');
  }
  
  get displayAttributes(): string[] {
    return Object.keys(this.groupAttributes || {}).filter(
      key => !this.suppressAttributes.includes(key.toLowerCase())
    );
  }
  
  getGroupMetadataAttributes(): any {
    // Return metadata attributes that should be displayed using resource-document pattern
    // These are the basic group properties that aren't custom attributes
    return {
      'xid': {
        type: 'string',
        description: 'Registry unique identifier for this group'
      },
      'epoch': {
        type: 'integer',
        description: 'Version counter for optimistic concurrency control'
      }
    };
  }
  
  hasValue(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return true;
  }
  
  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }
  
  isSimpleAttribute(value: any): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    const type = typeof value;
    return type === 'string' || type === 'number' || type === 'boolean';
  }
  
  retryLoadGroup(): void {
    console.log('GroupDetailsComponent: Retrying group load');
    this.resetComponentState();
    this.loadModelAndGroup();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
