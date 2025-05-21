import { Component, Input, OnChanges, SimpleChanges, AfterViewInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeHighlightComponent } from '../code-highlight/code-highlight.component';
import { ResourceDocumentItem } from '../../models/resource-document-item.model';

@Component({
  selector: 'app-resource-document-item',
  standalone: true,
  imports: [CommonModule, CodeHighlightComponent],
  templateUrl: './resource-document-item.component.html',
  styleUrl: './resource-document-item.component.scss',
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

  constructor(private cdr: ChangeDetectorRef) {}  /**
   * Implement AfterViewInit lifecycle hook
   */  ngAfterViewInit(): void {
    // Ensure we have proper previews for all items after view is initialized
    if (this.item) {
      // Clear any existing cache
      this.clearCache();

      // ONLY set expanded state if it's undefined to avoid overriding user actions
      if (this.item.isExpanded === undefined) {
        this.item.isExpanded = this.initialExpanded;
        console.log('AfterViewInit: Setting undefined expanded state for', this.item.key, 'to', this.item.isExpanded);
      } else {
        console.log('AfterViewInit: Preserving expanded state for', this.item.key, 'as', this.item.isExpanded);
      }

      // Ensure the change detection cycle picks up this change
      this.cdr.detectChanges();
    }
  }
  /**
   * Detect changes to input properties
   */  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item']) {
      if (!changes['item'].firstChange) {
        // Only clear the cache when the item actually changes (not on first init)
        this.clearCache();
      }      // Only set expansion state on initialization or if undefined
      if (this.item) {
        // First check if we have a saved state in session storage
        const savedState = this.getSavedExpansionState(this.item.key);

        if (savedState !== undefined) {
          // Use the saved state from session storage
          console.log('Loading saved expansion state for', this.item.key, 'as', savedState);
          this.item.isExpanded = savedState;
        }
        // If no saved state, check previous value from change detection
        else if (changes['item'].previousValue) {
          let previousItem = changes['item'].previousValue as ResourceDocumentItem;
          if (previousItem && previousItem.key === this.item.key && previousItem.isExpanded !== undefined) {
            // Preserve expanded state from previous instance
            console.log('Preserving previous expansion state for', this.item.key, 'as', previousItem.isExpanded);
            this.item.isExpanded = previousItem.isExpanded;
          }
          else if (this.item.isExpanded === undefined) {
            // Initialize with default only if truly a new item or first load
            this.item.isExpanded = this.initialExpanded;
            console.log('Setting initial expanded state for', this.item.key, 'to', this.item.isExpanded);
          }
        }
        else if (this.item.isExpanded === undefined) {
          // No previous value and no saved state
          this.item.isExpanded = this.initialExpanded;
          console.log('Initializing default state for', this.item.key, 'to', this.item.isExpanded);
        }
      }

      // Mark component for change detection after updating properties
      this.cdr.markForCheck();
    }
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
   */  /**
   * Enhanced toggle method with state persistence
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
    console.log(`PRE-TOGGLE: ${itemKey} is currently ${currentlyExpanded ? 'expanded' : 'collapsed'}`);

    try {
      // Toggle the state - make sure to use an explicit boolean to avoid any type issues
      this.item.isExpanded = currentlyExpanded === true ? false : true;

      // Immediately output the new state to verify the toggle worked
      console.log(`TOGGLE-ACTION: ${itemKey} toggled to ${this.item.isExpanded ? 'expanded' : 'collapsed'}`);

      // Store the expanded state in session storage to persist across reloads and re-renders
      sessionStorage.setItem(`expanded:${itemKey}`, String(this.item.isExpanded));

      // Force full change detection cycle
      this.cdr.markForCheck();
      this.cdr.detectChanges();

      // Log after toggle and change detection
      console.log(`POST-TOGGLE: ${itemKey} is now ${this.item.isExpanded ? 'expanded' : 'collapsed'}`);

      // Apply visual updates after the toggle
      setTimeout(() => {
        // Verify state after timeout
        console.log(`TIMEOUT-VERIFY: ${itemKey} remains ${this.item.isExpanded ? 'expanded' : 'collapsed'}`);

        // One final change detection cycle
        this.cdr.detectChanges();
      }, 0);
    } catch (err) {
      console.error("Error during toggle:", err);
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
      let itemName = `Item ${index + 1}`;

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
        if (itemName === `Item ${index + 1}` && val.type) {
          itemName = `Item ${index + 1} (${val.type})`;
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
   * Enhanced method to get object items with better metadata handling
   */
  getObjectItems(): ResourceDocumentItem[] {
    if (!this.isObject(this.item.value)) {
      return [];
    }

    return Object.keys(this.item.value).map(key => {
      const value = this.item.value[key];
      // Determine correct type with special handling for arrays
      const valueType = Array.isArray(value) ? 'array' :
                       (value !== null && typeof value === 'object') ? 'object' :
                       typeof value;

      // Get the attribute definition for this key if available
      const attributeDef = this.item.itemModel?.attributes?.[key];

      // Create a proper ResourceDocumentItem for each property with correct model structure
      const childItem: ResourceDocumentItem = {
        key: key,
        value: value,
        type: valueType,
        description: attributeDef?.description,
        // Pass along schema info for nested items
        itemModel: attributeDef ||
                 (valueType === 'array' && this.item.itemModel?.attributes?.[key]?.item ?
                  { type: 'array', item: this.item.itemModel.attributes[key].item } :
                  (valueType === 'object' ? { type: 'object' } : undefined)),
        // Explicitly set isExpanded to false for child items - they start collapsed
        isExpanded: false
      };

      return childItem;
    });
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
   */  isExpanded(): boolean {
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
    let text: string;
    if (typeof value === 'object') {
      try {
        text = JSON.stringify(value, null, 2);
      } catch {
        text = String(value);
      }
    } else {
      text = String(value);
    }
    navigator.clipboard.writeText(text).then(() => {
      // Optionally, show a toast/snackbar or visual feedback here
      // e.g., this.showCopySuccess = true; setTimeout(() => this.showCopySuccess = false, 1500);
      console.log('Copied to clipboard:', text);
    });
  }
}
