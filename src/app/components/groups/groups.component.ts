import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation, OnDestroy, ElementRef, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { Observable, Subject, interval } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { RegistryService } from '../../services/registry.service';
import { ModelService } from '../../services/model.service';
import { DebugService } from '../../services/debug.service';
import { Group } from '../../models/registry.model';
import { FormsModule } from '@angular/forms';
import { ResourceDocumentItem } from '../../models/resource-document-item.model';
import { ResourceDocumentItemComponent } from '../resource-document-item/resource-document-item.component';
import { GroupRowComponent } from '../group-row/group-row.component';
import { SearchService } from '../../services/search.service';
import { PageHeaderComponent, ViewMode } from '../page-header/page-header.component';
import { ConfigService } from '../../services/config.service';
import { truncateText, truncateDescription, formatDateShort, getFullText } from '../../utils/text.utils';
import { IconComponent } from '../icon/icon.component';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ErrorBoundaryComponent } from '../error-boundary/error-boundary.component';

@Component({
  standalone: true,
  selector: 'app-groups',
  imports: [CommonModule, RouterModule, FormsModule, GroupRowComponent, ResourceDocumentItemComponent, IconComponent, PageHeaderComponent, LoadingIndicatorComponent, EmptyStateComponent, ErrorBoundaryComponent],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class GroupsComponent implements OnInit, OnDestroy, AfterViewInit {
  groupType!: string;
  resourceTypes$!: Observable<string[]>;
  groupAttributes: { [key: string]: any } = {};
  private suppressGroupAttributes = ['groupid', 'self', 'xid', 'epoch', 'createdat', 'modifiedat', 'name', 'id', 'origin'];
  registryModel: any = null;
  groupsList: Group[] = [];
  filteredGroupsList: Group[] = [];
  viewMode: ViewMode = 'cards'; // Default view mode
  currentSearchTerm = '';
  currentOriginFilter = ''; // Add origin filter
  loading = true;
  loadingProgress = true; // Tracks if we're still expecting more data

  // Error handling state
  hasApiError = false;
  apiErrorMessage = '';
  apiErrorDetails: any = null;
  partialFailure = false; // True when some but not all APIs failed
  totalFailure = false; // True when ALL APIs failed
  private destroy$ = new Subject<void>();
  private initialLoad = true;
  private userHasChangedView = false; // Track if user manually changed view mode

  // Client-side pagination for large datasets
  allGroupsCache: Group[] = [];
  private currentPage = 1;
  private pageSize = 50;
  useClientSidePagination = false;

  // Pagination links object
  pageLinks: { [key: string]: string } = {};

  // Utility functions for template
  truncateText = truncateText;
  truncateDescription = truncateDescription;
  formatDateShort = formatDateShort;
  getFullText = getFullText;

  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    public modelService: ModelService,
    private cdr: ChangeDetectorRef,
    private debug: DebugService,
    private searchService: SearchService,
    private configService: ConfigService,
    private elementRef: ElementRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.groupType = this.route.snapshot.paramMap.get('groupType') || '';

    // Check for origin filter in query parameters
    this.currentOriginFilter = this.route.snapshot.queryParamMap.get('origin') || '';

    // Subscribe to query parameter changes
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(queryParams => {
        const newOriginFilter = queryParams.get('origin') || '';
        if (newOriginFilter !== this.currentOriginFilter) {
          this.currentOriginFilter = newOriginFilter;
          this.applyClientSideFilter();
          this.cdr.markForCheck();
        }
      });

    // Wait for configuration to be loaded before subscribing to ModelService
    this.waitForConfigAndLoadData();

    // Subscribe to search state changes
    this.searchService.searchState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.debug.log('Groups received search state:', state, 'My groupType:', this.groupType);
        if (state.context?.groupType === this.groupType) {
          this.debug.log('Search context matches, updating search term:', state.searchTerm);
          const previousSearchTerm = this.currentSearchTerm;
          this.currentSearchTerm = state.searchTerm;

          // If search term changed, reload data from backend with new filter
          if (previousSearchTerm !== this.currentSearchTerm) {
            this.debug.log('Search term changed, reloading groups from backend with filter');
            this.loadGroups(); // This will use the new search term to generate the filter
          } else {
            // If only context changed but not search term, just apply client-side filter
            this.applyClientSideFilter();
          }
        }
      });

    // Listen for configuration changes and reload data
    this.configService.configChanges$
      .pipe(takeUntil(this.destroy$))
      .subscribe(newConfig => {
        console.log('GroupsComponent: Configuration changed, reloading data...', newConfig);
        this.reloadData();
      });
  }

  private waitForConfigAndLoadData(): void {
    // Check if config is already loaded
    const config = this.configService.getConfig();
    if (config && config.apiEndpoints && config.apiEndpoints.length > 0) {
      this.loadModelAndGroups();
      return;
    }

    // Config not loaded yet, wait for it
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait

    const checkInterval = interval(100).pipe(takeUntil(this.destroy$)).subscribe(() => {
      attempts++;
      const currentConfig = this.configService.getConfig();

      if (currentConfig && currentConfig.apiEndpoints && currentConfig.apiEndpoints.length > 0) {
        checkInterval.unsubscribe();
        this.loadModelAndGroups();
      } else if (attempts >= maxAttempts) {
        this.debug.log('GroupsComponent: Timeout waiting for config, proceeding anyway');
        checkInterval.unsubscribe();
        this.loadModelAndGroups();
      }
    });
  }

  private loadModelAndGroups(): void {
    // Load group metadata attributes using progressive loading
    this.modelService.getProgressiveRegistryModel()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const model = result.model;

          if (model.groups && model.groups[this.groupType]) {
            this.groupAttributes = model.groups[this.groupType].attributes || {};
            this.registryModel = model;

            // Update resource types observable
            if (model.groups[this.groupType] && model.groups[this.groupType].resources) {
              const resourceTypes = Object.keys(model.groups[this.groupType].resources);
              this.debug.log('Extracted resourceTypes:', resourceTypes);
            }

            // Load groups on initial model load or when model is complete
            if (this.initialLoad || result.isComplete) {
              this.loadGroups();
              if (this.initialLoad) {
                this.initialLoad = false;
              }
            }
          }

          // Update loading states
          this.loadingProgress = !result.isComplete;

          this.debug.log(`GroupsComponent: Updated model (${result.loadedCount}/${result.totalCount} endpoints loaded)`);
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('GroupsComponent: Error loading registry model:', error);
          this.loading = false;
          this.loadingProgress = false;
          this.cdr.markForCheck();
        }
      });

    // Set up resource types observable
    this.resourceTypes$ = this.route.paramMap.pipe(
      map(params => params.get('groupType')!),
      distinctUntilChanged(),
      switchMap(gt => this.modelService.getRegistryModel().pipe(
        map(model => {
          if (!model.groups[gt] || !model.groups[gt].resources) {
            this.debug.warn(`No resources found for groupType: ${gt}`);
            return [];
          }
          const resourceTypes = Object.keys(model.groups[gt].resources);
          this.debug.log('Extracted resourceTypes:', resourceTypes);
          return resourceTypes;
        })
      ))
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    // Trigger smart view mode after view is initialized if we already have data
    if (!this.loading && this.groupsList.length > 0 && !this.userHasChangedView) {
      setTimeout(() => this.setSmartViewMode(), 0);
    }
  }

  /** Load groups with current pagination */
  loadGroups(pageRel: string = ''): void {
    // If using client-side pagination, handle it locally
    if (this.useClientSidePagination && pageRel) {
      this.handleClientSidePagination(pageRel);
      return;
    }

    // Reset error states
    this.hasApiError = false;
    this.apiErrorMessage = '';
    this.apiErrorDetails = null;
    this.partialFailure = false;
    this.totalFailure = false;

    const filter = this.searchService.generateNameFilter(this.currentSearchTerm);
    this.registry.listGroups(this.groupType, pageRel, filter)
      .subscribe({
        next: (page) => {
          // Check API failure statistics
          if (page.totalApis && page.totalApis > 0) {
            this.partialFailure = page.failedApis! > 0 && page.successfulApis! > 0;
            this.totalFailure = page.successfulApis === 0;

            if (this.totalFailure) {
              // ALL APIs failed - show error state
              this.hasApiError = true;
              this.apiErrorMessage = this.generateErrorMessage(page.error, page.allApiErrors);
              this.apiErrorDetails = page.allApiErrors;
              this.loading = false;
              this.loadingProgress = false;
              this.cdr.markForCheck();
              return;
            } else if (this.partialFailure) {
              // Some APIs failed but we have data - log warning but continue
              this.debug.warn(`Partial API failure: ${page.failedApis} of ${page.totalApis} APIs failed for group type '${this.groupType}'`);
            }
          }

          // Check if server returned pagination links
          const hasServerPagination = Object.keys(page.links).length > 0;

          if (!hasServerPagination && page.items.length > this.pageSize && !pageRel) {
            // Server doesn't support pagination but returned large dataset
            this.enableClientSidePagination(page.items);
          } else {
            // Normal server pagination or small dataset
            this.groupsList = page.items;
            this.pageLinks = page.links;
            this.useClientSidePagination = false;
          }

          this.applyClientSideFilter();

          // Only set default view mode on initial load and if user hasn't manually changed view (when pageRel is empty)
          if (!pageRel && this.initialLoad && !this.userHasChangedView) {
            this.setSmartViewMode();
          }

          // Update loading state
          if (this.loading && this.groupsList.length > 0) {
            this.loading = false;
          }

          // Auto-forward if only one group
          this.checkAutoForward();

          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('GroupsComponent: Error loading groups:', error);
          this.hasApiError = true;
          this.totalFailure = true;
          this.apiErrorMessage = this.generateErrorMessage(error);
          this.apiErrorDetails = error;
          this.loading = false;
          this.loadingProgress = false;
          this.cdr.markForCheck();
        }
      });
  }

  private enableClientSidePagination(allItems: Group[]): void {
    this.allGroupsCache = allItems;
    this.useClientSidePagination = true;
    this.currentPage = 1;

    // Create client-side pagination links
    const totalPages = Math.ceil(allItems.length / this.pageSize);
    this.pageLinks = {};

    if (this.currentPage > 1) {
      this.pageLinks['prev'] = 'prev';
      this.pageLinks['first'] = 'first';
    }

    if (this.currentPage < totalPages) {
      this.pageLinks['next'] = 'next';
      this.pageLinks['last'] = 'last';
    }

    // Display first page
    this.groupsList = this.getPageItems();
  }

  private handleClientSidePagination(pageRel: string): void {
    const totalPages = Math.ceil(this.allGroupsCache.length / this.pageSize);

    switch (pageRel) {
      case 'first':
        this.currentPage = 1;
        break;
      case 'prev':
        this.currentPage = Math.max(1, this.currentPage - 1);
        break;
      case 'next':
        this.currentPage = Math.min(totalPages, this.currentPage + 1);
        break;
      case 'last':
        this.currentPage = totalPages;
        break;
    }

    // Update pagination links
    this.pageLinks = {};
    if (this.currentPage > 1) {
      this.pageLinks['prev'] = 'prev';
      this.pageLinks['first'] = 'first';
    }
    if (this.currentPage < totalPages) {
      this.pageLinks['next'] = 'next';
      this.pageLinks['last'] = 'last';
    }

    // Update displayed items
    this.groupsList = this.getPageItems();
    this.applyClientSideFilter();
    this.cdr.markForCheck();
  }

  private getPageItems(): Group[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.allGroupsCache.slice(startIndex, endIndex);
  }

  private applyClientSideFilter(): void {
    const sourceList = this.useClientSidePagination ? this.getPageItems() : this.groupsList;

    if (!sourceList || sourceList.length === 0) {
      this.filteredGroupsList = [];
      return;
    }

    let filtered = [...sourceList];

    // Apply search term filter
    if (this.currentSearchTerm && this.currentSearchTerm.trim().length > 0) {
      const term = this.currentSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(group => {
        const searchableText = [
          group.name || '',
          group.id || '',
          group.description || ''
        ].join(' ').toLowerCase();
        return searchableText.includes(term);
      });
    }

    // Apply origin filter
    if (this.currentOriginFilter && this.currentOriginFilter.trim().length > 0) {
      filtered = filtered.filter(group => {
        return group.origin === this.currentOriginFilter;
      });
    }

    this.filteredGroupsList = filtered;
  }
  onPageChange(pageRel: string): void {
    this.loadGroups(pageRel);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.userHasChangedView = true;
  }

  /**
   * Set smart view mode based on item count and viewport constraints
   */
  private setSmartViewMode(): void {
    const itemCount = this.filteredGroupsList.length;

    // If more than 8 items, use list view
    if (itemCount > 8) {
      this.viewMode = 'list';
      return;
    }

    // If 8 or fewer items, check if they fit in viewport
    this.viewMode = 'cards';

    // Use setTimeout to ensure DOM is rendered before checking viewport
    setTimeout(() => {
      if (this.checkViewportOverflow()) {
        this.viewMode = 'list';
        this.cdr.markForCheck();
      }
    }, 100);
  }

  /**
   * Check if the grid view would overflow the viewport
   */
  private checkViewportOverflow(): boolean {
    try {
      const gridContainer = this.elementRef.nativeElement.querySelector('.grid-container');
      if (!gridContainer) {
        return false;
      }

      const containerRect = gridContainer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const pageHeaderHeight = 120; // Approximate height for page header
      const availableHeight = viewportHeight - pageHeaderHeight;

      return containerRect.height > availableHeight;
    } catch (error) {
      this.debug.log('Error checking viewport overflow:', error);
      return false;
    }
  }

  get displayGroupAttributes(): string[] {
    const filteredAttributes = Object.keys(this.groupAttributes || {}).filter(
      key => {
        const lowerKey = key.toLowerCase();
        // Filter out basic suppressed attributes
        if (this.suppressGroupAttributes.includes(lowerKey)) {
          return false;
        }
        // Filter out URL attributes
        if (lowerKey.endsWith('url')) {
          return false;
        }
        // Filter out resource count attributes (e.g., serverscount, endpointscount)
        if (lowerKey.endsWith('count')) {
          return false;
        }
        // Filter out description as it's shown separately
        if (lowerKey === 'description') {
          return false;
        }
        return true;
      }
    );
    return filteredAttributes;
  }

  /** reuse hasValue from ResourcesComponent or reimplement*/
  hasValue(value: any): boolean {
    // Check for null, undefined, or empty string
    if (value === null || value === undefined || value === '') {
      return false;
    }
    // Check for empty arrays
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    // Check for empty objects (but not null)
    if (value && typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    // For primitive values (numbers, booleans, etc.)
    return true;
  }

  /**
   * Helper method to get object keys for template iteration
   */
  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  /**
   * Build a ResourceDocumentItem for the resource types array for a group
   */
  getResourceTypesItem(group: any): ResourceDocumentItem | null {
    if (!this.registryModel || !this.registryModel.groups || !this.registryModel.groups[this.groupType]) return null;
    const groupTypeModel = this.registryModel.groups[this.groupType];
    if (!groupTypeModel.resources) return null;
    const resourceTypes = Object.keys(groupTypeModel.resources);
    // Build array of resource type objects for this group
    const value = resourceTypes.map(rt => {
      const model = groupTypeModel.resources[rt];
      return {
        name: rt,
        count: group[rt + 'count'] ?? undefined,
        model: model,
        description: model.description
      };
    });
    // Build itemModel for the array
    const itemModel = {
      type: 'array',
      item: {
        type: 'object',
        attributes: {
          name: { type: 'string' },
          count: { type: 'number' },
          description: { type: 'string' }
        }
      }
    };
    return {
      key: 'Resource Types',
      value,
      type: 'array',
      description: 'Resource types available in this group',
      itemModel,
      isExpanded: false
    };
  }

  /**
   * Check if auto-forwarding should occur when there's only one group
   */
  private checkAutoForward(): void {
    // Only auto-forward if:
    // 1. We have exactly one group
    // 2. We're not searching (currentSearchTerm is empty)
    // 3. We're not using pagination (groupsList contains all groups)
    if (!this.currentSearchTerm &&
        this.groupsList.length === 1 &&
        !this.useClientSidePagination &&
        Object.keys(this.pageLinks).length === 0) {

      const singleGroup = this.groupsList[0];
      this.debug.log('GroupsComponent: Auto-forwarding to single group:', singleGroup);

      // Need to determine resource type to navigate to - check if there's a single resource type
      if (this.registryModel?.groups?.[this.groupType]?.resources) {
        const resourceTypes = Object.keys(this.registryModel.groups[this.groupType].resources);

        if (resourceTypes.length === 1) {
          // Navigate directly to the single resource type
          const singleResourceType = resourceTypes[0];
          this.debug.log('GroupsComponent: Auto-forwarding to single resource type:', singleResourceType);
          this.router.navigate([this.groupType, singleGroup.id, singleResourceType]);
        } else {
          // Multiple resource types - just navigate to the group detail (which redirects to group list with highlight)
          this.router.navigate([this.groupType, singleGroup.id]);
        }
      }
    }
  }

  getTopLevelAttributes(group: any) {
    // Return only top-level attributes, deduplicated
    if (!group || !group.attributes) return [];
    // Filter out resource collection attributes if present
    return group.attributes.filter((attr: any) => !attr.isResourceCollection);
  }

  navigateToResourceCollection(group: any, rc: any) {
    // Navigate to the resource collection view for this group and resource type
    this.router.navigate(['/groups', group.id, 'resources', rc.type]);
  }

  navigateToGroup(group: any) {
    this.router.navigate(['/groups', group.id]);
  }

  /**
   * Check if an attribute value is a simple primitive type
   */
  isSimpleAttribute(value: any): boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  /**
   * Generate a user-friendly error message based on the type of failure
   */
  private generateErrorMessage(error: any, allApiErrors?: Array<{ api: string; error: any }>): string {
    if (!error) {
      return 'Unable to load groups - all registry endpoints are currently unavailable.';
    }

    // Check for common network error types
    const errorMessage = error.message || error.toString();

    if (errorMessage.includes('ERR_NAME_NOT_RESOLVED')) {
      return 'Network connectivity issue - unable to resolve registry server addresses.';
    }

    if (errorMessage.includes('CORS')) {
      return 'Cross-origin request blocked - registry servers may not be configured to accept requests from this application.';
    }

    if (errorMessage.includes('ERR_FAILED') || errorMessage.includes('NetworkError')) {
      return 'Network connection failed - registry servers may be offline or unreachable.';
    }

    if (error.status === 404) {
      return `Groups of type "${this.groupType}" not found on any available registry endpoints.`;
    }

    if (error.status === 403) {
      return 'Access denied - you may not have permission to view these groups.';
    }

    if (error.status === 500) {
      return 'Registry server error - the servers are experiencing internal issues.';
    }

    // If we have multiple API errors, show a summary
    if (allApiErrors && allApiErrors.length > 1) {
      const errorTypes = allApiErrors.map(apiError => {
        const msg = apiError.error?.message || apiError.error?.toString() || 'Unknown error';
        if (msg.includes('ERR_NAME_NOT_RESOLVED')) return 'DNS resolution failed';
        if (msg.includes('CORS')) return 'CORS blocked';
        if (msg.includes('ERR_FAILED')) return 'Connection failed';
        if (apiError.error?.status === 404) return '404 Not Found';
        if (apiError.error?.status === 403) return '403 Forbidden';
        if (apiError.error?.status === 500) return '500 Server Error';
        return 'Connection error';
      });

      const uniqueErrors = [...new Set(errorTypes)];
      return `All ${allApiErrors.length} registry endpoints failed: ${uniqueErrors.join(', ')}.`;
    }

    // Fallback to generic message
    return `Unable to load groups - registry endpoints are currently unavailable (${errorMessage}).`;
  }

  /**
   * Reloads the data by clearing cache and reinitializing
   */
  private reloadData(): void {
    // Reset loading states
    this.loading = true;
    this.loadingProgress = true;
    this.groupsList = [];
    this.filteredGroupsList = [];
    this.allGroupsCache = [];
    this.hasApiError = false;
    this.apiErrorMessage = '';
    this.apiErrorDetails = null;
    this.partialFailure = false;
    this.totalFailure = false;
    this.cdr.markForCheck();

    // Clear all caches to force reload from new endpoints
    this.modelService.clearAllCaches();

    // Force the model service to reload by clearing any cached data
    // This ensures we get fresh data from the new endpoints
    this.loadModelAndGroups();
  }

  /**
   * Retry loading groups after an error
   */
  retryLoadGroups(): void {
    this.hasApiError = false;
    this.apiErrorMessage = '';
    this.apiErrorDetails = null;
    this.partialFailure = false;
    this.totalFailure = false;
    this.loading = true;
    this.loadingProgress = true;
    this.cdr.markForCheck();
    this.loadGroups();
  }
}
