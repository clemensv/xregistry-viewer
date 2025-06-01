import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { SearchService } from '../../services/search.service';
import { DebugService } from '../../services/debug.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IconComponent } from '../icon/icon.component';

@Component({
  standalone: true,
  selector: 'app-search',
  imports: [CommonModule, FormsModule, IconComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchInput', { static: false }) searchInput!: ElementRef<HTMLInputElement>;

  searchVisible = true; // Always visible in header
  searchTerm = '';
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private readonly SEARCH_DEBOUNCE_TIME = 300; // milliseconds

  constructor(
    private searchService: SearchService,
    private debug: DebugService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Subscribe to search state changes to sync with external updates
    this.searchService.searchState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        if (state.searchTerm !== this.searchTerm) {
          this.searchTerm = state.searchTerm;
        }
      });

    // Set up debounced search
    this.searchSubject
      .pipe(
        debounceTime(this.SEARCH_DEBOUNCE_TIME),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(searchTerm => {
        this.debug.log('Debounced search triggered after', this.SEARCH_DEBOUNCE_TIME, 'ms:', searchTerm);
        this.searchService.setSearchTerm(searchTerm);
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

  ngAfterViewInit(): void {
    // Focus the search input when the component is initialized
    if (this.searchInput) {
      setTimeout(() => {
        this.searchInput.nativeElement.focus();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event?: Event): void {
    if (event) {
      const target = event.target as HTMLInputElement;
      this.searchTerm = target.value;
    }
    this.debug.log('Search input changed:', this.searchTerm);
    this.searchSubject.next(this.searchTerm);
  }

  onSearchSubmit(): void {
    this.debug.log('Search triggered:', this.searchTerm);
    this.searchService.setSearchTerm(this.searchTerm);
  }

  clearSearch(): void {
    this.debug.log('Search cleared');
    this.searchTerm = '';
    this.searchService.clearSearch();
    if (this.searchInput) {
      this.searchInput.nativeElement.focus();
    }
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
