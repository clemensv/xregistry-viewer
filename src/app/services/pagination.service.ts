import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { LinkSet } from '../components/pagination/pagination.component';

@Injectable({
  providedIn: 'root'
})
export class PaginationService {
  private paginationSubject = new BehaviorSubject<{links: LinkSet, callback: (url: string) => void} | null>(null);
  private isExecutingCallback = false; // Flag to prevent recursive execution

  // Search functionality
  private searchEnabledSubject = new BehaviorSubject<boolean>(false);
  private searchTermSubject = new Subject<string>();
  private searchExecutor?: (term: string) => void;

  pagination$ = this.paginationSubject.asObservable();
  searchEnabled$ = this.searchEnabledSubject.asObservable();

  constructor() {
    // Set up debounced search with minimum character check
    this.searchTermSubject.pipe(
      filter(term => term.length >= 3 || term.length === 0), // Either 3+ chars or empty to clear
      debounceTime(1000), // Wait 1 second after the last event
      distinctUntilChanged() // Only emit when the value changes
    ).subscribe(term => {
      if (this.searchExecutor) {
        this.searchExecutor(term);
      }
    });
  }

  setPagination(links: LinkSet, callback: (url: string) => void): void {
    this.paginationSubject.next({ links, callback });
  }

  clearPagination(): void {
    this.paginationSubject.next(null);
  }

  executePaginationCallback(url: string): void {
    // Prevent multiple simultaneous or recursive executions
    if (this.isExecutingCallback) {
      console.warn('Pagination callback execution already in progress, ignoring additional request');
      return;
    }

    const currentValue = this.paginationSubject.getValue();
    if (currentValue && currentValue.callback) {
      try {
        this.isExecutingCallback = true;
        currentValue.callback(url);
      } finally {
        // Always reset the flag to allow future executions
        setTimeout(() => {
          this.isExecutingCallback = false;
        }, 100); // Small delay to prevent rapid repeated clicks
      }
    }
  }
  // Search functionality methods
  setSearchEnabled(enabled: boolean): void {
    console.log('Search functionality enabled:', enabled);
    this.searchEnabledSubject.next(enabled);
  }

  setSearchExecutor(executor: (term: string) => void): void {
    this.searchExecutor = executor;
  }

  searchTerm(term: string): void {
    this.searchTermSubject.next(term);
  }
}
