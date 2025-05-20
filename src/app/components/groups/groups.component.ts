import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { RegistryService } from '../../services/registry.service';
import { ModelService } from '../../services/model.service';
import { Group } from '../../models/registry.model';
import { FormsModule } from '@angular/forms';
import { ResourceDocumentItem } from '../../models/resource-document-item.model';
import { ResourceDocumentItemComponent } from '../resource-document-item/resource-document-item.component';

@Component({
  standalone: true,
  selector: 'app-groups',
  imports: [CommonModule, RouterModule, FormsModule, ResourceDocumentItemComponent], // Added ResourceDocumentItemComponent
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class GroupsComponent implements OnInit {
  groupType!: string;
  groups$!: Observable<Group[]>;
  resourceTypes$!: Observable<string[]>;
  groupAttributes: { [key: string]: any } = {};
  private suppressGroupAttributes = ['groupid', 'self', 'xid', 'epoch', 'createdat', 'modifiedat'];
  registryModel: any = null;

  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    private modelService: ModelService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.groupType = this.route.snapshot.paramMap.get('groupType') || '';

    // Load group metadata attributes
    this.modelService.getRegistryModel().pipe(
      map(m => m.groups[this.groupType])
    ).subscribe(gtModel => {
      this.groupAttributes = gtModel.attributes || {};
    });

    // Save the full registry model for resource type info
    this.modelService.getRegistryModel().subscribe(model => {
      this.registryModel = model;
    });

    this.groups$ = this.registry.listGroups(this.groupType);

    this.resourceTypes$ = this.route.paramMap.pipe(
      map(params => params.get('groupType')!),
      distinctUntilChanged(),
      switchMap(gt => this.modelService.getRegistryModel().pipe(
        map(model => {
          if (!model.groups[gt] || !model.groups[gt].resources) {
            console.warn(`No resources found for groupType: ${gt}`);
            return [];
          }
          const resourceTypes = Object.keys(model.groups[gt].resources);
          console.log('Extracted resourceTypes:', resourceTypes);
          return resourceTypes;
        })
      ))
    );
  }

  get displayGroupAttributes(): string[] {
    return Object.keys(this.groupAttributes || {}).filter(
      key => !this.suppressGroupAttributes.includes(key) && !key.endsWith('url')
    );
  }

  /** reuse hasValue from ResourcesComponent or reimplement*/
  hasValue(value: any): boolean {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return value !== '';
  }

  /**
   * Helper method to get object keys for template iteration
   */
  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  /**
   * Build a ResourceDocumentItem for the resource types array for a group
   */
  getResourceTypesItem(group: any): ResourceDocumentItem | null {
    if (!this.registryModel || !this.registryModel.groups || !this.registryModel.groups[this.groupType]) return null;
    const groupTypeModel = this.registryModel.groups[this.groupType];
    if (!groupTypeModel.resources) return null;
    const resourceTypes = Object.keys(groupTypeModel.resources);
    // Build array of resource type objects for this group
    const value = resourceTypes.map(rt => {
      const model = groupTypeModel.resources[rt];
      return {
        name: rt,
        count: group[rt + 'count'] ?? undefined,
        model: model,
        description: model.description
      };
    });
    // Build itemModel for the array
    const itemModel = {
      type: 'array',
      item: {
        type: 'object',
        attributes: {
          name: { type: 'string' },
          count: { type: 'number' },
          description: { type: 'string' }
        }
      }
    };
    return {
      key: 'Resource Types',
      value,
      type: 'array',
      description: 'Resource types available in this group',
      itemModel,
      isExpanded: false
    };
  }
}
