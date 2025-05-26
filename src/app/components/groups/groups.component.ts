import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { RegistryService } from '../../services/registry.service';import { ModelService } from '../../services/model.service';import { DebugService } from '../../services/debug.service';import { Group } from '../../models/registry.model';
import { FormsModule } from '@angular/forms';
import { ResourceDocumentItem } from '../../models/resource-document-item.model';import { ResourceDocumentItemComponent } from '../resource-document-item/resource-document-item.component';import { LinkSet, PaginationComponent } from '../pagination/pagination.component';import { GroupRowComponent } from '../group-row/group-row.component';
import { SearchService } from '../../services/search.service';

@Component({
  standalone: true,
  selector: 'app-groups',
  imports: [CommonModule, RouterModule, FormsModule, PaginationComponent, GroupRowComponent, ResourceDocumentItemComponent],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class GroupsComponent implements OnInit, OnDestroy {
  groupType!: string;
  resourceTypes$!: Observable<string[]>;
  groupAttributes: { [key: string]: any } = {};
  private suppressGroupAttributes = ['groupid', 'self', 'xid', 'epoch', 'createdat', 'modifiedat'];
  registryModel: any = null;
  groupsList: Group[] = [];
  filteredGroupsList: Group[] = [];
  pageLinks: LinkSet = {};
  viewMode: 'cards' | 'list' = 'cards'; // Default view mode
  currentSearchTerm = '';
  private destroy$ = new Subject<void>();

  // Client-side pagination for large datasets
  private allGroupsCache: Group[] = [];
  private currentPage = 1;
  private pageSize = 50;
  private useClientSidePagination = false;

  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    public modelService: ModelService,
    private cdr: ChangeDetectorRef,
    private debug: DebugService,
    private searchService: SearchService
  ) {}

  ngOnInit(): void {
    this.groupType = this.route.snapshot.paramMap.get('groupType') || '';

    // Load group metadata attributes
    this.modelService.getRegistryModel().pipe(
      map(m => m.groups[this.groupType])
    ).subscribe(gtModel => {
      this.groupAttributes = gtModel.attributes || {};
    });

    // Save the full registry model for resource type info
    this.modelService.getRegistryModel().subscribe(model => {
      this.registryModel = model;
    });

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

    // Subscribe to search state changes
    this.searchService.searchState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.debug.log('Groups received search state:', state, 'My groupType:', this.groupType);
        if (state.context?.groupType === this.groupType) {
          this.debug.log('Search context matches, updating search term:', state.searchTerm);
          this.currentSearchTerm = state.searchTerm;
          this.applyClientSideFilter();
        }
      });

    this.loadGroups();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Load groups with current pagination */
  loadGroups(pageRel: string = ''): void {
    // If using client-side pagination, handle it locally
    if (this.useClientSidePagination && pageRel) {
      this.handleClientSidePagination(pageRel);
      return;
    }

    const filter = this.searchService.generateNameFilter(this.currentSearchTerm);
    this.registry.listGroups(this.groupType, pageRel, filter)
      .subscribe(page => {
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

        // Only set default view mode on initial load (when pageRel is empty)
        if (!pageRel) {
          if (this.groupsList.length > 20) {
            this.viewMode = 'list';
          } else {
            this.viewMode = 'cards';
          }
        }

        this.cdr.markForCheck();
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
    this.filteredGroupsList = this.searchService.filterItems(this.groupsList, this.currentSearchTerm);
  }
  onPageChange(pageRel: string): void {
    this.loadGroups(pageRel);
  }

  setViewMode(mode: 'cards' | 'list'): void {
    this.viewMode = mode;
  }

  get displayGroupAttributes(): string[] {
    return Object.keys(this.groupAttributes || {}).filter(
      key => !this.suppressGroupAttributes.includes(key) && !key.endsWith('url')
    );
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
}
