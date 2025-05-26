import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, of, switchMap, tap, catchError, map, Subject, takeUntil } from 'rxjs';
import { RegistryService } from '../../services/registry.service';
import { ModelService } from '../../services/model.service';
import { SearchService } from '../../services/search.service';
import { ResourceDocument } from '../../models/registry.model';
import { ResourceDocumentComponent } from '../resource-document/resource-document.component';
import { LinkSet, PaginationComponent } from '../pagination/pagination.component';

@Component({
  selector: 'app-resource',
  standalone: true,
  imports: [CommonModule, RouterModule, ResourceDocumentComponent, PaginationComponent],
  templateUrl: './resource.component.html',
  styleUrl: './resource.component.scss',
})
export class ResourceComponent implements OnInit, OnDestroy {
  groupType!: string;
  groupId!: string;
  resourceType!: string;
  resourceId!: string;
  resourceTypeData: any;
  hasMultipleVersions = false;
  defaultVersion$!: Observable<ResourceDocument>;
  resourceAttributes: { [key: string]: any } = {};
  loading = true; // Add loading property for template reference
  // Document handling properties
  isLoadingDocument = false;
  documentError: string | null = null;
  cachedDocumentContent: string | null = null;
  cachedResourceId: string | null = null;
  // Add property to expose origin for display
  defaultVersionOrigin?: string;
  versionsList: any[] = [];
  filteredVersionsList: any[] = [];
  pageLinks: LinkSet = {};
  currentSearchTerm = '';
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    private modelService: ModelService,
    private searchService: SearchService
  ) {}
  ngOnInit(): void {
    this.loading = true;
    // Reset document state when initializing
    this.isLoadingDocument = false;
    this.documentError = null;
    this.cachedDocumentContent = null;
    this.cachedResourceId = null;

    this.route.paramMap
      .pipe(
        tap((params) => {
          this.groupType = params.get('groupType')!;
          this.groupId = params.get('groupId')!;
          this.resourceType = params.get('resourceType')!;
          this.resourceId = params.get('resourceId')!;

          // Subscribe to search state changes for version searches
          this.searchService.searchState$
            .pipe(takeUntil(this.destroy$))
            .subscribe(state => {
              if (state.context?.groupType === this.groupType &&
                  state.context?.groupId === this.groupId &&
                  state.context?.resourceType === this.resourceType &&
                  state.context?.resourceId === this.resourceId) {
                this.currentSearchTerm = state.searchTerm;
                this.applyVersionFilter();
              }
            });
        }),
        switchMap(() => this.modelService.getRegistryModel())
      )
      .subscribe({
        next: (model) => {
          if (
            !model.groups[this.groupType] ||
            !model.groups[this.groupType].resources[this.resourceType]
          ) {
            console.error(
              `Resource type ${this.resourceType} not found in group type ${this.groupType}`
            );
            return;
          }

          this.resourceTypeData =
            model.groups[this.groupType].resources[this.resourceType];
          this.resourceAttributes = this.resourceTypeData.attributes || {};

          // Check if this resource type supports multiple versions
          // According to xRegistry spec, maxversions property determines version storage count
          this.hasMultipleVersions = this.resourceTypeData.maxversions != 1;

          if (this.hasMultipleVersions) {
            this.loadDefaultVersion();
            this.loadVersions();
          } else {
            // Load only default version when single version is supported
            this.loadDefaultVersion();
          }
        },
        error: (err) => {
          console.error('Error loading registry model:', err);
        },
      });
  }

  /**
   * Loads the default version of the resource
   */
  loadDefaultVersion(): void {
    this.defaultVersion$ = this.registry
      .getResourceDetail(
        this.groupType,
        this.groupId,
        this.resourceType,
        this.resourceId,
        this.resourceTypeData?.hasdocument || false
      )
      .pipe(
        tap((version) => {
          // Set loading to false when the default version is loaded
          this.loading = false;
          this.defaultVersionOrigin = version?.origin;

          // Debug: log the version details to see what document fields we're getting
          console.log('Default version loaded:', version);
          console.log('Document fields in version:', {
            hasResource: !!version.resource,
            hasResourceUrl: !!version.resourceUrl,
            hasResourceBase64: !!version.resourceBase64,
            hasDocument:
              !!version.resource ||
              !!version.resourceBase64 ||
              !!version.resourceUrl,
            resourceType: this.resourceType,
            hasDocumentSupport: this.resourceTypeData?.hasdocument || false,
          });
        }),
        catchError((err) => {
          console.error('Error loading default version:', err);
          this.loading = false;
          return of({} as ResourceDocument);
        })
      );
  }

  /**
   * Loads paginated version history using relation-based links
   */
  loadVersions(pageRel: string = ''): void {
    this.loading = true;
    const filter = this.searchService.generateNameFilter(this.currentSearchTerm);
    this.registry.getResourceVersions(
      this.groupType,
      this.groupId,
      this.resourceType,
      this.resourceId,
      pageRel,
      filter
    ).subscribe(page => {
      const items = page.items.sort((a, b) => new Date(b.modifiedAt || b['modifiedat']).getTime() - new Date(a.modifiedAt || a['modifiedat']).getTime());
      // mark default version
      const dv = items.find(v => v.isDefault);
      this.versionsList = items.map(v => ({ ...v, isDefault: dv ? v.id === dv.id : false }));
      this.pageLinks = page.links;
      this.applyVersionFilter();
      this.loading = false;
    });
  }

  private applyVersionFilter(): void {
    this.filteredVersionsList = this.searchService.filterItems(this.versionsList, this.currentSearchTerm);
  }

  onVersionPageChange(rel: string): void {
    this.loadVersions(rel);
  }

  objectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') {
      console.warn('Invalid object passed to objectKeys:', obj);
      return [];
    }
    return Object.keys(obj);
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  isObject(value: any): boolean {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  hasValue(value: any): boolean {
    if (value == null) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (this.isObject(value)) {
      return Object.keys(value).length > 0;
    }
    return value !== '';
  }
  get displayAttributes(): string[] {
    const staticKeys = [
      'xid',
      'self',
      'epoch',
      'isdefault',
      'ancestor',
      'versionscount',
      'versionsurl',
      'metaurl',
      'createdat',
      'modifiedat',
    ];
    const singular = this.getSingularName(this.resourceType);
    return Object.keys(this.resourceAttributes || {}).filter(
      (key) =>
        !staticKeys.includes(key) &&
        key !== singular &&
        key !== `${singular}url` &&
        key !== `${singular}base64`
    );
  }

  // Document handling methods
  /**
   * Gets the singular name of a resource type
   */
  getSingularName(resourceType: string): string {
    return resourceType.endsWith('s')
      ? resourceType.slice(0, -1)
      : resourceType;
  }

  /**
   * Checks if the version has a document (using any of the supported formats)
   */
  hasDocument(version: any, resourceType: string): boolean {
    if (!version) {
      console.log(`Document check failed - version is null or undefined`);
      return false;
    }

    const hasDoc = !!(
      version.resource ||
      version.resourceUrl ||
      version.resourceBase64
    );

    return hasDoc;
  }
  /**
   * Gets document content from any available source
   */
  getDocumentContent(
    version: ResourceDocument,
    resourceType: string
  ): string | null {
    if (!version || !this.resourceTypeData?.hasdocument) {
      console.log(
        `Cannot get document content - version: ${!!version}, resourceType has document: ${!!this
          .resourceTypeData?.hasdocument}`
      );
      return null;
    }

    console.log(`Getting document content for ${resourceType}`, {
      hasResource: !!version.resource,
      hasResourceUrl: !!version.resourceUrl,
      hasResourceBase64: !!version.resourceBase64,
      hasDocument:
        !!version.resource || !!version.resourceBase64 || !!version.resourceUrl,
    });

    // Clear previous cached content if we're fetching for a different resource
    if (
      !this.cachedResourceId ||
      this.cachedResourceId !== `${resourceType}/${version.id}`
    ) {
      console.log(
        `Clearing cached document content for new resource: ${resourceType}/${version.id}`
      );
      this.cachedDocumentContent = null;
      this.cachedResourceId = `${resourceType}/${version.id}`;
    }

    // If URL is available, fetch the content
    if (
      version.resourceUrl &&
      !this.isLoadingDocument &&
      !this.cachedDocumentContent
    ) {
      console.log(`Fetching document from URL: ${version.resourceUrl}`);
      this.fetchDocumentFromUrl(version.resourceUrl);
    }

    if (version.resource && !this.cachedDocumentContent) {
      console.log(`Using resource field for document content`);
      this.cachedDocumentContent = JSON.stringify(version.resource);
    }

    if (version.resourceBase64 && !this.cachedDocumentContent) {
      console.log(`Using base64 resource field for document content`);
      this.cachedDocumentContent = atob(version.resourceBase64);
    }

    // If we already have cached content, return it
    if (this.cachedDocumentContent) {
      return this.cachedDocumentContent;
    }

    return null;
  }

  /**
   * Determines the content type for styling purposes
   */
  getDocumentContentType(content: string): string {
    try {
      JSON.parse(content);
      return 'json-content';
    } catch (e) {
      return 'text-content';
    }
  }
  /**
   * Formats document content for display
   */
  formatDocumentContent(content: string): string {
    if (!content) {
      console.log('No content to format');
      return '';
    }

    try {
      // Try to pretty-print JSON
      const obj = JSON.parse(content);
      console.log('Formatting content as JSON');
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      // If not JSON, return as is
      console.log('Content is not JSON, returning as is');
      return content;
    }
  }

  /**
   * Checks if base64 encoded document is available
   */
  hasBase64Document(version: any, resourceType: string): boolean {
    if (!version || !this.resourceTypeData?.hasdocument) {
      return false;
    }

    return version.resourceBase64 && version.resourceBase64.length > 0;
  }

  /**
   * Downloads base64 encoded document
   */
  downloadBase64Document(version: any, resourceType: string): void {
    if (!version || !this.resourceTypeData?.hasdocument) {
      return;
    }

    const base64Data = version.resourceBase64;

    if (!base64Data) {
      return;
    }

    try {
      // Create a blob from the base64 data
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes]);

      // Create a download link
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${resourceType}_${version.id}_document`;
      link.click();

      // Clean up
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading document:', error);
      this.documentError = 'Failed to download document';
    }
  }

  /**
   * Fetches document content from URL
   */
  private fetchDocumentFromUrl(url: string): void {
    this.isLoadingDocument = true;
    this.documentError = null;

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch document: ${response.status} ${response.statusText}`
          );
        }
        return response.text();
      })
      .then((content) => {
        this.cachedDocumentContent = content;
        this.isLoadingDocument = false;
      })
      .catch((error) => {
        console.error('Error fetching document:', error);
        this.documentError = error.message;
        this.isLoadingDocument = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
