import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation, OnDestroy, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';
import { ModelService } from '../../services/model.service';
import { DebugService } from '../../services/debug.service';
import { SearchService } from '../../services/search.service';
import { ConfigService } from '../../services/config.service';
import { RoutePersistenceService } from '../../services/route-persistence.service';
import { GroupType } from '../../models/registry.model';
import { PageHeaderComponent, ViewMode } from '../page-header/page-header.component';

@Component({
  standalone: true,
  selector: 'app-group-types',
  imports: [CommonModule, RouterModule, PageHeaderComponent],
  templateUrl: './group-types.component.html',
  styleUrls: ['./group-types.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class GroupTypesComponent implements OnInit, OnDestroy, AfterViewInit {
  viewMode: ViewMode = 'cards'; // Default view mode
  groupTypesList: { groupType: string; model: GroupType }[] = [];
  filteredGroupTypesList: { groupType: string; model: GroupType }[] = [];
  currentSearchTerm = '';
  loading = true;
  loadingProgress = true; // Tracks if we're still expecting more data
  private destroy$ = new Subject<void>();
  private initialLoad = true;
  private userHasChangedView = false; // Track if user manually changed view mode

  constructor(
    private modelService: ModelService,
    private cdr: ChangeDetectorRef,
    private debug: DebugService,
    private searchService: SearchService,
    private configService: ConfigService,
    private elementRef: ElementRef,
    private routePersistenceService: RoutePersistenceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Clear stored route since this is the home page - users who navigated here intentionally
    // shouldn't be redirected back to a previous deep link
    this.routePersistenceService.clearStoredRoute();

    // Wait for configuration to be loaded before subscribing to ModelService
    this.waitForConfigAndLoadData();

    // Subscribe to search state changes
    this.searchService.searchState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        // Apply search when at root level (no context) or specifically for group types
        if (!state.context || Object.keys(state.context).length === 0) {
          this.currentSearchTerm = state.searchTerm;
          this.applyClientSideFilter();
          this.cdr.markForCheck();
        }
      });
  }

  private waitForConfigAndLoadData(): void {
    // Check if config is already loaded
    const config = this.configService.getConfig();
    if (config && config.apiEndpoints && config.apiEndpoints.length > 0) {
      this.loadData();
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
        this.loadData();
      } else if (attempts >= maxAttempts) {
        console.error('GroupTypesComponent: Timeout waiting for config, proceeding anyway');
        checkInterval.unsubscribe();
        this.loadData();
      }
    });
  }

    private loadData(): void {
    this.modelService.getProgressiveRegistryModel()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const groupTypes = Object.entries(result.model.groups || {}).map(([groupType, model]) => ({ groupType, model }));

          // Only update if we have new group types
          if (groupTypes.length > this.groupTypesList.length ||
              JSON.stringify(groupTypes.map(gt => gt.groupType).sort()) !==
              JSON.stringify(this.groupTypesList.map(gt => gt.groupType).sort())) {

            this.groupTypesList = groupTypes;
            this.applyClientSideFilter();

            // Set default view mode based on smart logic (only on first significant load and if user hasn't manually changed view)
            if (this.initialLoad && this.groupTypesList.length > 0 && !this.userHasChangedView) {
              this.setSmartViewMode();
              this.initialLoad = false;
            }

            // Auto-forward if only one group type
            this.checkAutoForward();

            this.debug.log(`GroupTypesComponent: Updated with ${this.groupTypesList.length} group types (${result.loadedCount}/${result.totalCount} endpoints loaded)`);
            this.cdr.markForCheck();
          }

          // Update loading states
          this.loadingProgress = !result.isComplete;
          if (this.loading && this.groupTypesList.length > 0) {
            this.loading = false;
          }
          if (result.isComplete) {
            this.loading = false;
            this.loadingProgress = false;
          }

          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('GroupTypesComponent: Error loading registry model:', error);
          this.loading = false;
          this.loadingProgress = false;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    // Trigger smart view mode after view is initialized if we already have data
    if (!this.loading && this.groupTypesList.length > 0 && !this.userHasChangedView) {
      setTimeout(() => this.setSmartViewMode(), 0);
    }
  }

  private applyClientSideFilter(): void {
    if (!this.groupTypesList || this.groupTypesList.length === 0) {
      this.filteredGroupTypesList = [];
      return;
    }

    const previousCount = this.filteredGroupTypesList.length;

    if (!this.currentSearchTerm || this.currentSearchTerm.trim().length === 0) {
      this.filteredGroupTypesList = [...this.groupTypesList];
    } else {
      const term = this.currentSearchTerm.toLowerCase().trim();
      this.filteredGroupTypesList = this.groupTypesList.filter(item => {
        // Search in group type name, plural name, and description
        const searchableText = [
          item.groupType,
          item.model.plural,
          item.model.description || ''
        ].join(' ').toLowerCase();
        return searchableText.includes(term);
      });
    }

    // If user hasn't manually changed view and the filtered count changed, update view mode
    if (!this.userHasChangedView && previousCount !== this.filteredGroupTypesList.length && this.filteredGroupTypesList.length > 0) {
      setTimeout(() => this.setSmartViewMode(), 0);
    }
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.userHasChangedView = true;
  }

  /**
   * Set smart view mode based on item count and viewport constraints
   */
  private setSmartViewMode(): void {
    const itemCount = this.filteredGroupTypesList.length;

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
      const gridContainer = this.elementRef.nativeElement.querySelector('.grid-container.cards-view');
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

  /**
   * Get the resource types count for a group type
   */
  getResourceTypesCount(groupType: GroupType): number {
    return groupType.resources ? Object.keys(groupType.resources).length : 0;
  }

  /**
   * Get the resource types array for a group type
   */
  getResourceTypesList(groupType: GroupType): string[] {
    return groupType.resources ? Object.keys(groupType.resources) : [];
  }

  /**
   * Get a generic icon name for group types
   */
  getIconName(groupType: string): string {
    return 'category';
  }

  /**
   * Get generic CSS class for group type icon styling
   */
  getIconClass(groupType: string): string {
    return 'icon-group-type';
  }

  /**
   * Get the resource collection route for a group type
   * Navigates to the groups page for browsing available groups and their resources
   */
  getResourceCollectionRoute(groupTypeItem: { groupType: string; model: GroupType }): string[] {
    return [groupTypeItem.groupType];
  }

  /**
   * Check if auto-forwarding should occur when there's only one group type
   */
  private checkAutoForward(): void {
    // Only auto-forward if:
    // 1. We have exactly one group type
    // 2. We're not searching (currentSearchTerm is empty)
    // 3. The data loading is complete (not expecting more data)
    if (!this.loadingProgress &&
        !this.currentSearchTerm &&
        this.groupTypesList.length === 1) {

      const singleGroupType = this.groupTypesList[0];
      this.debug.log('GroupTypesComponent: Auto-forwarding to single group type:', singleGroupType.groupType);

      // Navigate to the groups page for this group type
      this.router.navigate([singleGroupType.groupType]);
    }
  }
}
