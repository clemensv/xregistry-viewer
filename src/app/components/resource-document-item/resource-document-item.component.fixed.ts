import { Component, Input, OnChanges, SimpleChanges, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeHighlightComponent } from '../code-highlight/code-highlight.component';
import { ResourceDocumentItem } from '../../models/resource-document-item.model';

@Component({
  selector: 'app-resource-document-item',
  standalone: true,
  imports: [CommonModule, CodeHighlightComponent],
  templateUrl: './resource-document-item.component.html',
  styleUrl: './resource-document-item.component.scss'
})
export class ResourceDocumentItemComponent implements OnChanges, AfterViewInit {
  @Input() item!: ResourceDocumentItem;
  @Input() nestingLevel: number = 0;

  // Cache for collapsed preview text
  private collapsedPreviewCache: { [key: string]: string } = {};
  // Expose Object and JSON to template
  Object = Object;
  JSON = JSON;

  constructor(private cdr: ChangeDetectorRef) {}
  /**
   * Implement AfterViewInit lifecycle hook
   */
  ngAfterViewInit(): void {
    // Ensure we have proper previews for all items after view is initialized
    if (this.item) {
      // Clear any existing cache
      this.clearCache();

      // Ensure expansion state is explicitly defined
      if (this.item.isExpanded === undefined) {
        this.item.isExpanded = false;
      }
    }
  }
  /**
   * Detect changes to input properties
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] && !changes['item'].firstChange) {
      // Only clear the cache when the item actually changes (not on first init)
      this.clearCache();

      // Ensure isExpanded is explicitly set without triggering detection
      if (this.item && this.item.isExpanded === undefined) {
        this.item.isExpanded = false;
      }
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
   * Gets item attributes from the model if available
   */
  getItemAttributes(): { [key: string]: any } | null {
    if (!this.item.itemModel) {
      return null;
    }
    return this.item.itemModel.attributes || null;
  }

  /**
   * Formats item type for display
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
   */
  toggleExpansion(event?: MouseEvent): void {
    // Stop event propagation if provided to prevent bubbling
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    // First ensure the property is defined
    if (this.item.isExpanded === undefined) {
      this.item.isExpanded = false;
    }

    // Toggle the expansion state
    const newState = !this.item.isExpanded;
    this.item.isExpanded = newState;

    // Use markForCheck() to notify Angular that this component needs checking
    // but don't immediately force a change detection cycle
    this.cdr.markForCheck();
  }

