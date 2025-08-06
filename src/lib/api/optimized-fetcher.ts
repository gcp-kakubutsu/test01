/**
 * Optimized data fetcher with performance enhancements
 */

interface FetchOptions {
  cache?: RequestCache;
  revalidate?: number;
  signal?: AbortSignal;
}

class OptimizedFetcher {
  private pendingRequests = new Map<string, Promise<any>>();
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 60000; // 1 minute default cache
  
  /**
   * Fetch with deduplication and caching
   */
  async fetch<T = any>(url: string, options?: FetchOptions): Promise<T> {
    const cacheKey = url;
    
    // Check in-memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`📦 Cache hit for ${url}`);
      return cached.data;
    }
    
    // Check for pending request to avoid duplicates
    if (this.pendingRequests.has(cacheKey)) {
      console.log(`⏳ Reusing pending request for ${url}`);
      return this.pendingRequests.get(cacheKey);
    }
    
    // Create new request
    const requestPromise = this.performFetch<T>(url, options);
    this.pendingRequests.set(cacheKey, requestPromise);
    
    try {
      const data = await requestPromise;
      
      // Store in cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }
  
  private async performFetch<T>(url: string, options?: FetchOptions): Promise<T> {
    const startTime = performance.now();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      // Next.js specific optimizations
      next: {
        revalidate: options?.revalidate || 60
      }
    } as RequestInit);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const duration = performance.now() - startTime;
    
    console.log(`✅ Fetched ${url} in ${duration.toFixed(2)}ms`);
    
    return data;
  }
  
  /**
   * Prefetch data for instant loading
   */
  prefetch(url: string): void {
    if (!this.cache.has(url) && !this.pendingRequests.has(url)) {
      this.fetch(url).catch(console.error);
    }
  }
  
  /**
   * Clear cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      Array.from(this.cache.keys())
        .filter(key => key.includes(pattern))
        .forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }
  
  /**
   * Batch fetch multiple URLs
   */
  async batchFetch<T = any>(urls: string[]): Promise<T[]> {
    const promises = urls.map(url => this.fetch<T>(url));
    return Promise.all(promises);
  }
}

// Singleton instance
const fetcher = new OptimizedFetcher();

// Export convenience functions
export async function fetchGirlsFast(
  limit = 200,
  offset = 0,
  area?: string | null,
  ageMin = 18,
  ageMax = 50
) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    ageMin: ageMin.toString(),
    ageMax: ageMax.toString(),
  });
  
  if (area && area !== 'all') {
    params.append('area', area);
  }
  
  const url = `/api/mysql-girls-fast?${params}`;
  return fetcher.fetch(url);
}

export function prefetchGirls(
  limit = 200,
  offset = 0,
  area?: string | null
) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  
  if (area && area !== 'all') {
    params.append('area', area);
  }
  
  const url = `/api/mysql-girls-fast?${params}`;
  fetcher.prefetch(url);
}

export function clearGirlsCache() {
  fetcher.clearCache('/api/mysql-girls');
}

export default fetcher;