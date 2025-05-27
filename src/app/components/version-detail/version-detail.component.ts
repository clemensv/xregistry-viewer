import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';
import { RegistryService } from '../../services/registry.service';
import { ResourceDocument } from '../../models/registry.model';
import { combineLatest } from 'rxjs';
import { ModelService } from '../../services/model.service';
import { ResourceDocumentComponent } from '../resource-document/resource-document.component';
import { DocumentationViewerComponent } from '../documentation-viewer/documentation-viewer.component';

@Component({
  standalone: true,
  selector: 'app-version-detail',
  imports: [CommonModule, ResourceDocumentComponent, DocumentationViewerComponent],
  templateUrl: './version-detail.component.html',
  styleUrls: ['./version-detail.component.scss']
})
export class VersionDetailComponent implements OnInit {
  version$!: Observable<ResourceDocument>;
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

  constructor(private route: ActivatedRoute, private registry: RegistryService, private modelService: ModelService) {}  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.groupType = params.get('groupType')!;
      this.groupId = params.get('groupId')!;
      this.resourceType = params.get('resourceType')!;
      this.resourceId = params.get('resourceId')!;
      this.versionId = params.get('versionId')!;

      console.log(`Version Detail Component initialized with:`, {
        groupType: this.groupType,
        groupId: this.groupId,
        resourceType: this.resourceType,
        resourceId: this.resourceId,
        versionId: this.versionId
      });      // First load metadata, then load the version details
      this.version$ = this.modelService.getRegistryModel().pipe(
        map(model => model.groups[this.groupType]?.resources[this.resourceType]),
        tap((resourceTypeModel: any) => {
          if (resourceTypeModel) {
            this.resourceAttributes = resourceTypeModel.attributes || {};
            this.resTypeHasDocument = resourceTypeModel.hasdocument !== false;
            console.log(`Resource type ${this.resourceType} document support: ${this.resTypeHasDocument}`);
            this.documentMetadataLoaded = true;
          } else {
            console.warn(`Resource type model not found for ${this.resourceType}`);
            this.resourceAttributes = {};
            this.resTypeHasDocument = false;
          }
        }),
        switchMap(() => {
          console.log(`Loading version detail with document support: ${this.resTypeHasDocument}`);
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
          console.log('Version detail loaded:', versionDetail);
          this.versionOrigin = versionDetail?.origin;
          this.documentationUrl = versionDetail?.['documentation'];
        })
      );
    });
  }

  objectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') {
      console.warn('Invalid object passed to objectKeys:', obj);
      return [];
    }
    return Object.keys(obj);
  }

  // In the template, ensure objectKeys is only called when the object is defined
  // Example usage in the template:
  // *ngIf="resourceAttributes && objectKeys(resourceAttributes).length > 0"

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

  // Document handling methods
  /**
   * Check if the version has a document (using any of the supported formats)
   */
  hasDocument(version: any, resourceType: string): boolean {
    if (!version || !this.resTypeHasDocument) {
      return false;
    }

    return (
      version.resource || version.resourceUrl || version.resourceBase64
    );
  }

  /**
   * Get the singular name of a resource type
   */
  getSingularName(resourceType: string): string {
    // Remove trailing 's' if it exists, or use more sophisticated logic as needed
    return resourceType.endsWith('s') ? resourceType.slice(0, -1) : resourceType;
  }

  /**
   * Get document content from any available source
   */
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

  /**
   * Check if base64 encoded document is available
   */
  hasBase64Document(version: any, resourceType: string): boolean {
    if (!version || !this.resTypeHasDocument) {
      return false;
    }

    return version.resourceBase64 && version.resourceBase64.length > 0;
  }

  /**
   * Download base64 encoded document
   */
  downloadBase64Document(version: any, resourceType: string): void {
    if (!version || !this.resTypeHasDocument) {
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
   * Fetch document content from URL
   */
  private fetchDocumentFromUrl(url: string): void {
    this.isLoadingDocument = true;
    this.documentError = null;
    this.registry.fetchDocument(url).subscribe({
      next: (content) => {
        this.cachedDocumentContent = content;
        this.isLoadingDocument = false;
      },
      error: (err) => {
        console.error('Error fetching document:', err);
        this.documentError = err.message || 'Failed to load document from URL.';
        this.isLoadingDocument = false;
      }
    });
  }

  /**
   * Check if the document content is JSON
   */
  isJsonDocument(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Format document content for display
   */
  formatDocumentContent(content: string): string {
    const contentType = this.getDocumentContentType(content);
    if (contentType === 'json') {
      try {
        const parsedJson = JSON.parse(content);
        return JSON.stringify(parsedJson, null, 2);
      } catch (e) {
        // If parsing fails, return original content
        return content;
      }
    }
    // For other types, return as is, or add specific formatting
    return content;
  }

  /**
   * Get document content type based on content and resource type
   */
  getDocumentContentType(content: string): string {
    // Basic content type detection (can be expanded)
    if (content.trim().startsWith('<')) {
      return 'xml'; // Or 'html'
    }
    if (content.trim().startsWith('---') || content.includes(':\n  ')) {
        return 'yaml';
    }
    // Add more checks for other types like YAML, etc.
    return 'json'; // Default to json or plain text
  }

  /**
   * Check if this resource type supports documents
   */
  supportsDocuments(): boolean {
    return this.resTypeHasDocument;
  }

  /**
   * Track whether we've tried to load document metadata
   */
  private documentMetadataLoaded = false;
    /**
   * Load document metadata - no longer used, logic moved to ngOnInit
   * This method is kept for reference, but is never called.
   */
  private loadDocumentMetadata(): void {
    console.warn('loadDocumentMetadata() is deprecated, metadata loading is handled in ngOnInit');
    if (this.documentMetadataLoaded) {
      return;
    }

    this.documentMetadataLoaded = true;

    this.modelService.getRegistryModel().pipe(
      map(m => m.groups[this.groupType]?.resources[this.resourceType])
    ).subscribe(rtModel => {
      this.resourceAttributes = rtModel?.attributes || {};
      this.resTypeHasDocument = rtModel?.hasdocument !== false;

      console.info(`Resource type ${this.resourceType} document support: ${this.resTypeHasDocument}`);
    }, error => {
      console.error('Error fetching registry model:', error);
      this.resourceAttributes = {};
      this.resTypeHasDocument = false;
    });
  }

  // Add these helper methods for attribute display
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
}