  /**
   * Gets nested items from an array
   * Enhanced to properly handle nested arrays/objects
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

      // Create a proper ResourceDocumentItem for each array element with correct model structure
      const childItem: ResourceDocumentItem = {
        key: `Item ${index + 1}`,  // Renamed from [index] to "Item 1, Item 2" etc.
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
   * Gets nested items from an object
   * Enhanced to properly handle nested objects/arrays
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
   * Creates a preview string for arrays and objects in collapsed state
   * This provides a meaningful preview instead of just [...] or {...}
   */
  getCollapsedPreviewText(value: any, maxItems: number = 3): string {
    // For simplicity, we'll remove the brackets and braces from the preview text
    try {
      // Handle null and undefined
      if (value === null) {
        return '<span class="null">null</span>';
      }

      if (value === undefined) {
        return '<span class="special">undefined</span>';
      }

      // ARRAYS - Enhanced rendering without brackets
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return '<span class="empty">No items</span>';
        }

        let arrayPreview = '<br>';
        const itemsToShow = Math.min(value.length, maxItems);

        for (let i = 0; i < itemsToShow; i++) {
          const item = value[i];
          arrayPreview += '&nbsp;&nbsp;';

          if (item === null) {
            arrayPreview += '<span class="null">null</span>';
          } else if (item === undefined) {
            arrayPreview += '<span class="special">undefined</span>';
          } else if (typeof item === 'object') {
            if (Array.isArray(item)) {
              arrayPreview += `<span class="special">${item.length} items</span>`;
              // Include sample of first few items if array is not empty
              if (item.length > 0) {
                const sampleCount = Math.min(2, item.length);
                const samples = item.slice(0, sampleCount).map((s: any) =>
                  typeof s === 'object' ? (s === null ? '<span class="null">null</span>' : '{}') :
                  typeof s === 'string' ? `<span class="string">"${this.escapeHtml(s.substring(0, 10))}${s.length > 10 ? '...' : ''}"</span>` :
                  typeof s === 'number' ? `<span class="number">${s}</span>` :
                  typeof s === 'boolean' ? `<span class="boolean">${s}</span>` :
                  this.escapeHtml(String(s))
                );
                arrayPreview += ` <span class="special">(e.g. ${samples.join(', ')})</span>`;
              }
            } else if (item === null) {
              arrayPreview += '<span class="null">null</span>';
            } else {
              const keys = Object.keys(item);
              arrayPreview += `<span class="special">${keys.length} properties</span>`;
              // Add sample keys
              if (keys.length > 0) {
                arrayPreview += ` <span class="special">(keys: ${keys.slice(0, 2).map(k =>
                  `<span class="key">${this.escapeHtml(k)}</span>`).join(', ')}${keys.length > 2 ? '...' : ''})</span>`;
              }
            }
          } else if (typeof item === 'string') {
            if (item.length > 30) {
              arrayPreview += `<span class="string">"${this.escapeHtml(item.substring(0, 30))}..."</span>`;
            } else {
              arrayPreview += `<span class="string">"${this.escapeHtml(item)}"</span>`;
            }
          } else if (typeof item === 'number') {
            arrayPreview += `<span class="number">${item}</span>`;
          } else if (typeof item === 'boolean') {
            arrayPreview += `<span class="boolean">${item}</span>`;
          } else {
            arrayPreview += this.escapeHtml(String(item));
          }

          if (i < itemsToShow - 1) {
            arrayPreview += ',<br>';
          } else {
            arrayPreview += '<br>';
          }
        }

        if (value.length > maxItems) {
          arrayPreview += `&nbsp;&nbsp;<span class="special">${value.length - maxItems} more items...</span><br>`;
        }

        return arrayPreview;
      }

      // OBJECTS - Enhanced rendering without braces
      if (typeof value === 'object' && value !== null) {
        const keys = Object.keys(value);
        if (keys.length === 0) {
          return '<span class="empty">No properties</span>';
        }

        let objectPreview = '<br>';
        const keysToShow = keys.slice(0, maxItems);

        for (let i = 0; i < keysToShow.length; i++) {
          const key = keysToShow[i];
          const propValue = value[key];

          objectPreview += `&nbsp;&nbsp;<span class="key">${this.escapeHtml(key)}</span>: `;

          if (propValue === null) {
            objectPreview += '<span class="null">null</span>';
          } else if (propValue === undefined) {
            objectPreview += '<span class="special">undefined</span>';
          } else if (typeof propValue === 'object') {
            if (Array.isArray(propValue)) {
              objectPreview += `<span class="special">${propValue.length} items</span>`;
              // Include first item as sample if array is not empty
              if (propValue.length > 0) {
                const firstItem = propValue[0];
                let sample = '';

                if (firstItem === null) {
                  sample = '<span class="null">null</span>';
                } else if (typeof firstItem === 'object') {
                  sample = Array.isArray(firstItem) ? '[]' : '{}';
                } else if (typeof firstItem === 'string') {
                  sample = `<span class="string">"${this.escapeHtml(firstItem.substring(0, 15))}${firstItem.length > 15 ? '...' : ''}"</span>`;
                } else if (typeof firstItem === 'number') {
                  sample = `<span class="number">${firstItem}</span>`;
                } else if (typeof firstItem === 'boolean') {
                  sample = `<span class="boolean">${firstItem}</span>`;
                } else {
                  sample = this.escapeHtml(String(firstItem));
                }

                objectPreview += ` <span class="special">(e.g. ${sample}${propValue.length > 1 ? ', ...' : ''})</span>`;
              }
            } else if (propValue === null) {
              objectPreview += '<span class="null">null</span>';
            } else {
              const propKeys = Object.keys(propValue);
              objectPreview += `<span class="special">${propKeys.length} properties</span>`;
              // Add sample keys
              if (propKeys.length > 0) {
                objectPreview += ` <span class="special">(keys: ${propKeys.slice(0, 2).map(k =>
                  `<span class="key">${this.escapeHtml(k)}</span>`).join(', ')}${propKeys.length > 2 ? '...' : ''})</span>`;
              }
            }
          } else if (typeof propValue === 'string') {
            if (propValue.length > 30) {
              objectPreview += `<span class="string">"${this.escapeHtml(propValue.substring(0, 30))}..."</span>`;
            } else {
              objectPreview += `<span class="string">"${this.escapeHtml(propValue)}"</span>`;
            }
          } else if (typeof propValue === 'number') {
            objectPreview += `<span class="number">${propValue}</span>`;
          } else if (typeof propValue === 'boolean') {
            objectPreview += `<span class="boolean">${propValue}</span>`;
          } else {
            objectPreview += this.escapeHtml(String(propValue));
          }

          if (i < keysToShow.length - 1) {
            objectPreview += ',<br>';
          } else {
            objectPreview += '<br>';
          }
        }

        if (keys.length > maxItems) {
          objectPreview += `&nbsp;&nbsp;<span class="special">${keys.length - maxItems} more properties...</span><br>`;
        }

        return objectPreview;
      }

