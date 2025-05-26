import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DebugService } from '../../services/debug.service';

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
export class PaginationComponent implements OnChanges {
  @Input() links: LinkSet = {};
  @Output() pageChange = new EventEmitter<string>();

  constructor(private debug: DebugService) {}

  ngOnChanges() {
    this.debug.log('Pagination component links received:', this.links);
    // Log each specific link value
    this.debug.log('  first:', this.links.first);
    this.debug.log('  prev:', this.links.prev);
    this.debug.log('  next:', this.links.next);
    this.debug.log('  last:', this.links.last);

    // Check if any links are defined
    const hasLinks = this.links && Object.values(this.links).some(link => !!link);
    this.debug.log('  Has any links?', hasLinks);

    // Check if the pagination component will be visible
    const isVisible = this.links && (this.links.first || this.links.prev || this.links.next || this.links.last);
    this.debug.log('  Pagination will be visible?', isVisible);
  }

  onRel(rel: keyof LinkSet): void {
    const url = this.links[rel];
    if (url) {
      this.debug.log(`Pagination navigating to ${rel} link: ${url}`);
      this.pageChange.emit(url);
    } else {
      console.warn(`Attempted to navigate to ${rel} link, but URL is not defined`);
    }
  }
}
