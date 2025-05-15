import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, of, switchMap, tap, catchError, map } from 'rxjs';
import { RegistryService } from '../../services/registry.service';
import { ModelService } from '../../services/model.service';
import { Resource, VersionDetail } from '../../models/registry.model';

@Component({
  selector: 'app-resource',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './resource.component.html',
  styleUrl: './resource.component.scss'
})
export class ResourceComponent implements OnInit {
  groupType!: string;
  groupId!: string;
  resourceType!: string;
  resourceId!: string;
  resourceTypeData: any;
  hasMultipleVersions = false;
  defaultVersion$!: Observable<VersionDetail>;
  versions$!: Observable<any[]>;
  resourceAttributes: { [key: string]: any } = {};
  loading = true; // Add loading property for template reference

  constructor(
    private route: ActivatedRoute,
    private registry: RegistryService,
    private modelService: ModelService
  ) {}  ngOnInit(): void {
    this.loading = true;
    this.route.paramMap.pipe(
      tap(params => {
        this.groupType = params.get('groupType')!;
        this.groupId = params.get('groupId')!;
        this.resourceType = params.get('resourceType')!;
        this.resourceId = params.get('resourceId')!;
      }),
      switchMap(() => this.modelService.getRegistryModel())
    ).subscribe({
      next: (model) => {
        if (!model.groups[this.groupType] || !model.groups[this.groupType].resources[this.resourceType]) {
          console.error(`Resource type ${this.resourceType} not found in group type ${this.groupType}`);
          return;
        }

        this.resourceTypeData = model.groups[this.groupType].resources[this.resourceType];
        this.resourceAttributes = this.resourceTypeData.attributes || {};

        // Check if this resource type supports multiple versions
        // According to xRegistry spec, maxversions property determines version storage count
        this.hasMultipleVersions = this.resourceTypeData.maxversions != 1;

        if (this.hasMultipleVersions) {
          // Load all versions when multiple versions are supported
          this.loadVersions();
        } else {
          // Load only default version when single version is supported
          this.loadDefaultVersion();
        }
      },
      error: (err) => {
        console.error('Error loading registry model:', err);
      }
    });
  }
  loadDefaultVersion(): void {
    this.defaultVersion$ = this.registry.getResourceDetail(
      this.groupType,
      this.groupId,
      this.resourceType,
      this.resourceId,
      this.resourceTypeData?.hasdocument || false
    ).pipe(
      tap(() => {
        // Set loading to false when the default version is loaded
        this.loading = false;
      }),
      catchError(err => {
        console.error('Error loading default version:', err);
        this.loading = false;
        return of({} as VersionDetail);
      })
    );
  }

  loadVersions(): void {
    // First, load the resource details to get metadata
    this.registry.getResource(
      this.groupType,
      this.groupId,
      this.resourceType,
      this.resourceId
    ).subscribe({
      next: (resource) => {
        // Check how many versions we have according to versionscount
        const versionsCount = resource['versionscount'] || 0;
        console.log(`Resource has ${versionsCount} versions`);

        // Load the default version to display first
        this.loadDefaultVersion();

        // Get all versions from the API
        this.versions$ = this.registry.getResourceVersions(
          this.groupType,
          this.groupId,
          this.resourceType,
          this.resourceId
        ).pipe(
          map(versions => {
            // Sort versions by date (newest first) if available
            if (versions.length > 0 && (versions[0]['createdat'] || versions[0]['createdAt'])) {
              return versions.sort((a, b) => {
                const dateA = a['modifiedat'] || a['modifiedAt'] || a['createdat'] || a['createdAt'];
                const dateB = b['modifiedat'] || b['modifiedAt'] || b['createdat'] || b['createdAt'];
                return new Date(dateB).getTime() - new Date(dateA).getTime();
              });
            }
            return versions;
          }),          tap(versions => {
            // Mark the default version
            const defaultVersionId = resource['defaultversionid'] || resource['meta']?.defaultversionid;
            if (defaultVersionId) {
              versions.forEach(v => {
                v['isDefault'] = (v['id'] === defaultVersionId || v['versionid'] === defaultVersionId);
              });
            }
            this.loading = false; // Set loading to false when versions are loaded
          }),
          catchError(err => {
            console.error('Error loading resource versions:', err);
            this.loading = false; // Set loading to false even on error
            return of([]);
          })
        );
      },
      error: (err) => {
        console.error('Error loading resource:', err);
        this.versions$ = of([]);
        // Still try to load default version
        this.loadDefaultVersion();
      }
    });
  }

  objectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') {
      console.warn('Invalid object passed to objectKeys:', obj);
      return [];
    }
    return Object.keys(obj);
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  isObject(value: any): boolean {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

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

  get displayAttributes(): string[] {
    return Object.keys(this.resourceAttributes || {}).filter(
      key => !['xid', 'self', 'epoch', 'isdefault', 'ancestor', 'versionscount', 'versionsurl', 'metaurl', 'createdat', 'modifiedat'].includes(key)
    );
  }
}
