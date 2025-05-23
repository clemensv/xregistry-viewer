import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, map } from 'rxjs';
import { RegistryService } from '../../services/registry.service';
import { ResourceDocument } from '../../models/registry.model';
import { ModelService } from '../../services/model.service';
import { ResourceDocumentComponent } from '../resource-document/resource-document.component';

@Component({
  standalone: true,
  selector: 'app-resources',
  imports: [CommonModule, RouterModule, ResourceDocumentComponent],
  templateUrl: './resources.component.html',
  styleUrls: ['./resources.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class ResourcesComponent implements OnInit {
  groupType!: string;
  groupId!: string;
  resourceType!: string;
  resources$!: Observable<ResourceDocument[]>;
  resTypeHasDocument = false;
  resourceAttributes: { [key: string]: any } = {}; // Metadata for attributes
  loading = true; // Add loading property for template reference

  private suppressAttributes = ['xid', 'self', 'epoch', 'isdefault', 'ancestor', 'versionscount', 'versionsCount', 'versionsurl', 'metaurl', 'createdat', 'modifiedat', 'createdAt', 'modifiedAt'];

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
  // These methods are now handled by the ResourceDocumentComponent
  // Keeping displayAttributes for backward compatibility, but we'll no longer use it in the template
  get displayAttributes(): string[] {
    return Object.keys(this.resourceAttributes || {}).filter(
      key => !this.suppressAttributes.includes(key)
    );
  }
}
