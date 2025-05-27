import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaginationComponent, LinkSet } from '../pagination/pagination.component';

export type ViewMode = 'cards' | 'list';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss'
})
export class PageHeaderComponent {
  @Input() title: string = '';
  @Input() showViewToggle: boolean = false;
  @Input() currentViewMode: ViewMode = 'cards';
  @Input() showPagination: boolean = false;
  @Input() pageLinks: LinkSet = {};
  @Input() resultsCount: number = 0;
  @Input() totalCount: number = 0; // Total number of items in collection (when available)
  @Input() resultsText: string = 'items';
  @Input() searchResultsText: string = '';

  @Output() viewModeChange = new EventEmitter<ViewMode>();
  @Output() pageChange = new EventEmitter<string>();

  setViewMode(mode: ViewMode): void {
    this.viewModeChange.emit(mode);
  }

  onPageChange(pageRel: string): void {
    this.pageChange.emit(pageRel);
  }

  // Helper method to get the results display text
  getResultsDisplayText(): string {
    if (this.searchResultsText) {
      return this.searchResultsText;
    }

    if (this.totalCount > 0 && this.totalCount !== this.resultsCount) {
      return `Showing ${this.resultsCount} of ${this.totalCount} ${this.resultsText}`;
    }

    if (this.resultsCount > 0) {
      return `Showing ${this.resultsCount} ${this.resultsText}`;
    }

    return '';
  }
}
