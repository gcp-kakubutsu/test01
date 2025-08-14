// Client-side geocode cache using sessionStorage
class ClientGeocodeCache {
  private memoryCache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_KEY_PREFIX = 'nukune_geocode_';
  private readonly TTL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_MEMORY_SIZE = 50;

  constructor() {
    this.memoryCache = new Map();
    this.cleanupOldEntries();
  }

  private createKey(lat: number, lng: number): string {
    // Round to 4 decimal places for cache efficiency
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    return `${roundedLat}:${roundedLng}`;
  }

  get(lat: number, lng: number): any | null {
    const key = this.createKey(lat, lng);
    
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (Date.now() - memoryEntry.timestamp < this.TTL) {
        console.log(`Client cache hit (memory): ${key}`);
        return memoryEntry.data;
      }
      this.memoryCache.delete(key);
    }

    // Check sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = sessionStorage.getItem(this.CACHE_KEY_PREFIX + key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Date.now() - parsed.timestamp < this.TTL) {
            console.log(`Client cache hit (session): ${key}`);
            // Add to memory cache for faster access
            this.setMemory(key, parsed.data);
            return parsed.data;
          }
          // Remove expired entry
          sessionStorage.removeItem(this.CACHE_KEY_PREFIX + key);
        }
      } catch (e) {
        console.error('Error reading from sessionStorage:', e);
      }
    }

    return null;
  }

  set(lat: number, lng: number, data: any): void {
    const key = this.createKey(lat, lng);
    
    // Store in memory cache
    this.setMemory(key, data);

    // Store in sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(
          this.CACHE_KEY_PREFIX + key,
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } catch (e) {
        // Storage might be full, clear old entries
        console.warn('SessionStorage full, clearing old entries');
        this.cleanupOldEntries();
        try {
          sessionStorage.setItem(
            this.CACHE_KEY_PREFIX + key,
            JSON.stringify({ data, timestamp: Date.now() })
          );
        } catch (e2) {
          console.error('Failed to store in sessionStorage:', e2);
        }
      }
    }
  }

  private setMemory(key: string, data: any): void {
    // Limit memory cache size
    if (this.memoryCache.size >= this.MAX_MEMORY_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, { data, timestamp: Date.now() });
  }

  private cleanupOldEntries(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;

    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(this.CACHE_KEY_PREFIX)) {
        try {
          const stored = sessionStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (now - parsed.timestamp > this.TTL) {
              keysToRemove.push(key);
            }
          }
        } catch (e) {
          keysToRemove.push(key!);
        }
      }
    }

    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  }

  clear(): void {
    this.memoryCache.clear();
    
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(this.CACHE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }
  }
}

// Singleton instance
export const clientGeocodeCache = new ClientGeocodeCache();

// Optimized geocode function with client-side caching
export async function fetchGeocode(lat: number, lng: number): Promise<any> {
  // Check client cache first
  const cached = clientGeocodeCache.get(lat, lng);
  if (cached) {
    return cached;
  }

  // Fetch from API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lng }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Geocoding API failed');
    }

    const data = await response.json();
    
    // Cache the result
    if (!data.error) {
      clientGeocodeCache.set(lat, lng, data);
    }

    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('Geocoding request timeout');
      return { error: 'タイムアウトしました', fallback: true };
    }
    
    throw error;
  }
}