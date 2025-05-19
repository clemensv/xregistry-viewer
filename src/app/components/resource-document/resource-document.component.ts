import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResourceDocument } from '../../models/registry.model';
import { CodeHighlightComponent } from '../code-highlight/code-highlight.component';
import { RegistryService } from '../../services/registry.service';
import { ResourceDocumentItemComponent } from '../resource-document-item/resource-document-item.component';
import { ResourceDocumentItem } from '../../models/resource-document-item.model';

@Component({
  selector: 'app-resource-document',
  standalone: true,
  imports: [CommonModule, CodeHighlightComponent, ResourceDocumentItemComponent],
  templateUrl: './resource-document.component.html',
  styleUrl: './resource-document.component.scss'
})
export class ResourceDocumentComponent implements OnInit {
  @Input() resourceDocument!: ResourceDocument;
  @Input() resourceType!: string;  @Input() resourceAttributes: { [key: string]: any } = {};
  @Input() hasDocumentSupport: boolean = false;
  @Input() showAttributes: boolean = true;
  @Input() showDocument: boolean = true;
  @Input() initialExpanded: boolean = false;

  // Document handling properties
  isLoadingDocument = false;
  documentError: string | null = null;
  cachedDocumentContent: string | null = null;

  constructor(private registry: RegistryService) {}
  ngOnInit(): void {
    // Clear cached content when component initializes with new data
    this.cachedDocumentContent = null;
    this.isLoadingDocument = false;
    this.documentError = null;

    // Pre-check for document content on initialization
    if (this.resourceDocument && this.hasDocumentSupport) {
      console.log('ngOnInit: Checking for document content');

      // For debugging, log the resource document structure
      console.log('Resource document:', this.resourceDocument);
      console.log('Resource type:', this.resourceType);

      if (this.resourceType) {
        const singularName = this.getSingularName(this.resourceType);
        console.log('Checking for field:', singularName, this.resourceDocument[singularName] ? 'exists' : 'not found');
      }

      // Force document content check
      this.getDocumentContent();
    }
  }

  // Helper methods for displaying attributes
  objectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') {
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
  // Get attributes to display, filtering out system and document fields
  get displayAttributes(): string[] {
    const staticKeys = ['xid', 'self', 'epoch', 'isdefault', 'isDefault',
      'ancestor', 'versionscount', 'versionsCount', 'versionsurl',
      'metaurl', 'createdat', 'modifiedat', 'createdAt', 'modifiedAt', 'id', 'name', 'description'];

    const singular = this.getSingularName(this.resourceType);

    // Check if the type-specific field should be shown as a document
    const hasTypeDocument = this.hasDocumentSupport &&
      this.resourceDocument &&
      this.resourceDocument[singular] &&
      typeof this.resourceDocument[singular] === 'object';

    return Object.keys(this.resourceDocument || {}).filter(
      key => !staticKeys.includes(key) &&
             // Exclude document fields
             key !== singular &&
             key !== `${singular}url` &&
             key !== `${singular}base64` &&
             key !== 'resource' &&
             key !== 'resourceUrl' &&
             key !== 'resourceBase64' &&
             // If we're showing this field as a document, don't include it in attributes
             (!hasTypeDocument || key !== singular)
    );
  }

