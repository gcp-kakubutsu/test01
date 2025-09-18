import mysql from 'mysql2/promise';
import { LRUCache } from 'lru-cache';
import { ensurePerformanceIndexes } from './index-ensurer';

// Connection pool with optimized settings
let pool: mysql.Pool | null = null;

// In-memory cache for frequently accessed data
const cache = new LRUCache<string, any>({
  max: 500, // Maximum 500 items
  ttl: 1000 * 60 * 5, // 5 minutes TTL
  updateAgeOnGet: true,
  updateAgeOnHas: true,
});

// Performance monitoring
interface QueryMetrics {
  query: string;
  duration: number;
  cached: boolean;
  timestamp: number;
}

const queryMetrics: QueryMetrics[] = [];

export async function getOptimizedDb() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306'),
      
      // Optimized connection pool settings
      waitForConnections: true,
      connectionLimit: 50, // Increased from 10
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 10000,
      
      // Performance optimizations
      multipleStatements: true,
      dateStrings: true,
      decimalNumbers: true,
      typeCast: true,
      compress: true, // Enable compression
      
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Pre-warm connections
    await warmUpConnections();
    await ensurePerformanceIndexes(pool);
  }
  return pool;
}

// Pre-warm connection pool
async function warmUpConnections() {
  const warmUpPromises = [];
  for (let i = 0; i < 5; i++) {
    warmUpPromises.push(
      pool?.getConnection().then(conn => {
        conn.release();
      })
    );
  }
  await Promise.all(warmUpPromises);
  console.log('Connection pool warmed up');
}

// Cached query with performance monitoring
export async function cachedQuery<T = any>(
  sql: string, 
  params?: any[], 
  cacheKey?: string,
  cacheTTL?: number
): Promise<T[]> {
  const startTime = performance.now();
  
  // Check cache first if cache key provided
  if (cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached) {
      const duration = performance.now() - startTime;
      recordMetrics(sql, duration, true);
      const resultCount = Array.isArray(cached) ? cached.length : 0;
      console.log(`Cache hit for ${cacheKey}: ${duration.toFixed(2)}ms (${resultCount} results)`);
      return cached as T[];
    }
  }
  
  const db = await getOptimizedDb();
  
  try {
    let result: T[];
    
    // Use prepared statements for better performance
    if (params && params.length > 0) {
      const [rows] = await db.execute(sql, params);
      result = rows as T[];
    } else {
      const [rows] = await db.query(sql);
      result = rows as T[];
    }
    
    // Store in cache if cache key provided
    if (cacheKey) {
      cache.set(cacheKey, result, { ttl: cacheTTL });
    }
    
    const duration = performance.now() - startTime;
    recordMetrics(sql, duration, false);
    const resultCount = Array.isArray(result) ? result.length : 0;
    console.log(`Query executed in ${duration.toFixed(2)}ms (${resultCount} results)`);
    
    return result;
  } catch (error) {
    console.error('Optimized query error:', error);
    throw error;
  }
}

// Batch query execution for multiple queries
export async function batchQueries<T = any>(queries: Array<{
  sql: string;
  params?: any[];
  cacheKey?: string;
}>): Promise<T[][]> {
  const startTime = performance.now();
  
  const promises = queries.map(q => 
    cachedQuery<T>(q.sql, q.params, q.cacheKey)
  );
  
  const results = await Promise.all(promises);
  
  const duration = performance.now() - startTime;
  console.log(`Batch queries executed in ${duration.toFixed(2)}ms`);
  
  return results;
}

// Clear cache for debugging
export function clearCache(pattern?: string) {
  if (pattern) {
    // Clear specific cache entries matching pattern
    const keys = cache.keys();
    for (const key of keys) {
      if (key.includes(pattern)) {
        cache.delete(key);
        console.log(`🗑️ Cleared cache for: ${key}`);
      }
    }
  } else {
    // Clear all cache
    cache.clear();
    console.log('🗑️ Cleared all cache');
  }
}

// Record query metrics for monitoring
function recordMetrics(query: string, duration: number, cached: boolean) {
  queryMetrics.push({
    query: query.substring(0, 100), // Store first 100 chars
    duration,
    cached,
    timestamp: Date.now()
  });
  
  // Keep only last 100 metrics
  if (queryMetrics.length > 100) {
    queryMetrics.shift();
  }
}

// Get performance metrics
export function getPerformanceMetrics() {
  const avgDuration = queryMetrics.reduce((acc, m) => acc + m.duration, 0) / queryMetrics.length;
  const cacheHitRate = queryMetrics.filter(m => m.cached).length / queryMetrics.length;
  
  return {
    averageQueryTime: avgDuration,
    cacheHitRate: cacheHitRate * 100,
    totalQueries: queryMetrics.length,
    recentQueries: queryMetrics.slice(-10)
  };
}

export function hasCacheKey(key: string): boolean {
  return cache.has(key);
}

// Optimized query with streaming for large datasets
export async function streamQuery<T = any>(
  sql: string,
  params: any[] = [],
  onRow: (row: T) => void
): Promise<void> {
  const db = await getOptimizedDb();
  const connection = await db.getConnection();
  
  try {
    const query = connection.query(sql, params);
    const stream = (query as any).stream();
    
    await new Promise((resolve, reject) => {
      stream.on('data', (row: T) => onRow(row));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  } finally {
    connection.release();
  }
}

const dbOptimized = {
  cachedQuery,
  batchQueries,
  getPerformanceMetrics,
  clearCache,
  streamQuery
};

export default dbOptimized;
