import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewEncapsulation, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, map, Subject, takeUntil } from 'rxjs';
import { RegistryService } from '../../services/registry.service';
import { ResourceDocument } from '../../models/registry.model';
import { ModelService } from '../../services/model.service';
import { ResourceDocumentComponent } from '../resource-document/resource-document.component';
import { LinkSet, PaginationComponent } from '../pagination/pagination.component';
import { ResourceRowComponent } from '../resource-row/resource-row.component';
import { SearchService } from '../../services/search.service';
import { DebugService } from '../../services/debug.service';

@Component({
  standalone: true,
  selector: 'app-resources',
  imports: [CommonModule, RouterModule, ResourceDocumentComponent, PaginationComponent, ResourceRowComponent],
  templateUrl: './resources.component.html',
  styleUrls: ['./resources.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class ResourcesComponent implements OnInit, OnDestroy {
  groupType!: string;
  groupId!: string;
  resourceType!: string;
  resourcesList: ResourceDocument[] = [];
  filteredResourcesList: ResourceDocument[] = [];
  pageLinks: { first?: string; prev?: string; next?: string; last?: string } = {};
  resTypeHasDocument = false;
  resourceAttributes: { [key: string]: any } = {}; // Metadata for attributes
  loading = true; // Add loading property for template reference
  viewMode: 'cards' | 'list' = 'cards'; // Default view mode
  currentSearchTerm = '';
  private destroy$ = new Subject<void>();

  private suppressAttributes = ['xid', 'self', 'epoch', 'isdefault', 'ancestor', 'versionscount', 'versionsCount', 'versionsurl', 'metaurl', 'createdat', 'modifiedat', 'createdAt', 'modifiedAt'];

  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    private modelService: ModelService,
    private searchService: SearchService,
    private debug: DebugService
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.route.paramMap.subscribe(params => {
      this.groupType = params.get('groupType')!;
      this.groupId = params.get('groupId')!;
      this.resourceType = params.get('resourceType')!;

      // Load resource type metadata
      this.modelService.getRegistryModel().pipe(
        map(m => m.groups[this.groupType].resources[this.resourceType])
      ).subscribe(rtModel => {
        this.resourceAttributes = rtModel.attributes || {};
        this.resTypeHasDocument = rtModel.hasdocument;
      });
      // Subscribe to search state changes
      this.searchService.searchState$
        .pipe(takeUntil(this.destroy$))
        .subscribe(state => {
          this.debug.log('Resources received search state:', state, 'My context:', { groupType: this.groupType, groupId: this.groupId, resourceType: this.resourceType });
          if (state.context?.groupType === this.groupType &&
              state.context?.groupId === this.groupId &&
              state.context?.resourceType === this.resourceType) {
            this.debug.log('Search context matches, updating search term:', state.searchTerm);
            this.currentSearchTerm = state.searchTerm;
            this.applyClientSideFilter();
          }
        });

      this.loadResources();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadResources(pageRel: string = ''): void {
    this.loading = true;
    const filter = this.searchService.generateNameFilter(this.currentSearchTerm);
    this.registry.listResources(this.groupType, this.groupId, this.resourceType, pageRel, filter)
      .subscribe(page => {
        this.debug.log('loadResources links:', page.links);
        this.resourcesList = page.items;
          // Process resources to ensure all required fields are present
        this.resourcesList = this.resourcesList.map(resource => {
          // Ensure name is available
          if (!resource['name'] && resource['id']) {
            resource['name'] = resource['id'];
          }

          // Ensure resourceUrl is mapped from docs
          if (!resource['resourceUrl'] && resource['docs']) {
            resource['resourceUrl'] = resource['docs'];
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
        this.applyClientSideFilter();
        this.loading = false;

        // Set default view mode based on the number of items
        if (this.resourcesList.length > 20) {
          this.viewMode = 'list';
        } else {
          this.viewMode = 'cards';
        }
      });
  }

  private applyClientSideFilter(): void {
    this.filteredResourcesList = this.searchService.filterItems(this.resourcesList, this.currentSearchTerm);
  }

  onPageChange(pageRel: string): void {
    this.loadResources(pageRel);
  }

  setViewMode(mode: 'cards' | 'list'): void {
    this.viewMode = mode;
  }

  // These methods are now handled by the ResourceDocumentComponent
  // Keeping displayAttributes for backward compatibility, but we'll no longer use it in the template
  get displayAttributes(): string[] {
    return Object.keys(this.resourceAttributes || {}).filter(
      key => !this.suppressAttributes.includes(key)
    );
  }
}
