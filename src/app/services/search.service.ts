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
   * Generate xRegistry-compliant filter expression for name-based search
   * Follows the xRegistry specification for filter query parameters
   * @param searchTerm the search term to filter by
   * @returns xRegistry-compliant filter expression
   */
  generateNameFilter(searchTerm: string): string {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return '';
    }

    const term = searchTerm.trim();

    // Escape special characters according to xRegistry spec
    // Need to escape: ( ) [ ] { } + * ? ^ $ | . \
    const escapedTerm = this.escapeFilterValue(term);

    // For prefix matching with wildcard: name=term*
    // For exact matching: name=term
    // For contains matching: name=*term*

    // Default to prefix matching for name searches as mentioned in the user requirement
    return `name=${escapedTerm}*`;
  }

  /**
   * Generate xRegistry-compliant filter expression for custom attribute search
   * @param attribute the attribute name to search
   * @param value the value to search for
   * @param operator the comparison operator (=, !=, <>, <, <=, >, >=)
   * @param useWildcard whether to add wildcard for contains matching
   * @returns xRegistry-compliant filter expression
   */
  generateAttributeFilter(attribute: string, value: string, operator: string = '=', useWildcard: boolean = false): string {
    if (!attribute || !value) {
      return '';
    }

    const escapedValue = this.escapeFilterValue(value);

    if (useWildcard && (operator === '=' || operator === '!=' || operator === '<>')) {
      return `${attribute}${operator}*${escapedValue}*`;
    }

    return `${attribute}${operator}${escapedValue}`;
  }

  /**
   * Generate multiple filter expressions combined with AND logic
   * @param filters array of filter expressions
   * @returns combined filter string
   */
  combineFiltersAnd(filters: string[]): string {
    const validFilters = filters.filter(f => f && f.trim().length > 0);
    return validFilters.join(',');
  }

  /**
   * Escape special characters in filter values according to xRegistry spec
   * Only escape characters that act as wildcards or regex operators in filter values
   * @param value the value to escape
   * @returns escaped value
   */
  private escapeFilterValue(value: string): string {
    // According to xRegistry spec, only escape characters that have special meaning in filter values
    // The main character that needs escaping in values is the asterisk (*) which is used for wildcards
    // Backslashes need to be escaped to allow literal backslashes
    return value
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/\*/g, '\\*');  // Escape asterisks (wildcards)

    // Note: Other characters like ( ) [ ] { } + ? ^ $ | . are not typically escaped in filter VALUES
    // They are mainly relevant for JSONPath attribute names, not for the values being searched
    // The xRegistry spec example shows "labels.stage=dev" without escaping the dot in the value
  }

  /**
   * Client-side filter function for arrays of items
   * Filters by name (if present) or id as fallback
   * This is used for client-side filtering when server-side filtering is not sufficient
   */
  filterItems<T extends { name?: string; id?: string }>(items: T[], searchTerm: string): T[] {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return items;
    }

    const term = searchTerm.toLowerCase().trim();
    return items.filter(item => {
      const searchableText = (item.name || item.id || '').toLowerCase();
      return searchableText.includes(term); // Changed from startsWith to includes for better UX
    });
  }
}
