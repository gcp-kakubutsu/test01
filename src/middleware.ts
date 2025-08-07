import { NextRequest, NextResponse } from 'next/server'
import { apiRateLimit, strictRateLimit, uploadRateLimit } from '@/lib/rate-limit'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // Apply rate limiting based on the path
  let rateLimitResult
  
  // Strict rate limiting for auth endpoints
  if (path.startsWith('/api/auth/') || path === '/api/login' || path === '/api/signup') {
    rateLimitResult = await strictRateLimit(request, `auth-${path}`)
  }
  // Upload rate limiting for file uploads
  else if (path.startsWith('/api/upload') || path.includes('upload')) {
    rateLimitResult = await uploadRateLimit(request, `upload-${path}`)
  }
  // Admin endpoints - stricter limits
  else if (path.startsWith('/api/admin/')) {
    rateLimitResult = await strictRateLimit(request, `admin-${path}`)
  }
  // General API rate limiting
  else if (path.startsWith('/api/')) {
    rateLimitResult = await apiRateLimit(request, `api-${path}`)
  }
  
  // If rate limit exceeded, return 429 Too Many Requests
  if (rateLimitResult && !rateLimitResult.success) {
    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        retryAfter: 60 // seconds
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'Retry-After': '60'
        }
      }
    )
  }
  
  // Add rate limit headers to response
  const response = NextResponse.next()
  
  if (rateLimitResult) {
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
  }
  
  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}