import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, isAdminInitialized } from '@/lib/firebase/admin'
import { withAdminAuth } from '@/middleware/admin'

async function handler(request: NextRequest) {
  try {
    const { userId, profilePhotoUrl } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if Admin SDK is initialized
    if (!isAdminInitialized()) {
      console.warn('Firebase Admin SDK not initialized')
      return NextResponse.json({
        success: false,
        error: 'admin-not-initialized',
        message: 'Firebase Admin SDK is not initialized',
      })
    }

    const db = getAdminFirestore()

    try {
      // Update user document with photo URL
      const userRef = db.collection('users').doc(userId)
      await userRef.update({
        profilePhotoUrl,
        updatedAt: new Date().toISOString(),
      })
      
      console.log('User updated with photo URL:', userId)
      
      return NextResponse.json({ 
        success: true,
        message: 'User updated successfully'
      })
    } catch (error: any) {
      console.error('Error updating user with admin SDK:', error)
      
      return NextResponse.json({
        success: false,
        error: 'update-failed',
        message: error.message || 'Failed to update user',
      })
    }
  } catch (error: any) {
    console.error('Error in admin update user API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}
export async function POST(request: NextRequest) {
  return withAdminAuth(request, handler)
}
