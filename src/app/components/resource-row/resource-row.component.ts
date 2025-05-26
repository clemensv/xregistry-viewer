import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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
    ngOnInit() {
    // Debug: Log the resource to see what data is available
    console.log('Resource Row received data:', this.resource);
    console.log('Has document support:', this.hasDocumentSupport);

    // Ensure docs field is mapped to resourceUrl if not already present
    if (this.resource && this.resource['docs'] && !this.resource['resourceUrl']) {
      this.resource['resourceUrl'] = this.resource['docs'];
      console.log('Mapped docs to resourceUrl:', this.resource['docs']);
    }
  }
}
