// Simple in-memory cache for MySQL query results
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class QueryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 60000; // 1 minute default TTL
  
  // Set a cache entry
  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    });
  }
  
  // Get a cache entry if it exists and is not expired
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  // Clear expired entries
  clearExpired(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  // Clear all cache
  clear(): void {
    this.cache.clear();
  }
  
  // Get cache size
  size(): number {
    return this.cache.size;
  }
}

// Create singleton instance
export const queryCache = new QueryCache();

// Clear expired entries every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    queryCache.clearExpired();
  }, 5 * 60 * 1000);
}