import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/auth/admin-auth'

/**
 * Middleware wrapper for admin API routes
 */
export async function withAdminAuth(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // Check for admin token in cookies or Authorization header
  const cookieToken = request.cookies.get('admin-token')?.value
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  
  const token = cookieToken || bearerToken
  
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized: No admin token provided' },
      { status: 401 }
    )
  }
  
  const session = await verifyAdminToken(token)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or expired token' },
      { status: 401 }
    )
  }
  
  // Add admin session to request for use in handler
  const modifiedRequest = request.clone()
  modifiedRequest.headers.set('x-admin-id', session.userId)
  modifiedRequest.headers.set('x-admin-role', session.role)
  
  // Call the actual handler
  return handler(modifiedRequest as NextRequest)
}