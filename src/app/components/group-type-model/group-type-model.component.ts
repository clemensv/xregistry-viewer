import { Component, Input, OnInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GroupType } from '../../models/registry.model';
import { ResourceDocumentItemComponent } from '../resource-document-item/resource-document-item.component';
import { ResourceDocumentItem } from '../../models/resource-document-item.model';

@Component({
  standalone: true,
  selector: 'app-group-type-model',
  imports: [CommonModule, RouterModule, ResourceDocumentItemComponent],
  templateUrl: './group-type-model.component.html',
  styleUrls: ['./group-type-model.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class GroupTypeModelComponent implements OnInit {
  @Input() groupType!: string;
  @Input() model!: GroupType;
  @Input() origins: string[] = [];

  documentItems: ResourceDocumentItem[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.buildDocumentItems();
  }

  private buildDocumentItems(): void {
    this.documentItems = [];

    // Basic model information
    this.documentItems.push({
      key: 'Group Type',
      value: this.groupType,
      type: 'string',
      description: 'The identifier for this group type',
      itemModel: { type: 'string' },
      isExpanded: false
    });

    this.documentItems.push({
      key: 'Plural Name',
      value: this.model.plural,
      type: 'string',
      description: 'The plural form of the group type name',
      itemModel: { type: 'string' },
      isExpanded: false
    });

    this.documentItems.push({
      key: 'Singular Name',
      value: this.model.singular,
      type: 'string',
      description: 'The singular form of the group type name',
      itemModel: { type: 'string' },
      isExpanded: false
    });

    if (this.model.description) {
      this.documentItems.push({
        key: 'Description',
        value: this.model.description,
        type: 'string',
        description: 'Description of this group type',
        itemModel: { type: 'string' },
        isExpanded: false
      });
    }

    // Origins
    if (this.origins && this.origins.length > 0) {
      this.documentItems.push({
        key: 'Origins',
        value: this.origins,
        type: 'array',
        description: 'API endpoints that support this group type',
        itemModel: {
          type: 'array',
          item: { type: 'string' }
        },
        isExpanded: false
      });
    }

    // Resource Types
    if (this.model.resources && Object.keys(this.model.resources).length > 0) {
      const resourceTypes = Object.entries(this.model.resources).map(([key, resource]) => ({
        name: key,
        plural: resource.plural,
        singular: resource.singular,
        description: resource.description,
        hasdocument: resource.hasdocument,
        maxversions: resource.maxversions,
        attributes: resource.attributes
      }));

      this.documentItems.push({
        key: 'Resource Types',
        value: resourceTypes,
        type: 'array',
        description: 'Resource types supported by this group type',
        itemModel: {
          type: 'array',
          item: {
            type: 'object',
            attributes: {
              name: { type: 'string', description: 'Resource type identifier' },
              plural: { type: 'string', description: 'Plural form of the resource type' },
              singular: { type: 'string', description: 'Singular form of the resource type' },
              description: { type: 'string', description: 'Description of the resource type' },
              hasdocument: { type: 'boolean', description: 'Whether resources have separate documents' },
              maxversions: { type: 'number', description: 'Maximum number of versions (0 = unlimited)' },
              attributes: { type: 'object', description: 'Resource type attributes schema' }
            }
          }
        },
        isExpanded: true
      });
    }

    // Group Attributes
    if (this.model.attributes && Object.keys(this.model.attributes).length > 0) {
      this.documentItems.push({
        key: 'Group Attributes',
        value: this.model.attributes,
        type: 'object',
        description: 'Schema for group-level attributes',
        itemModel: {
          type: 'object',
          attributes: this.model.attributes
        },
        isExpanded: false
      });
    }

    this.cdr.markForCheck();
  }

  /**
   * Get the resource collection route for a resource type
   */
  getResourceCollectionRoute(resourceType: string): string[] {
    return ['/', this.groupType];
  }

  /**
   * Get simple items (string, number, boolean types)
   */
  getSimpleItems(): ResourceDocumentItem[] {
    return this.documentItems.filter(item =>
      item.type === 'string' ||
      item.type === 'number' ||
      item.type === 'boolean'
    );
  }

  /**
   * Get complex items (array, object types)
   */
  getComplexItems(): ResourceDocumentItem[] {
    return this.documentItems.filter(item =>
      item.type === 'array' ||
      item.type === 'object'
    );
  }
}
