/**
 * Simple LRU (Least Recently Used) Cache implementation
 * This class maintains a cache with a maximum size, removing the least recently used
 * items when the cache exceeds its capacity.
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  /**
   * Creates a new LRU cache with the specified maximum size
   * @param maxSize The maximum number of items to store in the cache
   */
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Retrieves a value from the cache and marks it as recently used
   * @param key The key to look up
   * @returns The cached value or undefined if not found
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Access the item and refresh its position in the cache
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Adds or updates a value in the cache
   * @param key The key to set
   * @param value The value to cache
   */
  set(key: K, value: V): void {
    // If the key exists, delete it first to refresh its position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }    // If at max capacity, remove the oldest item (first in map)
    else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    // Add the new item at the end (most recently used position)
    this.cache.set(key, value);
  }

  /**
   * Clears all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Returns the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Checks if a key exists in the cache
   * @param key The key to check
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Removes an item from the cache if it exists
   * @param key The key to remove
   * @returns True if the item was found and removed, false otherwise
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }
}
