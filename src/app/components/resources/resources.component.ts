import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, map } from 'rxjs';
import { RegistryService } from '../../services/registry.service';
import { ResourceDocument } from '../../models/registry.model';
import { ModelService } from '../../services/model.service';
import { ResourceDocumentComponent } from '../resource-document/resource-document.component';
import { LinkSet, PaginationComponent } from '../pagination/pagination.component';
import { ResourceRowComponent } from '../resource-row/resource-row.component';

@Component({
  standalone: true,
  selector: 'app-resources',
  imports: [CommonModule, RouterModule, ResourceDocumentComponent, PaginationComponent, ResourceRowComponent],
  templateUrl: './resources.component.html',
  styleUrls: ['./resources.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class ResourcesComponent implements OnInit {
  groupType!: string;
  groupId!: string;
  resourceType!: string;
  resourcesList: ResourceDocument[] = [];
  pageLinks: { first?: string; prev?: string; next?: string; last?: string } = {};
  resTypeHasDocument = false;
  resourceAttributes: { [key: string]: any } = {}; // Metadata for attributes
  loading = true; // Add loading property for template reference
  viewMode: 'cards' | 'list' = 'cards'; // Default view mode

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
      });
      this.loadResources();
    });
  }  loadResources(pageRel: string = ''): void {
    this.loading = true;
    this.registry.listResources(this.groupType, this.groupId, this.resourceType, pageRel)
      .subscribe(page => {
        console.log('loadResources links:', page.links);
        this.resourcesList = page.items;
          // Process resources to ensure all required fields are present
        this.resourcesList = this.resourcesList.map(resource => {
          // Ensure name is available
          if (!resource['name'] && resource['id']) {
            resource['name'] = resource['id'];
          }

          // Ensure resourceUrl is mapped from docs
          if (!resource['resourceUrl'] && resource['docs']) {
            resource['resourceUrl'] = resource['docs'];
          }

          return resource;
        });

        // Debug the actual resources data
        console.log('Resources loaded:', this.resourcesList);
        if (this.resourcesList.length > 0) {
          console.log('First resource sample:', this.resourcesList[0]);
          console.log('Resource properties:', Object.keys(this.resourcesList[0]));
        }

        this.pageLinks = page.links;
        this.loading = false;

        // Set default view mode based on the number of items
        if (this.resourcesList.length > 20) {
          this.viewMode = 'list';
        } else {
          this.viewMode = 'cards';
        }
      });
  }

  onPageChange(pageRel: string): void {
    this.loadResources(pageRel);
  }

  setViewMode(mode: 'cards' | 'list'): void {
    this.viewMode = mode;
  }

  // These methods are now handled by the ResourceDocumentComponent
  // Keeping displayAttributes for backward compatibility, but we'll no longer use it in the template
  get displayAttributes(): string[] {
    return Object.keys(this.resourceAttributes || {}).filter(
      key => !this.suppressAttributes.includes(key)
    );
  }
}
