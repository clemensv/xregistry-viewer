import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LinkSet {
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
}

@Component({
  standalone: true,
  selector: 'app-pagination',
  imports: [CommonModule], // enable ngIf, ngFor directives
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss']
})
export class PaginationComponent implements OnChanges {@Input() links: LinkSet = {};
  @Output() pageChange = new EventEmitter<string>();

  ngOnChanges() {
    console.log('Pagination component links received:', this.links);
  }

  onRel(rel: keyof LinkSet): void {
    const url = this.links[rel];
    if (url) {
      console.log(`Pagination navigating to ${rel} link: ${url}`);
      this.pageChange.emit(url);
    }
  }
}
