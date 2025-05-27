import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { truncateText, truncateDescription, formatDateShort, getFullText } from '../../utils/text.utils';

@Component({
  // Use a property selector instead of an element selector
  // This allows the component to be used as an attribute on a tr element
  selector: '[app-resource-row]',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './resource-row.component.html',
  styleUrls: ['./resource-row.component.scss']
})
export class ResourceRowComponent implements OnInit {
  @Input() resource: any;
  @Input() resourceType!: string;
  @Input() hasDocumentSupport: boolean = false;

  // Utility functions for template
  truncateText = truncateText;
  truncateDescription = truncateDescription;
  formatDateShort = formatDateShort;
  getFullText = getFullText;

  ngOnInit() {
    // Debug: Log the resource to see what data is available
    console.log('Resource Row received data:', this.resource);
    console.log('Has document support:', this.hasDocumentSupport);

    // Ensure documentation field is mapped to resourceUrl if not already present
    if (this.resource && this.resource['documentation'] && !this.resource['resourceUrl']) {
      this.resource['resourceUrl'] = this.resource['documentation'];
      console.log('Mapped documentation to resourceUrl:', this.resource['documentation']);
    }
  }
}
