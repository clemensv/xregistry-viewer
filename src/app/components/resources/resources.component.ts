import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, map } from 'rxjs';
import { RegistryService } from '../../services/registry.service';
import { Resource } from '../../models/registry.model';
import { ModelService } from '../../services/model.service';

@Component({
  standalone: true,
  selector: 'app-resources',
  imports: [CommonModule, RouterModule],
  templateUrl: './resources.component.html',
  styleUrls: ['./resources.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class ResourcesComponent implements OnInit {
  groupType!: string;
  groupId!: string;
  resourceType!: string;
  resources$!: Observable<Resource[]>;
  resTypeHasDocument = false;
  resourceAttributes: { [key: string]: any } = {}; // Metadata for attributes
  loading = true; // Add loading property for template reference

  private suppressAttributes = ['xid', 'self', 'epoch', 'isdefault', 'ancestor', 'versionscount', 'versionsurl', 'metaurl', 'createdat', 'modifiedat'];

  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    private modelService: ModelService
  ) {}
  ngOnInit(): void {
    this.loading = true;
    this.route.paramMap.subscribe(params => {
      this.groupType = params.get('groupType')!;
      this.groupId = params.get('groupId')!;
      this.resourceType = params.get('resourceType')!;

      // Load resource type metadata
      this.modelService.getRegistryModel().pipe(
        map(m => m.groups[this.groupType].resources[this.resourceType])
      ).subscribe(rtModel => {
        this.resourceAttributes = rtModel.attributes || {};
        this.resTypeHasDocument = rtModel.hasdocument;
      });      // Load actual resource instances
      this.resources$ = this.registry.listResources(
        this.groupType,
        this.groupId,
        this.resourceType
      ).pipe(
        map(resources => {
          this.loading = false;
          return resources;
        })
      );
    });
  }

  get displayAttributes(): string[] {
    return Object.keys(this.resourceAttributes || {}).filter(
      key => !this.suppressAttributes.includes(key)
    );
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  isObject(value: any): boolean {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  /** Returns true if the value is non-null, non-empty (for strings, arrays, objects) */
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
}
