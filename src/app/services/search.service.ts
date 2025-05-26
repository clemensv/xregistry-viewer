import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SearchState {
  searchTerm: string;
  isActive: boolean;
  context?: {
    groupType?: string;
    groupId?: string;
    resourceType?: string;
    resourceId?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private searchStateSubject = new BehaviorSubject<SearchState>({
    searchTerm: '',
    isActive: false
  });

  searchState$ = this.searchStateSubject.asObservable();

  constructor() {}

  /**
   * Set the search term and activate search
   */
  setSearchTerm(term: string, context?: SearchState['context']): void {
    const currentState = this.searchStateSubject.value;
    console.log('SearchService.setSearchTerm:', term, 'Context:', context || currentState.context);
    this.searchStateSubject.next({
      searchTerm: term,
      isActive: term.length > 0,
      context: context || currentState.context
    });
  }

  /**
   * Clear the search
   */
  clearSearch(): void {
    const currentState = this.searchStateSubject.value;
    this.searchStateSubject.next({
      searchTerm: '',
      isActive: false,
      context: currentState.context
    });
  }

  /**
   * Set the search context (what type of data we're searching)
   */
  setSearchContext(context: SearchState['context']): void {
    const currentState = this.searchStateSubject.value;
    this.searchStateSubject.next({
      ...currentState,
      context
    });
  }

  /**
   * Get current search state
   */
  getCurrentState(): SearchState {
    return this.searchStateSubject.value;
  }

  /**
   * Generate xRegistry filter expression for name-based prefix search
   */
  generateNameFilter(searchTerm: string): string {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return '';
    }

    const term = searchTerm.trim();
    // Use wildcard pattern for prefix matching: name=term*
    return `name=${term}*`;
  }

  /**
   * Client-side filter function for arrays of items
   * Filters by name (if present) or id as fallback
   */
  filterItems<T extends { name?: string; id?: string }>(items: T[], searchTerm: string): T[] {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return items;
    }

    const term = searchTerm.toLowerCase().trim();
    return items.filter(item => {
      const searchableText = (item.name || item.id || '').toLowerCase();
      return searchableText.startsWith(term);
    });
  }
}
