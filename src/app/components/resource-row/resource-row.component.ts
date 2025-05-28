import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { truncateText, truncateDescription, formatDateShort, getFullText } from '../../utils/text.utils';
import { DebugService } from '../../services/debug.service';

@Component({
  // Use a property selector instead of an element selector
  // This allows the component to be used as an attribute on a tr element
  selector: '[app-resource-row]',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule],
  templateUrl: './resource-row.component.html',
  styleUrls: ['./resource-row.component.scss']
})
export class ResourceRowComponent implements OnInit {
  @Input() resource: any;
  @Input() groupType!: string;
  @Input() groupId!: string;
  @Input() resourceType!: string;
  @Input() hasDocumentSupport: boolean = false;

  // Utility functions for template
  truncateText = truncateText;
  truncateDescription = truncateDescription;
  formatDateShort = formatDateShort;
  getFullText = getFullText;

  constructor(private debug: DebugService) {}

  ngOnInit(): void {
    // Debug: Log the resource to see what data is available
    this.debug.log('Resource Row received data:', this.resource);
    this.debug.log('Has document support:', this.hasDocumentSupport);

    // Map documentation field to resourceUrl if it exists
    if (this.resource && this.resource['documentation']) {
      this.debug.log('Mapped documentation to resourceUrl:', this.resource['documentation']);
    }
  }
}
