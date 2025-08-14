// Performance monitoring utility for geocoding operations
interface PerformanceMetrics {
  apiCalls: number;
  cacheHits: number;
  averageResponseTime: number;
  totalResponseTime: number;
  errors: number;
  timeouts: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    apiCalls: 0,
    cacheHits: 0,
    averageResponseTime: 0,
    totalResponseTime: 0,
    errors: 0,
    timeouts: 0,
  };

  private responseTimes: number[] = [];
  private readonly MAX_SAMPLES = 100;

  recordApiCall(responseTime: number, cached: boolean = false, error: boolean = false, timeout: boolean = false): void {
    if (cached) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.apiCalls++;
    }

    if (error) {
      this.metrics.errors++;
    }

    if (timeout) {
      this.metrics.timeouts++;
    }

    // Track response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.MAX_SAMPLES) {
      this.responseTimes.shift();
    }

    // Update average
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getCacheHitRate(): number {
    const total = this.metrics.apiCalls + this.metrics.cacheHits;
    return total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
  }

  logPerformance(): void {
    const cacheHitRate = this.getCacheHitRate();
    console.log('=== Geocoding Performance Metrics ===');
    console.log(`API Calls: ${this.metrics.apiCalls}`);
    console.log(`Cache Hits: ${this.metrics.cacheHits}`);
    console.log(`Cache Hit Rate: ${cacheHitRate.toFixed(2)}%`);
    console.log(`Average Response Time: ${this.metrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`Errors: ${this.metrics.errors}`);
    console.log(`Timeouts: ${this.metrics.timeouts}`);
    console.log('=====================================');
  }

  reset(): void {
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      errors: 0,
      timeouts: 0,
    };
    this.responseTimes = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-log performance every 5 minutes in development
if (process.env.NODE_ENV === 'development') {
  if (typeof window !== 'undefined') {
    setInterval(() => {
      performanceMonitor.logPerformance();
    }, 5 * 60 * 1000);
  }
}