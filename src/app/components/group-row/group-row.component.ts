import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Group } from '../../models/registry.model';

@Component({
  // Use a property selector instead of an element selector
  // This allows the component to be used as an attribute on a tr element
  selector: '[app-group-row]',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './group-row.component.html',
  styleUrls: ['./group-row.component.scss']
})
export class GroupRowComponent implements OnInit {
  @Input() group!: Group;
  @Input() groupType!: string;
  @Input() resourceTypes: any[] = [];

  ngOnInit() {
    // Debug: Log the group to see what data is available
    console.log('Group Row received data:', this.group);
    console.log('Group Type:', this.groupType);
    console.log('Resource Types:', this.resourceTypes);
  }

  /**
   * Helper method to get object keys for template iteration
   */
  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  /**
   * Get the navigation route for the group
   * If there's only one resource type, navigate directly to it
   * Otherwise, determine the best navigation target
   */
  getGroupNavigationRoute(): string[] {
    if (!this.group || !this.groupType) {
      return ['/']; // fallback to home
    }

    // If there are resource types available, navigate to the first one
    if (this.resourceTypes && this.resourceTypes.length === 1) {
      const resourceType = this.resourceTypes[0];
      return ['/', this.groupType, this.group['id'], resourceType.name];
    }

    // If there are multiple resource types, still go to the first one for consistency
    // or we could navigate to a group detail page if it existed
    if (this.resourceTypes && this.resourceTypes.length > 0) {
      const resourceType = this.resourceTypes[0];
      return ['/', this.groupType, this.group['id'], resourceType.name];
    }

    // Fallback: try to navigate to 'schemas' resource type (common case)
    return ['/', this.groupType, this.group['id'], 'schemas'];
  }
}
