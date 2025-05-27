import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation, OnDestroy, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { Observable, Subject, interval } from 'rxjs';
import { map, switchMap, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { RegistryService } from '../../services/registry.service';
import { ModelService } from '../../services/model.service';
import { DebugService } from '../../services/debug.service';
import { Resource } from '../../models/registry.model';
import { FormsModule } from '@angular/forms';
import { ResourceDocumentComponent } from '../resource-document/resource-document.component';
import { LinkSet, PaginationComponent } from '../pagination/pagination.component';
import { ResourceRowComponent } from '../resource-row/resource-row.component';
import { SearchService } from '../../services/search.service';
import { PageHeaderComponent, ViewMode } from '../page-header/page-header.component';
import { ConfigService } from '../../services/config.service';
import { truncateText, truncateDescription, formatDateShort, getFullText } from '../../utils/text.utils';

@Component({
  standalone: true,
  selector: 'app-resources',
  imports: [CommonModule, RouterModule, FormsModule, PaginationComponent, ResourceRowComponent, ResourceDocumentComponent, PageHeaderComponent],
  templateUrl: './resources.component.html',
  styleUrls: ['./resources.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class ResourcesComponent implements OnInit, OnDestroy, AfterViewInit {
  groupType!: string;
  groupId!: string;
  resourceType!: string;
  resourceAttributes: { [key: string]: any } = {};
  private suppressResourceAttributes = ['resourceid', 'self', 'xid', 'epoch', 'createdat', 'modifiedat'];
  resourcesList: Resource[] = [];
  filteredResourcesList: Resource[] = [];
  pageLinks: LinkSet = {};
  totalCount = 0; // Total number of resources from backend pagination
  viewMode: ViewMode = 'cards'; // Default view mode
  currentSearchTerm = '';
  loading = true;
  loadingProgress = true; // Tracks if we're still expecting more data
  resTypeHasDocument = false;
  private destroy$ = new Subject<void>();
  private initialLoad = true;
  private userHasChangedView = false; // Track if user manually changed view mode

  // Utility functions for template
  truncateText = truncateText;
  truncateDescription = truncateDescription;
  formatDateShort = formatDateShort;
  getFullText = getFullText;

  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    private modelService: ModelService,
    private cdr: ChangeDetectorRef,
    private debug: DebugService,
    private searchService: SearchService,
    private configService: ConfigService,
    private elementRef: ElementRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.groupType = this.route.snapshot.paramMap.get('groupType') || '';
    this.groupId = this.route.snapshot.paramMap.get('groupId') || '';
    this.resourceType = this.route.snapshot.paramMap.get('resourceType') || '';

    // Wait for configuration to be loaded before subscribing to ModelService
    this.waitForConfigAndLoadData();

    // Subscribe to search state changes
    this.searchService.searchState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.debug.log('Resources received search state:', state, 'My context:', { groupType: this.groupType, groupId: this.groupId, resourceType: this.resourceType });
        if (state.context?.groupType === this.groupType &&
            state.context?.groupId === this.groupId &&
            state.context?.resourceType === this.resourceType) {
          this.debug.log('Search context matches, updating search term:', state.searchTerm);
          const previousSearchTerm = this.currentSearchTerm;
          this.currentSearchTerm = state.searchTerm;

          // If search term changed, reload data from backend with new filter
          if (previousSearchTerm !== this.currentSearchTerm) {
            this.debug.log('Search term changed, reloading resources from backend with filter');
            this.loadResources(); // This will use the new search term to generate the filter
          } else {
            // If only context changed but not search term, just apply client-side filter
            this.applyClientSideFilter();
          }
        }
      });
  }

  private waitForConfigAndLoadData(): void {
    // Check if config is already loaded
    const config = this.configService.getConfig();
    if (config && config.apiEndpoints && config.apiEndpoints.length > 0) {
      this.loadModelAndResources();
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
        this.loadModelAndResources();
      } else if (attempts >= maxAttempts) {
        console.error('ResourcesComponent: Timeout waiting for config, proceeding anyway');
        checkInterval.unsubscribe();
        this.loadModelAndResources();
      }
    });
  }

  private loadModelAndResources(): void {
    // Load resource metadata attributes using progressive loading
    this.modelService.getProgressiveRegistryModel()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const model = result.model;

          if (model.groups && model.groups[this.groupType] &&
              model.groups[this.groupType].resources &&
              model.groups[this.groupType].resources[this.resourceType]) {

            const resourceModel = model.groups[this.groupType].resources[this.resourceType];
            this.resourceAttributes = resourceModel.attributes || {};
            this.resTypeHasDocument = resourceModel.hasdocument !== false;

            // Load resources on initial model load or when model is complete
            if (this.initialLoad || result.isComplete) {
              this.loadResources();
              if (this.initialLoad) {
                this.initialLoad = false;
              }
            }
          }

          // Update loading states
          this.loadingProgress = !result.isComplete;

          this.debug.log(`ResourcesComponent: Updated model (${result.loadedCount}/${result.totalCount} endpoints loaded)`);
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('ResourcesComponent: Error loading registry model:', error);
          this.loading = false;
          this.loadingProgress = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadResources(pageRel: string = ''): void {
    const filter = this.searchService.generateNameFilter(this.currentSearchTerm);
    this.registry.listResources(this.groupType, this.groupId, this.resourceType, pageRel, filter)
      .subscribe({
        next: (page) => {
          this.debug.log('loadResources links:', page.links);
          this.resourcesList = page.items;
          // Process resources to ensure all required fields are present
          this.resourcesList = this.resourcesList.map(resource => {
            // Ensure name is available
            if (!resource['name'] && resource['id']) {
              resource['name'] = resource['id'];
            }

            // Ensure resourceUrl is mapped from documentation
            if (!resource['resourceUrl'] && resource['documentation']) {
              resource['resourceUrl'] = resource['documentation'];
            }

            return resource;
          });

          // Debug the actual resources data
          this.debug.log('Resources loaded:', this.resourcesList);
          if (this.resourcesList.length > 0) {
            this.debug.log('First resource sample:', this.resourcesList[0]);
            this.debug.log('Resource properties:', Object.keys(this.resourcesList[0]));
          }

          this.pageLinks = page.links;
          this.totalCount = page.totalCount || 0;
          this.debug.log(`Pagination info: totalCount=${this.totalCount}, pageSize=${page.pageSize}, currentPage=${page.currentPage}`);
          this.applyClientSideFilter();

          // Set default view mode based on smart logic (only on initial load and if user hasn't manually changed view)
          if (!pageRel && this.initialLoad && !this.userHasChangedView) {
            this.setSmartViewMode();
          }

          // Update loading state
          if (this.loading && this.resourcesList.length > 0) {
            this.loading = false;
          }

          // Auto-forward if only one resource
          this.checkAutoForward();

          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('ResourcesComponent: Error loading resources:', error);
          this.loading = false;
          this.loadingProgress = false;
          this.cdr.markForCheck();
        }
      });
  }

  private applyClientSideFilter(): void {
    const previousCount = this.filteredResourcesList.length;
    this.filteredResourcesList = this.searchService.filterItems(this.resourcesList, this.currentSearchTerm);

    // If user hasn't manually changed view and the filtered count changed, update view mode
    if (!this.userHasChangedView && previousCount !== this.filteredResourcesList.length && this.filteredResourcesList.length > 0) {
      setTimeout(() => this.setSmartViewMode(), 0);
    }
  }

  onPageChange(pageRel: string): void {
    this.debug.log(`ResourcesComponent: onPageChange called with pageRel: "${pageRel}"`);
    this.debug.log(`ResourcesComponent: pageRel type: ${typeof pageRel}`);
    this.debug.log(`ResourcesComponent: pageRel startsWith http: ${pageRel.startsWith('http')}`);
    this.loadResources(pageRel);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.userHasChangedView = true;
  }

  /**
   * Set smart view mode based on item count and viewport constraints
   */
  private setSmartViewMode(): void {
    const itemCount = this.filteredResourcesList.length;

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

  // These methods are now handled by the ResourceDocumentComponent
  // Keeping displayAttributes for backward compatibility, but we'll no longer use it in the template
  get displayAttributes(): string[] {
    return Object.keys(this.resourceAttributes || {}).filter(
      key => !this.suppressResourceAttributes.includes(key)
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    // Trigger smart view mode after view is initialized if we already have data
    if (!this.loading && this.resourcesList.length > 0 && !this.userHasChangedView) {
      setTimeout(() => this.setSmartViewMode(), 0);
    }
  }

  /**
   * Check if auto-forwarding should occur when there's only one resource
   */
  private checkAutoForward(): void {
    // Only auto-forward if:
    // 1. We have exactly one resource
    // 2. We're not searching (currentSearchTerm is empty)
    // 3. We're not using pagination (pageLinks is empty)
    if (!this.currentSearchTerm &&
        this.resourcesList.length === 1 &&
        Object.keys(this.pageLinks).length === 0) {

      const singleResource = this.resourcesList[0];
      this.debug.log('ResourcesComponent: Auto-forwarding to single resource:', singleResource);

      // Navigate to the resource detail page
      this.router.navigate([this.groupType, this.groupId, this.resourceType, singleResource.id]);
    }
  }
}
