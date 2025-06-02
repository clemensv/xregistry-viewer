import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation, OnDestroy, ElementRef, AfterViewInit, HostListener, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
import { ResourceDocumentItemComponent } from '../resource-document-item/resource-document-item.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  standalone: true,
  selector: 'app-group-types',
  imports: [CommonModule, RouterModule, PageHeaderComponent, ResourceDocumentItemComponent, IconComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './group-types.component.html',
  styleUrls: ['./group-types.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class GroupTypesComponent implements OnInit, OnDestroy, AfterViewInit {
  viewMode: ViewMode = 'cards'; // Always default to cards (tile) mode
  groupTypesList: { groupType: string; model: GroupType }[] = [];
  filteredGroupTypesList: { groupType: string; model: GroupType }[] = [];
  currentSearchTerm = '';
  loading = true;
  loadingProgress = true; // Tracks if we're still expecting more data
  private destroy$ = new Subject<void>();
  private initialLoad = true;
  private userHasChangedView = false; // Track if user manually changed view mode
  expandedDetails = new Set<string>(); // Track which group types have expanded details (public for template)

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

    // Listen for configuration changes and reload data
    this.configService.configChanges$
      .pipe(takeUntil(this.destroy$))
      .subscribe(newConfig => {
        console.log('GroupTypesComponent: Configuration changed, reloading data...');
        console.log('GroupTypesComponent: New config API endpoints:', newConfig.apiEndpoints);
        console.log('GroupTypesComponent: Previous group types count:', this.groupTypesList.length);
        this.reloadData();
      });

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
        this.debug.log('GroupTypesComponent: Timeout waiting for config, proceeding anyway');
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

            // Always keep cards mode as default - removed smart view mode logic
            if (this.initialLoad && this.groupTypesList.length > 0 && !this.userHasChangedView) {
              this.viewMode = 'cards'; // Always default to cards mode
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

  /**
   * Reloads the data by clearing cache and reinitializing
   */
  private reloadData(): void {
    console.log('GroupTypesComponent: Starting reload process...');

    // Reset loading states
    this.loading = true;
    this.loadingProgress = true;
    this.groupTypesList = [];
    this.filteredGroupTypesList = [];
    this.cdr.markForCheck();

    // Clear all caches to force reload from new endpoints
    console.log('GroupTypesComponent: Clearing all ModelService caches...');
    this.modelService.clearAllCaches();

    // Force the model service to reload by clearing any cached data
    // This ensures we get fresh data from the new endpoints
    console.log('GroupTypesComponent: Starting data load...');
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    // Always ensure cards mode is set after view initialization
    if (!this.loading && this.groupTypesList.length > 0 && !this.userHasChangedView) {
      this.viewMode = 'cards';
      this.cdr.markForCheck();
    }
  }

  private applyClientSideFilter(): void {
    if (!this.groupTypesList || this.groupTypesList.length === 0) {
      this.filteredGroupTypesList = [];
      return;
    }

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

    // Always sort group types by name alphabetically
    this.filteredGroupTypesList.sort((a, b) => a.groupType.localeCompare(b.groupType));

    // Removed smart view mode logic - always keep user's choice or default to cards
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.userHasChangedView = true;
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
   * Get resource types with their descriptions for a group type
   */
  getResourceTypesWithDescriptions(groupType: GroupType): { name: string; description?: string }[] {
    if (!groupType.resources) {
      return [];
    }

    return Object.entries(groupType.resources).map(([name, resource]) => ({
      name,
      description: resource.description
    }));
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
   * Get the model route for a group type
   * Navigates to the model page with the specific group type scrolled into view
   */
  getModelRoute(groupTypeItem: { groupType: string; model: GroupType }): string[] {
    return ['/model', groupTypeItem.groupType];
  }

  /**
   * Get the list of origins (API endpoints) that support this group type
   */
  getOriginsForGroupType(groupType: string): string[] {
    return this.modelService.getApiEndpointsForGroupType(groupType);
  }

  /**
   * Get tooltip text for origins column
   */
  getOriginsTooltip(groupType: string): string {
    const origins = this.getOriginsForGroupType(groupType);
    if (origins.length === 0) {
      return 'No origins available';
    }
    return `Origins (${origins.length}): ${origins.join(', ')}`;
  }

  /**
   * Get tooltip text for resource types column
   */
  getResourceTypesTooltip(groupType: GroupType): string {
    const resourceTypes = this.getResourceTypesList(groupType);
    if (resourceTypes.length === 0) {
      return 'No resource types available';
    }
    return `Resource Types (${resourceTypes.length}): ${resourceTypes.join(', ')}`;
  }

  /**
   * Navigate to groups filtered by origin
   */
  navigateToGroupsByOrigin(groupType: string, origin: string): void {
    this.router.navigate([groupType], { queryParams: { origin: origin } });
  }

  /**
   * Check if auto-forwarding should occur when there's only one group type
   */
  private checkAutoForward(): void {
    // Auto-forward to the single group type if only one exists
    if (this.filteredGroupTypesList.length === 1 && !this.currentSearchTerm) {
      const singleGroupType = this.filteredGroupTypesList[0];
      this.router.navigate(this.getResourceCollectionRoute(singleGroupType));
    }
  }

  /**
   * Transform group type data into resource document items for consistent display
   */
  getGroupTypeItems(groupTypeItem: { groupType: string; model: GroupType }): any[] {
    const items: any[] = [];

    // Group Type Name
    items.push({
      key: 'groupType',
      name: 'Group Type',
      type: 'String',
      description: 'The identifier for this group type',
      value: groupTypeItem.groupType,
      isComplex: false
    });

    // Plural Name
    items.push({
      key: 'plural',
      name: 'Plural Name',
      type: 'String',
      description: 'The plural form of the group type name',
      value: groupTypeItem.model.plural,
      isComplex: false
    });

    // Description
    if (groupTypeItem.model.description) {
      items.push({
        key: 'description',
        name: 'Description',
        type: 'String',
        description: 'Description of this group type',
        value: groupTypeItem.model.description,
        isComplex: false
      });
    }

    // Origins
    const origins = this.getOriginsForGroupType(groupTypeItem.groupType);
    if (origins.length > 0) {
      items.push({
        key: 'origins',
        name: 'Origins',
        type: 'Array[String]',
        description: `Available origins for this group type (${origins.length})`,
        value: origins,
        isComplex: true,
        isArray: true,
        arrayItems: origins.map(origin => ({
          key: origin,
          name: origin,
          type: 'String',
          value: origin,
          isComplex: false,
          clickAction: () => this.navigateToGroupsByOrigin(groupTypeItem.groupType, origin)
        }))
      });
    }

    // Resource Types
    const resourceTypes = this.getResourceTypesList(groupTypeItem.model);
    if (resourceTypes.length > 0) {
      items.push({
        key: 'resourceTypes',
        name: 'Resource Types',
        type: 'Array[String]',
        description: `Available resource types for this group type (${resourceTypes.length})`,
        value: resourceTypes,
        isComplex: true,
        isArray: true,
        arrayItems: resourceTypes.map(rt => ({
          key: rt,
          name: rt,
          type: 'String',
          value: rt,
          isComplex: false
        }))
      });
    }

    return items;
  }

  /**
   * Get simple items for a group type (non-complex attributes)
   */
  getSimpleItems(groupTypeItem: { groupType: string; model: GroupType }): any[] {
    return this.getGroupTypeItems(groupTypeItem).filter(item => !item.isComplex);
  }

  /**
   * Get complex items for a group type (arrays, objects)
   */
  getComplexItems(groupTypeItem: { groupType: string; model: GroupType }): any[] {
    return this.getGroupTypeItems(groupTypeItem).filter(item => item.isComplex);
  }

  /**
   * Get filtered simple items (excluding groupType, plural, and description)
   */
  getFilteredSimpleItems(groupTypeItem: { groupType: string; model: GroupType }): any[] {
    const excludedKeys = ['groupType', 'plural', 'description'];
    return this.getSimpleItems(groupTypeItem).filter(item => !excludedKeys.includes(item.key));
  }

  /**
   * Toggle details expansion for a group type
   */
  toggleDetails(groupType: string): void {
    // Close all other details first (only one popup at a time)
    this.expandedDetails.clear();

    // Then open the requested one
    this.expandedDetails.add(groupType);
  }

  /**
   * Check if details are expanded for a group type
   */
  isDetailsExpanded(groupType: string): boolean {
    return this.expandedDetails.has(groupType);
  }

  /**
   * Close all expanded details
   */
  closeAllDetails(): void {
    this.expandedDetails.clear();
    this.cdr.markForCheck();
  }

  /**
   * Get array of expanded group types for template iteration
   */
  getExpandedGroupTypes(): string[] {
    return Array.from(this.expandedDetails);
  }

  /**
   * Get group type model by group type name
   */
  getGroupTypeModel(groupType: string): { groupType: string; model: GroupType } | undefined {
    return this.filteredGroupTypesList.find(gt => gt.groupType === groupType);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // Close all expanded details when Escape is pressed
      if (this.expandedDetails.size > 0) {
        this.expandedDetails.clear();
        this.cdr.markForCheck();
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }
}
