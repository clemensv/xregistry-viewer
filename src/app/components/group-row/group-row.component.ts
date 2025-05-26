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
}
