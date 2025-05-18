import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResourceDocument } from '../../models/registry.model';
import { CodeHighlightComponent } from '../code-highlight/code-highlight.component';
import { RegistryService } from '../../services/registry.service';

@Component({
  selector: 'app-resource-document',
  standalone: true,
  imports: [CommonModule, CodeHighlightComponent],
  templateUrl: './resource-document.component.html',
  styleUrl: './resource-document.component.scss'
})
export class ResourceDocumentComponent implements OnInit {
  @Input() resourceDocument!: ResourceDocument;
  @Input() resourceType!: string;
  @Input() resourceAttributes: { [key: string]: any } = {};
  @Input() hasDocumentSupport: boolean = false;
  @Input() showAttributes: boolean = true;
  @Input() showDocument: boolean = true;

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
      'metaurl', 'createdat', 'modifiedat', 'createdAt', 'modifiedAt', 'id', 'name'];

    const singular = this.getSingularName(this.resourceType);
    return Object.keys(this.resourceDocument || {}).filter(
      key => !staticKeys.includes(key) &&
             key !== singular &&
             key !== `${singular}url` &&
             key !== `${singular}base64` &&
             key !== 'resource' &&
             key !== 'resourceUrl' &&
             key !== 'resourceBase64'
    );
  }

  // Document handling methods
  /**
   * Gets the singular name of a resource type
   */
  getSingularName(resourceType: string): string {
    return resourceType.endsWith('s') ? resourceType.slice(0, -1) : resourceType;
  }

  /**
   * Checks if the version has a document (using any of the supported formats)
   */
  hasDocument(): boolean {
    if (!this.resourceDocument || !this.hasDocumentSupport) {
      return false;
    }

    return !!(
      this.resourceDocument.resource ||
      this.resourceDocument.resourceUrl ||
      this.resourceDocument.resourceBase64
    );
  }

  /**
   * Gets document content from any available source
   */
  getDocumentContent(): string | null {
    if (!this.resourceDocument || !this.hasDocumentSupport) {
      return null;
    }

    // If URL is available, fetch the content
    if (this.resourceDocument.resourceUrl && !this.isLoadingDocument && !this.cachedDocumentContent) {
      this.fetchDocumentFromUrl(this.resourceDocument.resourceUrl);
    }

    if (this.resourceDocument.resource && !this.cachedDocumentContent) {
      this.cachedDocumentContent = JSON.stringify(this.resourceDocument.resource);
    }

    if (this.resourceDocument.resourceBase64 && !this.cachedDocumentContent) {
      this.cachedDocumentContent = atob(this.resourceDocument.resourceBase64);
    }

    // Return cached content if available
    if (this.cachedDocumentContent) {
      return this.cachedDocumentContent;
    }

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
      JSON.parse(content);
      return 'json';
    } catch (e) {
      if (content.trim().startsWith('<')) {
        return 'xml';
      }
      if (content.trim().startsWith('---') || content.includes(':\n  ')) {
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
      // Try to pretty-print JSON
      const obj = JSON.parse(content);
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

  getPrimitiveAttributes(): { key: string, value: any, description?: string }[] {
    if (!this.resourceDocument || typeof this.resourceDocument !== 'object') {
      return [];
    }

    return this.displayAttributes
      .filter(key => this.isSimpleAttribute(this.resourceDocument[key]))
      .map(key => ({
        key,
        value: this.resourceDocument[key],
        description: this.resourceAttributes[key]?.description || ''
      }));
  }

  getComplexAttributes(): { key: string, value: any, description?: string, type?: string }[] {
    if (!this.resourceDocument || typeof this.resourceDocument !== 'object') {
      return [];
    }

    return this.displayAttributes
      .filter(key => !this.isSimpleAttribute(this.resourceDocument[key]) && this.hasValue(this.resourceDocument[key]))
      .map(key => ({
        key,
        value: this.resourceDocument[key],
        description: this.resourceAttributes[key]?.description || '',
        type: this.resourceAttributes[key]?.type
      }));
  }
}
