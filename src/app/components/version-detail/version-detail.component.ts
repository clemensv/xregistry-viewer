import { CommonModule } from '@angular/common';
import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { switchMap, map, tap, catchError, takeUntil } from 'rxjs/operators';
import { RegistryService } from '../../services/registry.service';
import { ResourceDocument } from '../../models/registry.model';
import { combineLatest, of } from 'rxjs';
import { ModelService } from '../../services/model.service';
import { ResourceDocumentComponent } from '../resource-document/resource-document.component';
import { DocumentationViewerComponent } from '../documentation-viewer/documentation-viewer.component';
import { DebugService } from '../../services/debug.service';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ErrorBoundaryComponent } from '../error-boundary/error-boundary.component';
import { DeprecationIndicatorComponent } from '../deprecation-indicator/deprecation-indicator.component';
import { CrossReferenceComponent } from '../cross-reference/cross-reference.component';

@Component({
  standalone: true,
  selector: 'app-version-detail',
  imports: [
    CommonModule,
    ResourceDocumentComponent,
    DocumentationViewerComponent,
    LoadingIndicatorComponent,
    EmptyStateComponent,
    ErrorBoundaryComponent,
    DeprecationIndicatorComponent,
    CrossReferenceComponent
  ],
  templateUrl: './version-detail.component.html',
  styleUrls: ['./version-detail.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class VersionDetailComponent implements OnInit, OnDestroy {
  version$!: Observable<ResourceDocument | null>;
  groupType!: string;
  groupId!: string;
  resourceType!: string;
  resourceId!: string;
  versionId!: string;
  resourceAttributes: { [key: string]: any } = {};
  resTypeHasDocument: boolean = false;

  isLoadingDocument = false;
  documentError: string | null = null;
  cachedDocumentContent: string | null = null;
  versionOrigin?: string;
  documentationUrl?: string;

  // Error handling properties
  hasError = false;
  errorMessage: string | null = null;
  errorDetails: any = null;
  loading = true;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    private modelService: ModelService,
    private debug: DebugService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.groupType = params.get('groupType')!;
      this.groupId = params.get('groupId')!;
      this.resourceType = params.get('resourceType')!;
      this.resourceId = params.get('resourceId')!;
      this.versionId = params.get('versionId')!;

      this.debug.log(`Version Detail Component initialized with:`, {
        groupType: this.groupType,
        groupId: this.groupId,
        resourceType: this.resourceType,
        resourceId: this.resourceId,
        versionId: this.versionId
      });

      // Reset error state
      this.hasError = false;
      this.errorMessage = null;
      this.errorDetails = null;
      this.loading = true;

      // Load the version details
      this.loadVersionDetails();
    });
  }

  private loadVersionDetails(): void {
    // First load metadata, then load the version details
    this.debug.log('=== Starting loadVersionDetails ===');
    this.debug.log(`Loading version details for URL: ${this.groupType}/${this.groupId}/${this.resourceType}/${this.resourceId}/versions/${this.versionId}`);
    this.debug.log('About to call modelService.getRegistryModel()');
    this.loading = true;
    this.hasError = false;
    this.errorMessage = null;
    this.errorDetails = null;

    this.version$ = this.modelService.getRegistryModel().pipe(
      tap(model => {
        this.debug.log('=== MODEL SERVICE RESPONSE ===');
        this.debug.log('Registry model received:', model);
        this.debug.log('Available groups:', Object.keys(model.groups || {}));
        this.debug.log('Looking for group type:', this.groupType);
        // Force early error detection for invalid group types
        if (!model.groups || !model.groups[this.groupType]) {
          throw {
            name: 'InvalidGroupTypeError',
            message: `Group type '${this.groupType}' not found in registry`,
            status: 404,
            availableGroupTypes: Object.keys(model.groups || {})
          };
        }
      }),
      map(model => {
        // Check if the group type exists
        if (!model.groups[this.groupType]) {
          this.debug.log('=== GROUP TYPE NOT FOUND ===');
          this.debug.log('Throwing InvalidGroupTypeError');
          throw {
            name: 'InvalidGroupTypeError',
            message: `Group type '${this.groupType}' not found in registry`,
            status: 404,
            availableGroupTypes: Object.keys(model.groups)
          };
        }

        this.debug.log('Group type found, checking resource type...');
        // Check if the resource type exists in the group
        const resourceTypeModel = model.groups[this.groupType]?.resources[this.resourceType];
        if (!resourceTypeModel) {
          this.debug.log('=== RESOURCE TYPE NOT FOUND ===');
          this.debug.log('Available resource types:', Object.keys(model.groups[this.groupType]?.resources || {}));
          throw {
            name: 'InvalidResourceTypeError',
            message: `Resource type '${this.resourceType}' not found in group '${this.groupType}'`,
            status: 404,
            availableResourceTypes: Object.keys(model.groups[this.groupType]?.resources || {})
          };
        }

        this.debug.log('Resource type found:', resourceTypeModel);
        return resourceTypeModel;
      }),
      tap((resourceTypeModel: any) => {
        this.resourceAttributes = resourceTypeModel.attributes || {};
        this.resTypeHasDocument = resourceTypeModel.hasdocument !== false;
        this.debug.log(`Resource type ${this.resourceType} document support: ${this.resTypeHasDocument}`);
      }),
      switchMap(() => {
        this.debug.log(`Loading version detail with document support: ${this.resTypeHasDocument}`);
        return this.registry.getVersionDetail(
          this.groupType,
          this.groupId,
          this.resourceType,
          this.resourceId,
          this.versionId,
          this.resTypeHasDocument
        );
      }),
      tap((versionDetail: ResourceDocument) => {
        this.debug.log('Version detail loaded:', versionDetail);
        this.loading = false;
        this.hasError = false;
        this.versionOrigin = versionDetail?.origin;
        this.documentationUrl = versionDetail?.['documentation'];
      }),
      catchError((err) => {
        this.debug.log('=== ERROR CAUGHT IN VERSION DETAIL ===');
        this.debug.log('Error object:', err);
        this.debug.log('Error name:', err.name);
        this.debug.error('Error loading version detail:', err);
        this.loading = false;
        this.hasError = true;
        this.errorDetails = err;

        // Handle specific error types with better messages
        if (err.name === 'InvalidGroupTypeError') {
          this.errorMessage = `The group type '${this.groupType}' does not exist in the registry. ` +
            `Available group types are: ${err.availableGroupTypes.join(', ')}.`;
        } else if (err.name === 'InvalidResourceTypeError') {
          this.errorMessage = `The resource type '${this.resourceType}' does not exist in group '${this.groupType}'. ` +
            `Available resource types in this group are: ${err.availableResourceTypes.join(', ')}.`;
        } else if (err.status === 404) {
          this.errorMessage = `Version "${this.versionId}" not found for resource "${this.resourceId}" in ${this.groupType}/${this.groupId}/${this.resourceType}.`;
        } else if (err.status === 0) {
          this.errorMessage = `Unable to connect to the registry. Please check your network connection.`;
        } else if (err.status >= 500) {
          this.errorMessage = `Server error occurred while loading the version details. Please try again later.`;
        } else {
          this.errorMessage = `Failed to load version details: ${err.message || 'Unknown error'}`;
        }

        return of(null);
      })
    );

    // Subscribe to the observable explicitly for state tracking only
    // Error handling is already done in the catchError operator
    this.version$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.debug.log('Version data loaded successfully:', data);
      },
      error: (err) => {
        // This should not be reached if catchError is working properly
        this.debug.log('Error in explicit subscription - this should have been caught by catchError:', err);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  objectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') {
      this.debug.warn('Invalid object passed to objectKeys:', obj);
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
    const staticKeys = ['xid', 'self', 'epoch', 'isdefault', 'ancestor', 'versionscount', 'versionsurl', 'metaurl', 'createdat', 'modifiedat'];
    const singular = this.getSingularName(this.resourceType);
    return Object.keys(this.resourceAttributes || {}).filter(
      key => !staticKeys.includes(key) && key !== singular && key !== `${singular}url` && key !== `${singular}base64`
    );
  }

  hasDocument(version: any, resourceType: string): boolean {
    if (!version || !this.resTypeHasDocument) {
      return false;
    }

    return (
      version.resource || version.resourceUrl || version.resourceBase64
    );
  }

  getSingularName(resourceType: string): string {
    return resourceType.endsWith('s') ? resourceType.slice(0, -1) : resourceType;
  }

  getDocumentContent(version: ResourceDocument, resourceType: string): string | null {
    if (!version || !this.resTypeHasDocument) {
      return null;
    }

    // If URL is available, fetch the content
    if (version.resourceUrl && !this.isLoadingDocument) {
      this.fetchDocumentFromUrl(version.resourceUrl);
    }

    if (version.resource) {
      this.cachedDocumentContent = JSON.stringify(version.resource);
    }

    if (version.resourceBase64) {
      this.cachedDocumentContent = atob(version.resourceBase64);
    }

    // If we already have cached content, return it
    if (this.cachedDocumentContent) {
      return this.cachedDocumentContent;
    }

    return null;
  }

  hasBase64Document(version: any, resourceType: string): boolean {
    if (!version || !this.resTypeHasDocument) {
      return false;
    }

    return version.resourceBase64 && version.resourceBase64.length > 0;
  }

  downloadBase64Document(version: any, resourceType: string): void {
    if (!version || !this.resTypeHasDocument) {
      return;
    }

    const base64Data = version.resourceBase64;

    if (!base64Data) {
      return;
    }

    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes]);

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${resourceType}_${version.id}_document`;
      link.click();

      URL.revokeObjectURL(link.href);
    } catch (error) {
      this.debug.error('Error downloading document:', error);
      this.documentError = 'Failed to download document';
    }
  }

  private fetchDocumentFromUrl(url: string): void {
    this.isLoadingDocument = true;
    this.documentError = null;
    this.registry.fetchDocument(url).subscribe({
      next: (content) => {
        this.cachedDocumentContent = content;
        this.isLoadingDocument = false;
      },
      error: (err) => {
        this.debug.error('Error fetching document:', err);
        this.documentError = err.message || 'Failed to load document from URL.';
        this.isLoadingDocument = false;
      }
    });
  }

  isJsonDocument(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch (e) {
      return false;
    }
  }

  formatDocumentContent(content: string): string {
    const contentType = this.getDocumentContentType(content);
    if (contentType === 'json') {
      try {
        const parsedJson = JSON.parse(content);
        return JSON.stringify(parsedJson, null, 2);
      } catch (e) {
        return content;
      }
    }
    return content;
  }

  getDocumentContentType(content: string): string {
    if (content.trim().startsWith('<')) {
      return 'xml';
    }
    if (content.trim().startsWith('---') || content.includes(':\n  ')) {
        return 'yaml';
    }
    return 'json';
  }

  supportsDocuments(): boolean {
    return this.resTypeHasDocument;
  }

  loadDocumentMetadata(): void {
    this.debug.warn('loadDocumentMetadata() is deprecated, metadata loading is handled in ngOnInit');
  }

  isSimpleAttribute(value: any): boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  getPrimitiveAttributes(attributes: any): { key: string, value: any, description?: string }[] {
    if (!attributes || typeof attributes !== 'object') return [];
    return this.objectKeys(attributes)
      .filter(key => this.isSimpleAttribute(attributes[key]))
      .map(key => ({
        key,
        value: attributes[key],
        description: this.resourceAttributes[key]?.description || ''
      }));
  }

  getComplexAttributes(attributes: any): { key: string, value: any, description?: string, type?: string }[] {
    if (!attributes || typeof attributes !== 'object') return [];
    return this.objectKeys(attributes)
      .filter(key => !this.isSimpleAttribute(attributes[key]) && this.hasValue(attributes[key]))
      .map(key => ({
        key,
        value: attributes[key],
        description: this.resourceAttributes[key]?.description || '',
        type: this.resourceAttributes[key]?.type
      }));
  }

  getErrorTitle(): string {
    if (this.errorDetails?.name === 'InvalidGroupTypeError') {
      return 'Invalid Group Type';
    } else if (this.errorDetails?.name === 'InvalidResourceTypeError') {
      return 'Invalid Resource Type';
    }
    return 'Unable to Load Version Details';
  }

  getErrorMessage(): string {
    if (this.errorMessage) {
      return this.errorMessage;
    }
    return 'An unexpected error occurred while loading version details';
  }

  retryLoadVersion(): void {
    this.hasError = false;
    this.errorMessage = null;
    this.errorDetails = null;
    this.loading = true;
    this.loadVersionDetails();
  }
}
