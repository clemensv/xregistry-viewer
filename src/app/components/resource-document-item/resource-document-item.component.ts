import { Component, Input } from '@angular/core';
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
export class ResourceDocumentItemComponent {
  @Input() item!: ResourceDocumentItem;
  @Input() nestingLevel: number = 0;

  constructor() {}

  // Expose Object to template
  Object = Object;

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
   */
  toggleExpansion(): void {
    this.item.isExpanded = !this.item.isExpanded;
  }

  /**
   * Gets nested items from an array
   */  getArrayItems(): ResourceDocumentItem[] {
    if (!this.isArray(this.item.value) || !this.item.value.length) {
      return [];
    }

    return this.item.value.map((val: any, index: number) => {
      // Determine type and handle nested arrays/objects
      const type = typeof val === 'object' ?
                   (Array.isArray(val) ? 'array' : 'object') :
                   typeof val;

      return {
        key: `[${index}]`,
        value: val,
        type: type,
        // For array items, pass along the item schema if available
        itemModel: this.item.itemModel?.item ||
                   (this.item.itemModel?.type === 'array' ? this.item.itemModel : undefined),
        isExpanded: false
      };
    });
  }

  /**
   * Gets nested items from an object
   */  getObjectItems(): ResourceDocumentItem[] {
    if (!this.isObject(this.item.value)) {
      return [];
    }

    return Object.keys(this.item.value).map(key => {
      const value = this.item.value[key];
      const valueType = typeof value === 'object' ?
                      (Array.isArray(value) ? 'array' : 'object') :
                      typeof value;

      // Get the attribute definition for this key if available
      const attributeDef = this.item.itemModel?.attributes?.[key];

      return {
        key: key,
        value: value,
        type: valueType,
        description: attributeDef?.description,
        // Pass along schema info for nested items
        itemModel: attributeDef ||
                  (valueType === 'array' && this.item.itemModel?.attributes?.[key]?.item ?
                   { type: 'array', item: this.item.itemModel.attributes[key].item } :
                   (valueType === 'object' ? { type: 'object' } : undefined)),
        isExpanded: false
      };
    });
  }
}
