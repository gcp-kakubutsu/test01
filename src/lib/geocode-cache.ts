// High-performance LRU Cache for geocoding results
class LRUCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 1000, ttlMinutes: number = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // Check if item has expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: K, value: V): void {
    // Delete key if it exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Check size limit
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Create a singleton instance for the geocode cache
// Using a larger cache size for production and 2-hour TTL for better performance
export const geocodeCache = new LRUCache<string, any>(5000, 120);

// Helper function to create cache key from coordinates
export function createCacheKey(lat: number, lng: number, type: 'reverse' | 'forward' = 'reverse'): string {
  // Round to 4 decimal places (approximately 11 meters precision)
  // This reduces cache misses from minor GPS variations
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;
  return `${type}:${roundedLat}:${roundedLng}`;
}

// Helper function to create cache key for forward geocoding
export function createAddressCacheKey(address: string): string {
  // Normalize address for better cache hits
  const normalized = address.trim().toLowerCase().replace(/\s+/g, ' ');
  return `forward:${normalized}`;
}

// Pre-populated cache for major Japanese cities
const MAJOR_LOCATIONS = {
  '35.6762:139.6503': '東京都',
  '35.6895:139.6917': '東京都新宿区',
  '35.6581:139.7014': '東京都渋谷区',
  '34.6937:135.5023': '大阪府大阪市',
  '35.0116:135.7681': '京都府京都市',
  '35.4478:139.6425': '神奈川県横浜市',
  '35.1802:136.9066': '愛知県名古屋市',
  '43.0642:141.3469': '北海道札幌市',
  '33.6064:130.4181': '福岡県福岡市',
  '34.6913:135.1830': '兵庫県神戸市',
  '38.2682:140.8694': '宮城県仙台市',
  '34.3963:132.4596': '広島県広島市',
  '35.8569:139.6489': '埼玉県さいたま市',
  '35.6074:140.1233': '千葉県千葉市',
};

// Pre-populate cache with major locations
export function initializeCache(): void {
  Object.entries(MAJOR_LOCATIONS).forEach(([coords, address]) => {
    const [lat, lng] = coords.split(':').map(Number);
    const key = createCacheKey(lat, lng);
    geocodeCache.set(key, { address, cached: true });
  });
}

// Initialize cache on module load
initializeCache();