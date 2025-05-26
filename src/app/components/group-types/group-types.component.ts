import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ModelService } from '../../services/model.service';
import { DebugService } from '../../services/debug.service';
import { GroupType } from '../../models/registry.model';

@Component({
  standalone: true,
  selector: 'app-group-types',
  imports: [CommonModule, RouterModule],
  templateUrl: './group-types.component.html',
  styleUrls: ['./group-types.component.scss'],
  encapsulation: ViewEncapsulation.None // This ensures styles can affect child components
})
export class GroupTypesComponent implements OnInit {
  groupTypes$!: Observable<{ groupType: string; model: GroupType }[]>;
  viewMode: 'cards' | 'list' = 'cards'; // Default view mode
  groupTypesList: { groupType: string; model: GroupType }[] = [];

  constructor(
    private modelService: ModelService,
    private cdr: ChangeDetectorRef,
    private debug: DebugService
  ) {}

  ngOnInit(): void {
    this.groupTypes$ = this.modelService.getRegistryModel().pipe(
      map(model => {
        const groupTypes = Object.entries(model.groups).map(([groupType, model]) => ({ groupType, model }));
        this.groupTypesList = groupTypes;

        // Set default view mode based on the number of items
        if (this.groupTypesList.length > 10) {
          this.viewMode = 'list';
        } else {
          this.viewMode = 'cards';
        }

        this.debug.log('Loaded group types:', groupTypes);
        this.cdr.markForCheck();

        return groupTypes;
      })
    );
  }

  setViewMode(mode: 'cards' | 'list'): void {
    this.viewMode = mode;
    this.debug.log('View mode changed to:', mode);
  }

  /**
   * Get the resource types count for a group type
   */
  getResourceTypesCount(groupType: GroupType): number {
    return groupType.resources ? Object.keys(groupType.resources).length : 0;
  }

  /**
   * Get the resource types array for a group type
   */
  getResourceTypesList(groupType: GroupType): string[] {
    return groupType.resources ? Object.keys(groupType.resources) : [];
  }

  /**
   * Get a generic icon name for group types
   */
  getIconName(groupType: string): string {
    return 'category';
  }

  /**
   * Get generic CSS class for group type icon styling
   */
  getIconClass(groupType: string): string {
    return 'icon-group-type';
  }
}
