import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { RegistryService } from '../../services/registry.service';
import { VersionDetail } from '../../models/registry.model';
import { combineLatest } from 'rxjs';
import { ModelService } from '../../services/model.service';

@Component({
  standalone: true,
  selector: 'app-version-detail',
  imports: [CommonModule],
  templateUrl: './version-detail.component.html',
  styleUrls: ['./version-detail.component.scss']
})
export class VersionDetailComponent implements OnInit {
  version$!: Observable<VersionDetail>;
  groupType!: string;
  groupId!: string;
  resourceType!: string;
  resourceId!: string;
  versionId!: string;
  resourceAttributes: { [key: string]: any } = {};
  resTypeHasDocument: boolean = false;

  constructor(private route: ActivatedRoute, private registry: RegistryService, private modelService: ModelService) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.groupType = params.get('groupType')!;
      this.groupId = params.get('groupId')!;
      this.resourceType = params.get('resourceType')!;
      this.resourceId = params.get('resourceId')!;
      this.versionId = params.get('versionId')!;

      // Load resource type metadata
      this.modelService.getRegistryModel().pipe(
        map(m => m.groups[this.groupType]?.resources[this.resourceType])
      ).subscribe(rtModel => {
        this.resourceAttributes = rtModel?.attributes || {};
        this.resTypeHasDocument = rtModel?.hasdocument || false;
      }, error => {
        console.error('Error fetching registry model:', error);
        this.resourceAttributes = {};
        this.resTypeHasDocument = false;
      });

      // Load version details
      this.version$ = this.registry.getVersionDetail(
        this.groupType,
        this.groupId,
        this.resourceType,
        this.resourceId,
        this.versionId,
        this.resTypeHasDocument
      );
    });
  }

  objectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') {
      console.warn('Invalid object passed to objectKeys:', obj);
      return [];
    }
    return Object.keys(obj);
  }

  // In the template, ensure objectKeys is only called when the object is defined
  // Example usage in the template:
  // *ngIf="resourceAttributes && objectKeys(resourceAttributes).length > 0"

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