  // Document handling methods
  /**
   * Gets the singular name of a resource type
   */
  getSingularName(resourceType: string): string {
    return resourceType.endsWith('s') ? resourceType.slice(0, -1) : resourceType;
  }  /**
   * Checks if the version has a document (using any of the supported formats)
   */
  hasDocument(): boolean {
    if (!this.resourceDocument || !this.hasDocumentSupport) {
      console.log('hasDocument early return: resourceDocument, hasDocumentSupport:',
        !!this.resourceDocument, this.hasDocumentSupport);
      return false;
    }

    // Check for standard document formats
    if (
      this.resourceDocument.resource ||
      this.resourceDocument.resourceUrl ||
      this.resourceDocument.resourceBase64
    ) {
      console.log('hasDocument: found standard document format');
      return true;
    }

    // Check if there's a field matching the resource type name (e.g., 'agentcard' for agentcards)
    if (this.resourceType) {
      const singularName = this.getSingularName(this.resourceType);
      const hasTypedDoc = !!(this.resourceDocument[singularName] && typeof this.resourceDocument[singularName] === 'object');
      console.log('hasDocument: checked for typed document field:', singularName, hasTypedDoc,
        typeof this.resourceDocument[singularName]);
      return hasTypedDoc;
    }

    console.log('hasDocument: no document found');
    return false;
  }
  /**
   * Gets document content from any available source
   */
  getDocumentContent(): string | null {
    if (!this.resourceDocument || !this.hasDocumentSupport) {
      console.log('getDocumentContent early return: resourceDocument, hasDocumentSupport:',
        !!this.resourceDocument, this.hasDocumentSupport);
      return null;
    }

    // If URL is available, fetch the content
    if (this.resourceDocument.resourceUrl && !this.isLoadingDocument && !this.cachedDocumentContent) {
      console.log('getDocumentContent: fetching from URL', this.resourceDocument.resourceUrl);
      this.fetchDocumentFromUrl(this.resourceDocument.resourceUrl);
    }

    if (this.resourceDocument.resource && !this.cachedDocumentContent) {
      console.log('getDocumentContent: using resource object');
      this.cachedDocumentContent = JSON.stringify(this.resourceDocument.resource, null, 2);
    }

    if (this.resourceDocument.resourceBase64 && !this.cachedDocumentContent) {
      console.log('getDocumentContent: using base64 content');
      this.cachedDocumentContent = atob(this.resourceDocument.resourceBase64);
    }

    // Check if there's a field matching the resource type name (e.g., 'agentcard' for agentcards)
    if (!this.cachedDocumentContent && this.resourceType) {
      const singularName = this.getSingularName(this.resourceType);
      console.log('getDocumentContent: checking for type-specific field:', singularName,
        this.resourceDocument[singularName] ? typeof this.resourceDocument[singularName] : 'undefined');

      if (this.resourceDocument[singularName] && typeof this.resourceDocument[singularName] === 'object') {
        console.log('getDocumentContent: using type-specific field', singularName);
        this.cachedDocumentContent = JSON.stringify(this.resourceDocument[singularName], null, 2);
      }
    }

    // Return cached content if available
    if (this.cachedDocumentContent) {
      console.log('getDocumentContent: returning cached content');
      return this.cachedDocumentContent;
    }

    console.log('getDocumentContent: no content found');
    return null;
  }
  /**
   * Determines the content type for styling purposes
   */
  getDocumentContentType(content: string): string {
    // Basic content type detection
    if (!content) {
      return 'text';
    }

    try {
      // Check if it's already valid JSON
      if (typeof content === 'object') {
        return 'json';
      }

      // Try to parse as JSON
      JSON.parse(content);
      return 'json';
    } catch (e) {
      // Check for XML
      if (content.trim().startsWith('<')) {
        return 'xml';
      }
      // Check for YAML
      if (content.trim().startsWith('---') ||
          content.includes(':\n  ') ||
          content.match(/^[a-zA-Z0-9_-]+:\s*\S+$/m)) {
        return 'yaml';
      }
    }
    return 'text';
  }
  /**
   * Formats document content for display
   */
  formatDocumentContent(content: string): string {
    if (!content) {
      return '';
    }

    try {
      // Try to parse as JSON and pretty-print it
      let obj;
      if (typeof content === 'string') {
        obj = JSON.parse(content);
      } else if (typeof content === 'object') {
        obj = content;
      } else {
        return content;
      }

      return JSON.stringify(obj, null, 2);
    } catch (e) {
      // If not JSON, return as is
      return content;
    }
  }

  /**
   * Checks if base64 encoded document is available
   */
  hasBase64Document(): boolean {
    if (!this.resourceDocument || !this.hasDocumentSupport) {
      return false;
    }

    return !!(this.resourceDocument.resourceBase64 && this.resourceDocument.resourceBase64.length > 0);
  }

  /**
   * Downloads base64 encoded document
   */
  downloadBase64Document(): void {
    if (!this.resourceDocument || !this.hasDocumentSupport || !this.resourceDocument.resourceBase64) {
      return;
    }

    try {
      // Create a blob from the base64 data
      const binary = atob(this.resourceDocument.resourceBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes]);

      // Create a download link
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${this.resourceType}_${this.resourceDocument.id}_document`;
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

  // Methods for the new attribute display style
  isSimpleAttribute(value: any): boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }
  getPrimitiveAttributes(): { key: string, value: any, description?: string, type?: string }[] {
    if (!this.resourceDocument || typeof this.resourceDocument !== 'object') {
      return [];
    }

    return this.displayAttributes
      .filter(key => this.isSimpleAttribute(this.resourceDocument[key]))
      .map(key => ({
        key,
        value: this.resourceDocument[key],
        description: this.resourceAttributes[key]?.description || '',
        type: this.resourceAttributes[key]?.type || typeof this.resourceDocument[key]
      }));
  }
  getComplexAttributes(): ResourceDocumentItem[] {
    if (!this.resourceDocument || typeof this.resourceDocument !== 'object') {
      return [];
    }

    return this.displayAttributes
      .filter(key => !this.isSimpleAttribute(this.resourceDocument[key]) && this.hasValue(this.resourceDocument[key]))
      .map(key => ({
        key,
        value: this.resourceDocument[key],
        description: this.resourceAttributes[key]?.description || '',
        type: this.resourceAttributes[key]?.type,
        itemModel: this.resourceAttributes[key],
        isExpanded: false
      }));
  }
}
