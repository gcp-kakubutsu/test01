import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore, isAdminInitialized } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if Admin SDK is initialized
    if (!isAdminInitialized()) {
      console.warn('Firebase Admin SDK not initialized, using client-side deletion fallback')
      
      // Return a response that tells the client to handle deletion
      return NextResponse.json({
        success: false,
        error: 'admin-not-initialized',
        message: 'Please delete account from client side',
      })
    }

    try {
      // Delete from Firestore first
      const db = getAdminFirestore()
      const userRef = db.collection('users').doc(userId)
      
      // Delete user document
      await userRef.delete()
      console.log('User deleted from Firestore:', userId)
      
      // Delete from Firebase Auth
      const auth = getAdminAuth()
      await auth.deleteUser(userId)
      console.log('User deleted from Firebase Auth:', userId)
      
      return NextResponse.json({ success: true })
    } catch (error: any) {
      console.error('Error deleting account with admin SDK:', error)
      
      // If admin deletion fails, tell client to handle it
      return NextResponse.json({
        success: false,
        error: 'admin-deletion-failed',
        message: error.message || 'Admin deletion failed, please try client-side deletion',
      })
    }
  } catch (error: any) {
    console.error('Error in delete account API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete account' },
      { status: 500 }
    )
  }
}