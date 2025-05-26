import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SearchService } from '../../services/search.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-search',
  imports: [CommonModule, FormsModule, MatInputModule, MatFormFieldModule, MatIconModule, MatButtonModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  searchVisible = true; // Always visible in header
  searchTerm = '';
  private destroy$ = new Subject<void>();

  constructor(
    private searchService: SearchService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Subscribe to search state changes
    this.searchService.searchState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.searchTerm = state.searchTerm;
      });

    // Listen to route changes to update search context
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.updateSearchContext(event.url);
      });

    // Set initial context
    this.updateSearchContext(this.router.url);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onInput(): void {
    // Trigger search immediately for any input change
    console.log('Search input changed:', this.searchTerm);
    this.searchService.setSearchTerm(this.searchTerm);
  }

  onSearch(): void {
    console.log('Search triggered:', this.searchTerm);
    this.searchService.setSearchTerm(this.searchTerm);
  }

  clearSearch(): void {
    console.log('Search cleared');
    this.searchTerm = '';
    this.searchService.clearSearch();
  }

  private updateSearchContext(url: string): void {
    // Parse URL to determine search context
    const urlParts = url.split('/').filter(part => part.length > 0);

    if (urlParts.length >= 1) {
      const context: any = {
        groupType: urlParts[0]
      };

      if (urlParts.length >= 2) {
        context.groupId = urlParts[1];
      }

      if (urlParts.length >= 3) {
        context.resourceType = urlParts[2];
      }

      if (urlParts.length >= 4) {
        context.resourceId = urlParts[3];
      }

      this.searchService.setSearchContext(context);
    }
  }
}