      // Any other type with proper type-based highlighting
      if (typeof value === 'string') {
        return `<span class="string">"${this.escapeHtml(value)}"</span>`;
      } else if (typeof value === 'number') {
        return `<span class="number">${value}</span>`;
      } else if (typeof value === 'boolean') {
        return `<span class="boolean">${value}</span>`;
      }

      return this.escapeHtml(String(value));
    } catch (err) {
      console.error('PREVIEW ERROR:', err);

      // Fallback for error cases - make it clear there's content that couldn't be displayed properly
      if (Array.isArray(value)) {
        return `<span class="special">Array with ${value.length} items - Display Error</span>`;
      } else if (typeof value === 'object' && value !== null) {
        return `<span class="special">Object with ${Object.keys(value).length} properties - Display Error</span>`;
      }

      return `<span class="special">Value (${typeof value}) - Display Error</span>`;
    }
  }

  /**
   * Gets a limited number of array items for preview display
   */
  getPreviewArrayItems(): ResourceDocumentItem[] {
    if (!this.isArray(this.item.value) || !this.item.value.length) {
      return [];
    }

    const maxItems = this.getMaxPreviewItems();
    return this.getArrayItems().slice(0, maxItems);
  }

  /**
   * Gets the maximum number of items to show in preview mode
   */
  getMaxPreviewItems(): number {
    return 3; // Show max 3 items in preview mode
  }

  /**
   * Gets a limited number of object properties for preview display
   */
  getPreviewObjectItems(): ResourceDocumentItem[] {
    if (!this.isObject(this.item.value)) {
      return [];
    }

    const maxItems = this.getMaxPreviewItems();
    return this.getObjectItems().slice(0, maxItems);
  }

  /**
   * Checks if there are more items in the array/object than shown in preview
   */
  hasMoreItemsThanPreview(): boolean {
    if (this.isArray(this.item.value)) {
      return this.item.value.length > this.getMaxPreviewItems();
    }
    if (this.isObject(this.item.value)) {
      return Object.keys(this.item.value).length > this.getMaxPreviewItems();
    }
    return false;
  }

  /**
   * Gets the total count of items in the array or object
   */
  getTotalItemsCount(): number {
    if (this.isArray(this.item.value)) {
      return this.item.value.length;
    }
    if (this.isObject(this.item.value)) {
      return Object.keys(this.item.value).length;
    }
    return 0;
  }
}
