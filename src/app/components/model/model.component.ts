import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewEncapsulation, ElementRef, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ModelService } from '../../services/model.service';
import { ConfigService } from '../../services/config.service';
import { DebugService } from '../../services/debug.service';
import { RegistryModel, GroupType } from '../../models/registry.model';
import { GroupTypeModelComponent } from '../group-type-model/group-type-model.component';
import { ResourceDocumentItemComponent } from '../resource-document-item/resource-document-item.component';
import { ResourceDocumentItem } from '../../models/resource-document-item.model';
import { IconComponent } from '../icon/icon.component';

@Component({
  standalone: true,
  selector: 'app-model',
  imports: [CommonModule, RouterModule, GroupTypeModelComponent, ResourceDocumentItemComponent, IconComponent],
  templateUrl: './model.component.html',
  styleUrls: ['./model.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class ModelComponent implements OnInit, OnDestroy, AfterViewInit {
  registryModel: RegistryModel | null = null;
  groupTypes: { groupType: string; model: GroupType; origins: string[] }[] = [];
  targetGroupType: string | null = null;
  loading = true;
  loadingProgress = true;

  registryDocumentItems: ResourceDocumentItem[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private modelService: ModelService,
    private configService: ConfigService,
    private debug: DebugService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Get target group type from route parameters
    this.targetGroupType = this.route.snapshot.paramMap.get('groupType');

    this.waitForConfigAndLoadData();
  }

  ngAfterViewInit(): void {
    // Scroll to target group type if specified
    if (this.targetGroupType && !this.loading) {
      setTimeout(() => this.scrollToGroupType(this.targetGroupType!), 100);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private waitForConfigAndLoadData(): void {
    // Check if config is already loaded
    const config = this.configService.getConfig();
    if (config && config.apiEndpoints && config.apiEndpoints.length > 0) {
      this.loadData();
      return;
    }

    // Config not loaded yet, wait for it
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait

    const checkInterval = interval(100).pipe(takeUntil(this.destroy$)).subscribe(() => {
      attempts++;
      const currentConfig = this.configService.getConfig();

      if (currentConfig && currentConfig.apiEndpoints && currentConfig.apiEndpoints.length > 0) {
        checkInterval.unsubscribe();
        this.loadData();
      } else if (attempts >= maxAttempts) {
        this.debug.log('ModelComponent: Timeout waiting for config, proceeding anyway');
        checkInterval.unsubscribe();
        this.loadData();
      }
    });
  }

  private loadData(): void {
    this.modelService.getProgressiveRegistryModel()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.registryModel = result.model;
          this.buildRegistryDocumentItems();
          this.buildGroupTypes();

          // Update loading states
          this.loadingProgress = !result.isComplete;
          if (this.loading && this.registryModel) {
            this.loading = false;

            // Scroll to target group type after loading
            if (this.targetGroupType) {
              setTimeout(() => this.scrollToGroupType(this.targetGroupType!), 100);
            }
          }
          if (result.isComplete) {
            this.loading = false;
            this.loadingProgress = false;
          }

          this.debug.log(`ModelComponent: Updated model (${result.loadedCount}/${result.totalCount} endpoints loaded)`);
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('ModelComponent: Error loading registry model:', error);
          this.loading = false;
          this.loadingProgress = false;
          this.cdr.markForCheck();
        }
      });
  }

  private buildRegistryDocumentItems(): void {
    if (!this.registryModel) return;

    this.registryDocumentItems = [];

    // Basic registry information
    this.registryDocumentItems.push({
      key: 'Registry ID',
      value: this.registryModel.registryid,
      type: 'string',
      description: 'Unique identifier for this registry',
      itemModel: { type: 'string' },
      isExpanded: false
    });

    this.registryDocumentItems.push({
      key: 'Name',
      value: this.registryModel.name,
      type: 'string',
      description: 'Human-readable name of the registry',
      itemModel: { type: 'string' },
      isExpanded: false
    });

    this.registryDocumentItems.push({
      key: 'Description',
      value: this.registryModel.description,
      type: 'string',
      description: 'Description of the registry',
      itemModel: { type: 'string' },
      isExpanded: false
    });

    this.registryDocumentItems.push({
      key: 'Spec Version',
      value: this.registryModel.specversion,
      type: 'string',
      description: 'Version of the xRegistry specification',
      itemModel: { type: 'string' },
      isExpanded: false
    });

    // Capabilities
    this.registryDocumentItems.push({
      key: 'Capabilities',
      value: this.registryModel.capabilities,
      type: 'object',
      description: 'Registry capabilities and supported features',
      itemModel: {
        type: 'object',
        attributes: {
          apis: { type: 'array', description: 'Supported API versions' },
          schemas: { type: 'array', description: 'Supported schema formats' },
          pagination: { type: 'boolean', description: 'Whether pagination is supported' }
        }
      },
      isExpanded: true
    });
  }

  private buildGroupTypes(): void {
    if (!this.registryModel || !this.registryModel.groups) return;

    this.groupTypes = Object.entries(this.registryModel.groups).map(([groupType, model]) => ({
      groupType,
      model,
      origins: this.modelService.getApiEndpointsForGroupType(groupType)
    }));
  }

  private scrollToGroupType(groupType: string): void {
    const element = this.elementRef.nativeElement.querySelector(`#group-type-${groupType}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
