import { Component, Input, OnChanges, SimpleChanges, AfterViewInit, ChangeDetectorRef, ChangeDetectionStrategy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CodeHighlightComponent } from '../code-highlight/code-highlight.component';
import { ResourceDocumentItem } from '../../models/resource-document-item.model';
import { DebugService } from '../../services/debug.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-resource-document-item',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CodeHighlightComponent, IconComponent],
  templateUrl: './resource-document-item.component.html',
  styleUrl: './resource-document-item.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceDocumentItemComponent implements OnChanges, AfterViewInit {
  @Input() item!: ResourceDocumentItem;
  @Input() nestingLevel: number = 0;
  @Input() initialExpanded: boolean = false;

  // Enable debug mode to show internal state in UI
  debugMode: boolean = false;

  // Cache for collapsed preview text
  private collapsedPreviewCache: { [key: string]: string } = {};
  // Expose Object and JSON to template
  Object = Object;
  JSON = JSON;

  constructor(private cdr: ChangeDetectorRef, private debug: DebugService) {}

  ngAfterViewInit(): void {
    // Set initial expanded state if not already set
    if (this.item.isExpanded === undefined) {
      this.debug.log('AfterViewInit: Setting undefined expanded state for', this.item.key, 'to', this.item.isExpanded);
    } else {
      this.debug.log('AfterViewInit: Preserving expanded state for', this.item.key, 'as', this.item.isExpanded);
    }
  }

  /**
   * Detect changes to input properties
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item']) {
      if (!changes['item'].firstChange) {
        // Only clear the cache when the item actually changes (not on first init)
        this.clearCache();
      }
      // Initialize expansion state based on various factors
      this.initializeExpansionState();

      // Mark component for change detection after updating properties
      this.cdr.markForCheck();
    }
  }

  private initializeExpansionState(): void {
    // Check if there's a saved state for this item
    const savedState = this.loadExpansionState();
    if (savedState !== null) {
      this.item.isExpanded = savedState;
      this.debug.log('Loading saved expansion state for', this.item.key, 'as', savedState);
      return;
    }

    // Check if there's a previous state from the item itself
    if (this.item.hasOwnProperty('isExpanded') && this.item.isExpanded !== undefined) {
      const previousItem = this.item as any;
      this.debug.log('Preserving previous expansion state for', this.item.key, 'as', previousItem.isExpanded);
      return;
    }

    // Use initialExpanded prop if provided
    if (this.initialExpanded !== undefined) {
      this.item.isExpanded = this.initialExpanded;
      this.debug.log('Setting initial expanded state for', this.item.key, 'to', this.item.isExpanded);
      return;
    }

    // Default behavior: expand simple items, collapse complex items
    this.item.isExpanded = this.isSimpleValue(this.item.value);
    this.debug.log('Initializing default state for', this.item.key, 'to', this.item.isExpanded);
  }

  /**
   * Clear the preview cache
   */
  clearCache(): void {
    this.collapsedPreviewCache = {};
  }

  /**
   * Checks if the item is of type 'any' based on the itemModel
   */
  isAnyType(): boolean {
    const itemType = this.item.itemModel?.type || this.item.type;
    // Only return true for explicit 'any' type, not for objects or arrays
    return itemType === 'any';
  }

  /**
   * Gets a safe JSON string for the value
   */
  getSafeJsonString(value: any): string {
    if (value === undefined || value === null) {
      return 'null';
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  /**
   * Formats item type for display with better formatting
   */
  getDisplayType(): string {
    // If we have a model type, use it but make first letter uppercase for display
    if (this.item.itemModel?.type) {
      // Format the type name nicely
      const type = this.item.itemModel.type;
      return type.charAt(0).toUpperCase() + type.slice(1);
    }

    // Otherwise infer from the value
    return this.isArray(this.item.value) ? 'Array' :
           this.isObject(this.item.value) ? 'Object' :
           typeof this.item.value;
  }

  /**
   * Check if the current item type is numeric
   */
  isNumericType(): boolean {
    const itemType = this.item.itemModel?.type || typeof this.item.value;
    return itemType === 'number' || itemType === 'integer' || typeof this.item.value === 'number';
  }

  /**
   * Determine if the field should use full width layout
   */
  shouldUseFullWidth(): boolean {
    // Use full width for strings longer than a certain threshold, arrays, objects, or URLs
    if (this.isUrl(this.item.value) || this.isXid(this.item) || this.isAnyType()) {
      return true;
    }

    if (typeof this.item.value === 'string' && this.item.value.length > 30) {
      return true;
    }

    return false;
  }

  /**
   * Generate a unique field ID for accessibility
   */
  getFieldId(): string {
    return `field-${this.item.key}-${this.nestingLevel}`;
  }

  /**
   * Get the display value for non-special cases
   */
  getDisplayValue(): string {
    if (this.item.value === null) {
      return 'null';
    }
    if (this.item.value === undefined) {
      return 'undefined';
    }
    return String(this.item.value);
  }

  /**
   * Determines if the value is a simple primitive type
   */
  isSimpleValue(value: any): boolean {
    return typeof value === 'string' ||
           typeof value === 'number' ||
           typeof value === 'boolean' ||
           value === null ||
           value === undefined;
  }

  /**
   * Checks if the value is an array
   */
  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  /**
   * Checks if the value is an object
   */
  isObject(value: any): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Toggles expansion state of the item
   * @param event Optional MouseEvent to prevent further propagation
   */
  toggleExpansion(event?: MouseEvent): void {
    // Always stop event propagation
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    // Store key for debug logging
    const itemKey = this.item.key;

    // Get current state and log it
    const currentlyExpanded = this.isExpanded();
    this.debug.log(`PRE-TOGGLE: ${itemKey} is currently ${currentlyExpanded ? 'expanded' : 'collapsed'}`);

    try {
      // Toggle the state - make sure to use an explicit boolean to avoid any type issues
      this.item.isExpanded = currentlyExpanded === true ? false : true;

      // Immediately output the new state to verify the toggle worked
      this.debug.log(`TOGGLE-ACTION: ${itemKey} toggled to ${this.item.isExpanded ? 'expanded' : 'collapsed'}`);

      // Store the expanded state in session storage to persist across reloads and re-renders
      sessionStorage.setItem(`expanded:${itemKey}`, String(this.item.isExpanded));

      // Force full change detection cycle
      this.cdr.markForCheck();
      this.cdr.detectChanges();

      // Log after toggle and change detection
      this.debug.log(`POST-TOGGLE: ${itemKey} is now ${this.item.isExpanded ? 'expanded' : 'collapsed'}`);

      // Apply visual updates after the toggle
      setTimeout(() => {
        // Verify state after timeout
        this.debug.log(`TIMEOUT-VERIFY: ${itemKey} remains ${this.item.isExpanded ? 'expanded' : 'collapsed'}`);

        // One final change detection cycle
        this.cdr.detectChanges();
      }, 0);
    } catch (err) {
      this.debug.error("Error during toggle:", err);
    }
  }

  /**
   * Enhanced method to get array items with more user-friendly names
   */
  getArrayItems(): ResourceDocumentItem[] {
    if (!this.isArray(this.item.value) || !this.item.value.length) {
      return [];
    }

    return this.item.value.map((val: any, index: number) => {
      // Determine type and handle nested arrays/objects
      const type = Array.isArray(val) ? 'array' :
                  (val !== null && typeof val === 'object') ? 'object' :
                  typeof val;

      // Try to find a meaningful name for the item
      let itemName = `[${index + 1}]`;

      // Look for common identifier properties in object items
      if (val && typeof val === 'object' && val !== null) {
        // Check for common identifier properties in the following order of preference
        const identifierProps = ['name', 'id', 'title', 'key', 'label', 'identifier'];

        for (const prop of identifierProps) {
          if (val[prop] !== undefined && (typeof val[prop] === 'string' || typeof val[prop] === 'number')) {
            itemName = String(val[prop]);
            break;
          }
        }

        // If no identifier was found but there's a type property, include it
        if (itemName === `[${index + 1}]` && val.type) {
          itemName = `[${index + 1}] (${val.type})`;
        }
      }

      // Create a proper ResourceDocumentItem for each array element with correct model structure
      const childItem: ResourceDocumentItem = {
        key: itemName,
        value: val,
        type: type,
        // For array items, pass along the item schema if available
        itemModel: this.item.itemModel?.item ||
                  (this.item.itemModel?.type === 'array' ? this.item.itemModel : undefined),
        // Explicitly set isExpanded to false for child items - they start collapsed
        isExpanded: false
      };

      return childItem;
    });
  }

  /**
   * Get object items as ResourceDocumentItem array
   */
  getObjectItems(): ResourceDocumentItem[] {
    if (!this.isObject(this.item.value)) {
      return [];
    }

    return Object.entries(this.item.value).map(([key, value]) => {
      // Get the attribute model for this key if available
      const attributeModel = this.item.itemModel?.attributes?.[key];

      return {
        key,
        value,
        type: attributeModel?.type || (this.isArray(value) ? 'array' : this.isObject(value) ? 'object' : typeof value),
        description: attributeModel?.description || '',
        itemModel: attributeModel,
        isExpanded: false
      };
    });
  }

  /**
   * Get simple array items (primitive values)
   */
  getSimpleArrayItems(): ResourceDocumentItem[] {
    return this.getArrayItems().filter(item => this.isSimpleValue(item.value));
  }

  /**
   * Get complex array items (objects and arrays)
   */
  getComplexArrayItems(): ResourceDocumentItem[] {
    return this.getArrayItems().filter(item => !this.isSimpleValue(item.value));
  }

  /**
   * Get simple object items (primitive values)
   */
  getSimpleObjectItems(): ResourceDocumentItem[] {
    return this.getObjectItems().filter(item => this.isSimpleValue(item.value));
  }

  /**
   * Get complex object items (objects and arrays)
   */
  getComplexObjectItems(): ResourceDocumentItem[] {
    return this.getObjectItems().filter(item => !this.isSimpleValue(item.value));
  }

  /**
   * Checks if array items have model information
   */
  hasArrayItemModelInfo(): boolean {
    return !!this.item.itemModel?.item;
  }

  /**
   * Gets array item model type if available
   */
  getArrayItemType(): string | null {
    return this.item.itemModel?.item?.type || null;
  }

  /**
   * Gets array item model description if available
   */
  getArrayItemDescription(): string | null {
    return this.item.itemModel?.item?.description || null;
  }

  /**
   * Escape HTML characters to prevent injection when using innerHTML
   */
  private escapeHtml(str: string): string {
    if (typeof str !== 'string') {
      return String(str);
    }
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Helper method to determine if content should be shown expanded
   */
  isExpanded(): boolean {
    // First check if there's a persisted state in session storage
    if (this.item && this.item.key) {
      const savedState = this.getSavedExpansionState(this.item.key);
      if (savedState !== undefined) {
        // Update the item state to match the saved state if they differ
        if (this.item.isExpanded !== savedState) {
          this.item.isExpanded = savedState;
        }
        return savedState;
      }
    }

    // Otherwise check the item's state directly
    if (!this.item) return false;
    return this.item.isExpanded === true;
  }

  /**
   * Helper method to determine if content should be shown collapsed
   */
  isCollapsed(): boolean {
    // Simply the inverse of isExpanded
    return !this.isExpanded();
  }

  /**
   * Helper method to check if item is expandable (array or object)
   */
  isExpandable(): boolean {
    return this.item && (this.isArray(this.item.value) || this.isObject(this.item.value));
  }

  /**
   * Returns a summarized preview text for array items
   * @param array The array to summarize
   */
  getSummarizedArrayPreview(array: any[]): string {
    if (!array || array.length === 0) return '';

    const previewItems: string[] = [];
    const maxItems = Math.min(array.length, 3); // Show up to 3 items in preview

    for (let i = 0; i < maxItems; i++) {
      const item = array[i];
      if (item === null) {
        previewItems.push('null');
      } else if (item === undefined) {
        previewItems.push('undefined');
      } else if (typeof item === 'string') {
        // Truncate long strings and add quotes
        previewItems.push(`"${item.length > 15 ? item.substring(0, 12) + '...' : item}"`);
      } else if (typeof item === 'object') {
        // For objects and arrays, just show the type
        previewItems.push(Array.isArray(item) ? '[ ... ]' : '{ ... }');
      } else {
        // For numbers, booleans, etc.
        previewItems.push(String(item));
      }
    }

    // If there are more items than we're showing
    if (array.length > maxItems) {
      previewItems.push('...');
    }

    return previewItems.join(', ');
  }

  /**
   * Returns a summarized preview text for object properties
   * @param obj The object to summarize
   */
  getSummarizedObjectPreview(obj: any): string {
    if (!obj || Object.keys(obj).length === 0) return '';

    const keys = Object.keys(obj);
    const previewItems: string[] = [];
    const maxItems = Math.min(keys.length, 3); // Show up to 3 properties in preview

    for (let i = 0; i < maxItems; i++) {
      const key = keys[i];
      const value = obj[key];

      let valueStr: string;
      if (value === null) {
        valueStr = 'null';
      } else if (value === undefined) {
        valueStr = 'undefined';
      } else if (typeof value === 'string') {
        // Truncate long strings and add quotes
        valueStr = `"${value.length > 10 ? value.substring(0, 7) + '...' : value}"`;
      } else if (typeof value === 'object') {
        // For objects and arrays, just show the type
        valueStr = Array.isArray(value) ? '[ ... ]' : '{ ... }';
      } else {
        // For numbers, booleans, etc.
        valueStr = String(value);
      }

      previewItems.push(`${key}: ${valueStr}`);
    }

    // If there are more properties than we're showing
    if (keys.length > maxItems) {
      previewItems.push('...');
    }

    return previewItems.join(', ');
  }

  /**
   * Gets a simplified text preview of a collapsed value for display
   * @param value The value to create a preview for
   */
  getCollapsedPreviewText(value: any): string {
    if (value === undefined) {
      return 'undefined';
    }
    if (value === null) {
      return 'null';
    }

    try {
      // For any type values, use JSON representation but truncate
      const json = JSON.stringify(value, null, 2);
      if (json.length > 100) {
        return json.substring(0, 100) + '...';
      }
      return json;
    } catch (e) {
      return String(value);
    }
  }

  /**
   * Get saved expansion state from session storage
   * This helps preserve expansion state across renders
   */
  private getSavedExpansionState(key: string): boolean | undefined {
    if (!key) return undefined;

    const savedState = sessionStorage.getItem(`expanded:${key}`);
    if (savedState !== null) {
      return savedState === 'true';
    }
    return undefined;
  }

  copyToClipboard(value: any): void {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    navigator.clipboard.writeText(text).then(() => {
      this.debug.log('Copied to clipboard:', text);
    }).catch(err => {
      this.debug.error('Failed to copy to clipboard:', err);
    });
  }

  /**
   * Check if an attribute name indicates it should be treated as a URI/URL
   */
  isUriOrUrlAttribute(): boolean {
    if (typeof this.item.value !== 'string') {
      return false;
    }

    const key = this.item.key?.toLowerCase() || '';
    return key.endsWith('uri') || key.endsWith('url');
  }

  /**
   * Check if a value looks like a URL or if the attribute name suggests it's a URI/URL
   */
  isUrl(value: any): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    // Check if this is a URI/URL attribute
    if (this.isUriOrUrlAttribute()) {
      // For URI/URL attributes, check if it's an absolute URL
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        // If it's not a valid absolute URL, it might be a relative URL that should be treated as XID
        return false;
      }
    }

    // Original URL detection logic for non-URI/URL attributes
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Check if an item is an XID (based on type or URI/URL attribute with relative path)
   */
  isXid(item: ResourceDocumentItem): boolean {
    if (typeof item.value !== 'string') {
      return false;
    }

    // Check if it's explicitly typed as XID
    const itemType = item.itemModel?.type || item.type;
    if (itemType === 'xid') {
      return true;
    }

    // Check if this is a URI/URL attribute with a relative path
    if (this.isUriOrUrlAttribute()) {
      // If it's not an absolute URL, treat it as an XID for navigation
      try {
        new URL(item.value);
        // If URL construction succeeds, it's an absolute URL, not an XID
        return false;
      } catch {
        // If URL construction fails, it's likely a relative path/XID
        return true;
      }
    }

    return false;
  }

  /**
   * Get the route for an XID value
   */
  getXidRoute(xidValue: string): string[] {
    // Parse XID format: typically "groupType/groupId/resourceType/resourceId"
    // Return the full path for deep linking
    const parts = xidValue.split('/');
    if (parts.length >= 4) {
      // Full path: /groupType/groupId/resourceType/resourceId
      return ['/' + parts[0], parts[1], parts[2], parts[3]];
    } else if (parts.length === 3) {
      // Partial path: /groupType/groupId/resourceType
      return ['/' + parts[0], parts[1], parts[2]];
    } else if (parts.length >= 2) {
      // Navigate to the group type with the group ID
      return ['/' + parts[0], parts[1]];
    } else {
      // Fallback to just the group type
      return ['/' + parts[0]];
    }
  }

  private loadExpansionState(): boolean | null {
    // Implementation of loadExpansionState method
    return null; // Placeholder return, actual implementation needed
  }

  private saveExpansionState(): void {
    // Implementation of saveExpansionState method
  }
}
