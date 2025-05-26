import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';
import { ModelService } from '../../services/model.service';
import { DebugService } from '../../services/debug.service';
import { SearchService } from '../../services/search.service';
import { ConfigService } from '../../services/config.service';
import { GroupType } from '../../models/registry.model';

@Component({
  standalone: true,
  selector: 'app-group-types',
  imports: [CommonModule, RouterModule],
  templateUrl: './group-types.component.html',
  styleUrls: ['./group-types.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class GroupTypesComponent implements OnInit, OnDestroy {
  viewMode: 'cards' | 'list' = 'cards'; // Default view mode
  groupTypesList: { groupType: string; model: GroupType }[] = [];
  filteredGroupTypesList: { groupType: string; model: GroupType }[] = [];
  currentSearchTerm = '';
  loading = true;
  loadingProgress = true; // Tracks if we're still expecting more data
  private destroy$ = new Subject<void>();
  private initialLoad = true;

  constructor(
    private modelService: ModelService,
    private cdr: ChangeDetectorRef,
    private debug: DebugService,
    private searchService: SearchService,
    private configService: ConfigService
  ) {}

  ngOnInit(): void {

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

            // Set default view mode based on the number of items (only on first significant load)
            if (this.initialLoad && this.groupTypesList.length > 0) {
              if (this.groupTypesList.length > 10) {
                this.viewMode = 'list';
              } else {
                this.viewMode = 'cards';
              }
              this.initialLoad = false;
            }

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
  }

  setViewMode(mode: 'cards' | 'list'): void {
    this.viewMode = mode;
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


}
