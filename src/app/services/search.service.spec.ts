import { TestBed } from '@angular/core/testing';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SearchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateNameFilter', () => {
    it('should return empty string for empty or null search terms', () => {
      expect(service.generateNameFilter('')).toBe('');
      expect(service.generateNameFilter('   ')).toBe('');
      expect(service.generateNameFilter(null as any)).toBe('');
      expect(service.generateNameFilter(undefined as any)).toBe('');
    });

    it('should generate basic name filter with wildcard for simple terms', () => {
      expect(service.generateNameFilter('test')).toBe('name=test*');
      expect(service.generateNameFilter('api')).toBe('name=api*');
      expect(service.generateNameFilter('myresource')).toBe('name=myresource*');
    });

    it('should escape special characters according to xRegistry spec', () => {
      // Test escaping of wildcards and backslashes (the main characters that need escaping in values)
      expect(service.generateNameFilter('test*')).toBe('name=test\\**');
      expect(service.generateNameFilter('test\\backslash')).toBe('name=test\\\\backslash*');

      // Test that other characters are NOT escaped in values (according to xRegistry spec)
      expect(service.generateNameFilter('test(1)')).toBe('name=test(1)*');
      expect(service.generateNameFilter('test[0]')).toBe('name=test[0]*');
      expect(service.generateNameFilter('test{obj}')).toBe('name=test{obj}*');
      expect(service.generateNameFilter('test+plus')).toBe('name=test+plus*');
      expect(service.generateNameFilter('test?query')).toBe('name=test?query*');
      expect(service.generateNameFilter('test^caret')).toBe('name=test^caret*');
      expect(service.generateNameFilter('test$end')).toBe('name=test$end*');
      expect(service.generateNameFilter('test|pipe')).toBe('name=test|pipe*');
      expect(service.generateNameFilter('test.dot')).toBe('name=test.dot*');
    });

    it('should handle combinations of special characters', () => {
      expect(service.generateNameFilter('api[v1.0]')).toBe('name=api[v1.0]*');
      expect(service.generateNameFilter('schema(test)*')).toBe('name=schema(test)\\**');
    });

    it('should trim whitespace from search terms', () => {
      expect(service.generateNameFilter('  test  ')).toBe('name=test*');
      expect(service.generateNameFilter('\tapi\n')).toBe('name=api*');
    });
  });

  describe('generateAttributeFilter', () => {
    it('should return empty string for missing attribute or value', () => {
      expect(service.generateAttributeFilter('', 'value')).toBe('');
      expect(service.generateAttributeFilter('attr', '')).toBe('');
      expect(service.generateAttributeFilter(null as any, 'value')).toBe('');
      expect(service.generateAttributeFilter('attr', null as any)).toBe('');
    });

    it('should generate basic attribute filters with default equals operator', () => {
      expect(service.generateAttributeFilter('description', 'test')).toBe('description=test');
      expect(service.generateAttributeFilter('version', '1.0')).toBe('version=1.0');
    });

    it('should support different comparison operators', () => {
      expect(service.generateAttributeFilter('count', '10', '>')).toBe('count>10');
      expect(service.generateAttributeFilter('score', '5', '<=')).toBe('score<=5');
      expect(service.generateAttributeFilter('status', 'active', '!=')).toBe('status!=active');
      expect(service.generateAttributeFilter('type', 'old', '<>')).toBe('type<>old');
    });

    it('should add wildcards for contains matching when specified', () => {
      expect(service.generateAttributeFilter('description', 'cool', '=', true)).toBe('description=*cool*');
      expect(service.generateAttributeFilter('name', 'test', '!=', true)).toBe('name!=*test*');
      expect(service.generateAttributeFilter('category', 'api', '<>', true)).toBe('category<>*api*');
    });

    it('should not add wildcards for comparison operators other than =, !=, <>', () => {
      expect(service.generateAttributeFilter('count', '10', '>', true)).toBe('count>10');
      expect(service.generateAttributeFilter('score', '5', '<=', true)).toBe('score<=5');
    });

    it('should escape special characters in attribute values', () => {
      expect(service.generateAttributeFilter('name', 'test*value')).toBe('name=test\\*value');
      expect(service.generateAttributeFilter('path', 'api[v1.0]')).toBe('path=api[v1.0]');
      expect(service.generateAttributeFilter('description', 'test\\path')).toBe('description=test\\\\path');
    });
  });

  describe('combineFiltersAnd', () => {
    it('should return empty string for empty or invalid filter arrays', () => {
      expect(service.combineFiltersAnd([])).toBe('');
      expect(service.combineFiltersAnd(['', '  ', null as any])).toBe('');
    });

    it('should return single filter unchanged', () => {
      expect(service.combineFiltersAnd(['name=test*'])).toBe('name=test*');
    });

    it('should combine multiple filters with comma (AND logic)', () => {
      const filters = ['name=test*', 'description=*cool*', 'version=1.0'];
      expect(service.combineFiltersAnd(filters)).toBe('name=test*,description=*cool*,version=1.0');
    });

    it('should filter out empty strings and whitespace', () => {
      const filters = ['name=test*', '', '  ', 'description=*cool*', null as any];
      expect(service.combineFiltersAnd(filters)).toBe('name=test*,description=*cool*');
    });
  });

  describe('filterItems client-side filtering', () => {
    const mockItems = [
      { id: 'item1', name: 'test-api' },
      { id: 'item2', name: 'production-api' },
      { id: 'item3', name: 'Test Service' },
      { id: 'item4', name: 'dev-endpoint' },
      { id: 'item5' }, // No name property
      { name: 'another-test' }, // No id property
    ];

    it('should return all items for empty search term', () => {
      expect(service.filterItems(mockItems, '')).toEqual(mockItems);
      expect(service.filterItems(mockItems, '   ')).toEqual(mockItems);
    });

    it('should filter items by name (case-insensitive contains)', () => {
      const result = service.filterItems(mockItems, 'test');
      expect(result).toHaveLength(3);
      expect(result.map(item => item.name || item.id)).toEqual(['test-api', 'Test Service', 'another-test']);
    });

    it('should filter items by name with case insensitive matching', () => {
      const result = service.filterItems(mockItems, 'API');
      expect(result).toHaveLength(2);
      expect(result.map(item => item.name)).toEqual(['test-api', 'production-api']);
    });

    it('should fall back to id when name is not present', () => {
      const result = service.filterItems(mockItems, 'item5');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item5');
    });

    it('should handle partial matches', () => {
      const result = service.filterItems(mockItems, 'prod');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('production-api');
    });
  });

  describe('search state management', () => {
    it('should set and retrieve search state correctly', () => {
      const context = { groupType: 'endpoints', groupId: 'group1' };
      service.setSearchTerm('test', context);

      const state = service.getCurrentState();
      expect(state.searchTerm).toBe('test');
      expect(state.isActive).toBe(true);
      expect(state.context).toEqual(context);
    });

    it('should clear search correctly', () => {
      service.setSearchTerm('test');
      service.clearSearch();

      const state = service.getCurrentState();
      expect(state.searchTerm).toBe('');
      expect(state.isActive).toBe(false);
    });

    it('should emit search state changes', (done) => {
      service.searchState$.subscribe(state => {
        if (state.searchTerm === 'new-term') {
          expect(state.isActive).toBe(true);
          done();
        }
      });

      service.setSearchTerm('new-term');
    });

    it('should preserve context when clearing search', () => {
      const context = { groupType: 'schemas', resourceType: 'messages' };
      service.setSearchTerm('test', context);
      service.clearSearch();

      const state = service.getCurrentState();
      expect(state.context).toEqual(context);
    });

    it('should update context independently', () => {
      service.setSearchTerm('test');
      const newContext = { groupType: 'endpoints', groupId: 'new-group' };
      service.setSearchContext(newContext);

      const state = service.getCurrentState();
      expect(state.searchTerm).toBe('test');
      expect(state.context).toEqual(newContext);
    });
  });

  describe('xRegistry compliance examples', () => {
    it('should generate filters matching xRegistry spec examples', () => {
      // Examples from the xRegistry specification

      // Basic name search with wildcard
      expect(service.generateNameFilter('myendpoint')).toBe('name=myendpoint*');

      // Attribute search with contains pattern
      expect(service.generateAttributeFilter('description', 'cool', '=', true)).toBe('description=*cool*');

      // Version search
      expect(service.generateAttributeFilter('versionid', '1.0')).toBe('versionid=1.0');

      // Boolean attribute search
      expect(service.generateAttributeFilter('readonly', 'true')).toBe('readonly=true');

      // Complex filter combination
      const filters = [
        service.generateNameFilter('myendpoint'),
        service.generateAttributeFilter('description', 'cool', '=', true)
      ];
      expect(service.combineFiltersAnd(filters)).toBe('name=myendpoint*,description=*cool*');
    });

    it('should handle nested attribute paths (for future extensions)', () => {
      // These would be used for nested object filtering like labels.stage=dev
      expect(service.generateAttributeFilter('labels.stage', 'dev')).toBe('labels.stage=dev');
      expect(service.generateAttributeFilter('meta.readonly', 'true')).toBe('meta.readonly=true');
    });
  });
});
