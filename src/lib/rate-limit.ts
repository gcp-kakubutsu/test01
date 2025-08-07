import { LRUCache } from 'lru-cache'
import { NextRequest } from 'next/server'

interface RateLimitOptions {
  interval: number // Time window in milliseconds
  uniqueTokenPerInterval: number // Max number of unique tokens per interval
}

interface RateLimitResult {
  limit: number
  remaining: number
  success: boolean
}

// Create different rate limiters for different endpoints
const rateLimiters = new Map<string, LRUCache<string, number[]>>()

function getRateLimiter(name: string, options: RateLimitOptions): LRUCache<string, number[]> {
  if (!rateLimiters.has(name)) {
    const limiter = new LRUCache<string, number[]>({
      max: options.uniqueTokenPerInterval,
      ttl: options.interval,
    })
    rateLimiters.set(name, limiter)
  }
  return rateLimiters.get(name)!
}

/**
 * Rate limiting function
 * @param request - The incoming request
 * @param limiterName - Name of the rate limiter (e.g., 'api', 'auth', 'upload')
 * @param options - Rate limit configuration
 * @returns Rate limit result with success status and remaining attempts
 */
export async function rateLimit(
  request: NextRequest,
  limiterName: string = 'api',
  options: RateLimitOptions = {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 100, // 100 requests per minute
  }
): Promise<RateLimitResult> {
  const limiter = getRateLimiter(limiterName, options)
  
  // Get identifier from IP address or user ID
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  const identifier = ip
  
  // Get current timestamp
  const now = Date.now()
  
  // Get existing timestamps for this identifier
  const timestamps = limiter.get(identifier) || []
  
  // Filter out old timestamps outside the interval
  const recentTimestamps = timestamps.filter(
    timestamp => now - timestamp < options.interval
  )
  
  // Check if limit exceeded
  if (recentTimestamps.length >= options.uniqueTokenPerInterval) {
    return {
      limit: options.uniqueTokenPerInterval,
      remaining: 0,
      success: false,
    }
  }
  
  // Add current timestamp and update cache
  recentTimestamps.push(now)
  limiter.set(identifier, recentTimestamps)
  
  return {
    limit: options.uniqueTokenPerInterval,
    remaining: options.uniqueTokenPerInterval - recentTimestamps.length,
    success: true,
  }
}

/**
 * Strict rate limiter for sensitive operations
 */
export async function strictRateLimit(
  request: NextRequest,
  limiterName: string = 'auth'
): Promise<RateLimitResult> {
  return rateLimit(request, limiterName, {
    interval: 15 * 60 * 1000, // 15 minutes
    uniqueTokenPerInterval: 5, // 5 attempts per 15 minutes
  })
}

/**
 * Rate limiter for API endpoints
 */
export async function apiRateLimit(
  request: NextRequest,
  limiterName: string = 'api'
): Promise<RateLimitResult> {
  return rateLimit(request, limiterName, {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 60, // 60 requests per minute
  })
}

/**
 * Rate limiter for file uploads
 */
export async function uploadRateLimit(
  request: NextRequest,
  limiterName: string = 'upload'
): Promise<RateLimitResult> {
  return rateLimit(request, limiterName, {
    interval: 60 * 60 * 1000, // 1 hour
    uniqueTokenPerInterval: 20, // 20 uploads per hour
  })
}