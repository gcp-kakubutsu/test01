import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || process.env.API_REGISTER_PASSWORD

interface AdminSession {
  userId: string
  role: 'admin'
  exp: number
}

/**
 * Verify admin JWT token
 */
export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not configured')
    return null
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminSession
    
    // Check if token is expired
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return null
    }
    
    // Verify admin role
    if (decoded.role !== 'admin') {
      return null
    }
    
    return decoded
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

/**
 * Create admin JWT token
 */
export function createAdminToken(userId: string): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  const payload: AdminSession = {
    userId,
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  }
  
  return jwt.sign(payload, JWT_SECRET)
}

/**
 * Middleware to protect admin routes
 */
export async function requireAdminAuth(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin-token')?.value
  
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
  
  // Add admin session to request headers for downstream use
  const response = NextResponse.next()
  response.headers.set('x-admin-id', session.userId)
  response.headers.set('x-admin-role', session.role)
  
  return response
}

/**
 * Verify Firebase ID token for admin users
 */
export async function verifyAdminFirebaseToken(idToken: string): Promise<boolean> {
  try {
    const auth = getAdminAuth()
    const decodedToken = await auth.verifyIdToken(idToken)
    
    // Check custom claims for admin role
    if (decodedToken.admin === true) {
      return true
    }
    
    // Check if user email is in admin whitelist
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
    if (decodedToken.email && adminEmails.includes(decodedToken.email)) {
      // Set admin custom claim for future requests
      await auth.setCustomUserClaims(decodedToken.uid, { admin: true })
      return true
    }
    
    return false
  } catch (error) {
    console.error('Firebase token verification failed:', error)
    return false
  }
}