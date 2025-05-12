import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { RegistryService } from '../../services/registry.service';
import { ModelService } from '../../services/model.service';
import { Group } from '../../models/registry.model';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-groups',
  imports: [CommonModule, RouterModule, FormsModule], // Added FormsModule
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class GroupsComponent implements OnInit {
  groupType!: string;
  groups$!: Observable<Group[]>;
  resourceTypes$!: Observable<string[]>;
  groupAttributes: { [key: string]: any } = {};
  private suppressGroupAttributes = ['groupid', 'id', 'name', 'self', 'xid', 'epoch', 'createdat', 'modifiedat'];

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
}
