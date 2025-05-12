import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, of, catchError, map, switchMap, tap } from 'rxjs';
import { RegistryService } from '../../services/registry.service';
import { ModelService } from '../../services/model.service';
import { Group } from '../../models/registry.model';

interface ResourceTypeInfo {
  id: string;
  name: string;
  singular: string;
  description: string;
  maxversions: number;
  hasdocument: boolean;
}

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './group.component.html',
  styleUrl: './group.component.scss'
})
export class GroupComponent implements OnInit {  groupType!: string;
  groupId!: string;
  group$!: Observable<Group>;
  resourceTypes$!: Observable<ResourceTypeInfo[]>;
  groupAttributes: { [key: string]: any } = {};
  loading = true; // Add loading property for template reference
  private suppressGroupAttributes = ['groupid', 'id', 'name', 'self', 'xid', 'epoch', 'createdat', 'modifiedat'];

  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    private modelService: ModelService
  ) {}  ngOnInit(): void {
    this.loading = true;
    this.route.paramMap.subscribe(params => {
      this.groupType = params.get('groupType')!;
      this.groupId = params.get('groupId')!;

      // Load group metadata attributes from the registry model
      this.modelService.getRegistryModel().pipe(
        map(model => {
          if (!model.groups[this.groupType]) {
            console.error(`Group type ${this.groupType} not found in registry model`);
            return null;
          }
          return model.groups[this.groupType];
        })
      ).subscribe({
        next: (gtModel) => {
          if (gtModel) {
            this.groupAttributes = gtModel.attributes || {};
            console.log('Group attributes loaded:', this.groupAttributes);
          }
        },
        error: (err) => {
          console.error('Error loading group type model:', err);
        }
      });

      // Load the specific group
      this.group$ = this.registry.getGroup(this.groupType, this.groupId).pipe(
        tap(group => {
          console.log('Group data loaded:', group);
        }),
        catchError(err => {
          console.error('Error loading group:', err);
          return of({} as Group);
        })
      );

      // Load resource types for this group type
      this.resourceTypes$ = this.modelService.getRegistryModel().pipe(
        map(model => {
          if (!model.groups[this.groupType] || !model.groups[this.groupType].resources) {
            console.warn(`No resources found for groupType: ${this.groupType}`);
            return [];
          }

          // Get resource types and add details from model
          const resourceTypes = Object.keys(model.groups[this.groupType].resources);
          return resourceTypes.map(rt => ({
            id: rt,
            name: model.groups[this.groupType].resources[rt].plural || rt,
            singular: model.groups[this.groupType].resources[rt].singular || rt,
            description: model.groups[this.groupType].resources[rt].description || '',
            maxversions: model.groups[this.groupType].resources[rt].maxversions || 1,
            hasdocument: model.groups[this.groupType].resources[rt].hasdocument || false
          }));
        }),        catchError(err => {
          console.error('Error loading resource types:', err);
          return of([]);
        }),
        tap(() => {
          this.loading = false;
        })
      );
    });
  }

  get displayGroupAttributes(): string[] {
    return Object.keys(this.groupAttributes || {}).filter(
      key => !this.suppressGroupAttributes.includes(key) && !key.endsWith('url')
    );
  }

  hasValue(value: any): boolean {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return value !== '';
  }
}
