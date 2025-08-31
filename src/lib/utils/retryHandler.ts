/**
 * Retry Handler Utilities
 * Provides sophisticated retry logic for subscription operations
 */

import { 
  SubscriptionError, 
  NetworkError, 
  analyzeError, 
  logSubscriptionError 
} from '@/lib/errors/subscriptionErrors';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // in milliseconds
  maxDelay: number;
  exponentialBackoff: boolean;
  jitter: boolean;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: SubscriptionError) => void;
  onMaxAttemptsReached?: (error: SubscriptionError) => void;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBackoff: true,
  jitter: true,
  retryableErrors: [
    'NETWORK_TIMEOUT',
    'CONNECTION_FAILED',
    'SERVER_ERROR',
    'PAYMENT_TIMEOUT',
    'SERVICE_UNAVAILABLE'
  ],
};

export class RetryHandler {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute an operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    context?: string,
    userId?: string
  ): Promise<T> {
    let lastError: SubscriptionError;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = analyzeError(error);
        
        // Log the error
        logSubscriptionError(lastError, context, userId);
        
        // Check if error is retryable
        if (!this.isRetryable(lastError)) {
          throw lastError;
        }
        
        // If this was the last attempt, don't retry
        if (attempt === this.config.maxAttempts) {
          if (this.config.onMaxAttemptsReached) {
            this.config.onMaxAttemptsReached(lastError);
          }
          throw lastError;
        }
        
        // Call retry callback if provided
        if (this.config.onRetry) {
          this.config.onRetry(attempt, lastError);
        }
        
        // Wait before retrying
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: SubscriptionError): boolean {
    // Network errors are generally retryable
    if (error instanceof NetworkError) {
      return true;
    }
    
    // Check against configured retryable error codes
    if (this.config.retryableErrors?.includes(error.code)) {
      return true;
    }
    
    // Check the error's retryable property
    return error.retryable;
  }

  /**
   * Calculate delay for next retry attempt
   */
  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay;
    
    if (this.config.exponentialBackoff) {
      delay = Math.min(
        delay * Math.pow(2, attempt - 1),
        this.config.maxDelay
      );
    }
    
    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      delay = delay + (Math.random() * delay * 0.1);
    }
    
    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Pre-configured retry handlers for different scenarios
export const paymentRetryHandler = new RetryHandler({
  maxAttempts: 2,
  baseDelay: 2000,
  exponentialBackoff: false,
  retryableErrors: [
    'PAYMENT_TIMEOUT',
    'NETWORK_TIMEOUT',
    'CONNECTION_FAILED',
    'SERVER_ERROR'
  ]
});

export const networkRetryHandler = new RetryHandler({
  maxAttempts: 3,
  baseDelay: 1000,
  exponentialBackoff: true,
  jitter: true,
});

export const subscriptionDataRetryHandler = new RetryHandler({
  maxAttempts: 5,
  baseDelay: 500,
  maxDelay: 5000,
  exponentialBackoff: true,
  jitter: true,
});

// Utility function for simple retry operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryConfig> = {},
  context?: string,
  userId?: string
): Promise<T> {
  const handler = new RetryHandler(options);
  return handler.execute(operation, context, userId);
}

// React hook for handling retries in components
import { useState, useCallback, useRef } from 'react';

export interface UseRetryReturn<T> {
  execute: (operation: () => Promise<T>) => Promise<T>;
  isRetrying: boolean;
  retryCount: number;
  lastError: SubscriptionError | null;
  reset: () => void;
}

export function useRetry<T>(
  config: Partial<RetryConfig> = {},
  context?: string
): UseRetryReturn<T> {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<SubscriptionError | null>(null);
  
  const handlerRef = useRef(new RetryHandler({
    ...config,
    onRetry: (attempt, error) => {
      setRetryCount(attempt);
      setLastError(error);
      config.onRetry?.(attempt, error);
    },
    onMaxAttemptsReached: (error) => {
      setIsRetrying(false);
      setLastError(error);
      config.onMaxAttemptsReached?.(error);
    }
  }));

  const execute = useCallback(async (operation: () => Promise<T>) => {
    setIsRetrying(true);
    setRetryCount(0);
    setLastError(null);
    
    try {
      const result = await handlerRef.current.execute(operation, context);
      setIsRetrying(false);
      return result;
    } catch (error) {
      setIsRetrying(false);
      throw error;
    }
  }, [context]);

  const reset = useCallback(() => {
    setIsRetrying(false);
    setRetryCount(0);
    setLastError(null);
  }, []);

  return {
    execute,
    isRetrying,
    retryCount,
    lastError,
    reset,
  };
}

// Circuit breaker pattern for preventing cascade failures
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 30000, // 30 seconds
    private recoveryAttempts = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new SubscriptionError(
          'Circuit breaker is open',
          'CIRCUIT_BREAKER_OPEN',
          'service',
          'medium',
          'サービスが一時的に利用できません。しばらく時間を置いてお試しください。',
          true
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
  }
}

// Global circuit breaker for subscription services
export const subscriptionCircuitBreaker = new CircuitBreaker(3, 60000, 2);