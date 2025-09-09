import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin'
import { withAdminAuth } from '@/middleware/admin'
import { FieldValue } from 'firebase-admin/firestore'

async function handler(request: NextRequest) {
  try {
    const data = await request.json()
    const { email, password, username, birthDate, location, bio, interests, profilePhotoUrl } = data

    if (!email || !password || !username || !birthDate) {
      return NextResponse.json(
        { success: false, error: 'Required fields are missing' },
        { status: 400 }
      )
    }

    const auth = getAdminAuth()
    const db = getAdminFirestore()

    // Create user with Firebase Admin SDK
    let userRecord
    try {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: username,
      })
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        return NextResponse.json(
          { success: false, error: 'このメールアドレスは既に使用されています' },
          { status: 400 }
        )
      }
      throw error
    }

    // Calculate age
    const birthDateObj = new Date(birthDate)
    const currentYear = new Date().getFullYear()
    const birthYear = birthDateObj.getFullYear()
    const age = currentYear - birthYear

    // Generate unique payment_uid
    const generatePaymentUid = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let r = ''
      for (let i = 0; i < 16; i++) r += chars[Math.floor(Math.random() * chars.length)]
      return r
    }
    async function generateUniquePaymentUid(): Promise<string> {
      for (let i = 1; i <= 10; i++) {
        const candidate = generatePaymentUid()
        const snap = await db.collection('users').where('payment_uid', '==', candidate).limit(1).get()
        if (snap.empty) return candidate
        await new Promise(r => setTimeout(r, 100 * i))
      }
      throw new Error('payment_uidのユニーク生成に失敗しました（create-girl）')
    }
    const paymentUid = await generateUniquePaymentUid()

    // Add user to Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      username,
      email,
      birthDate,
      gender: 'female',
      location: location || '',
      bio: bio || '',
      interests: interests || [],
      profilePhotoUrl: profilePhotoUrl || '',
      age,
      kinks: [],
      isGirl: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // 決済用UID
      payment_uid: paymentUid,
      payment_uid_created_at: FieldValue.serverTimestamp(),
      payment_uid_updated_at: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
      message: '女性ユーザーが正常に登録されました',
    })
  } catch (error: any) {
    console.error('Error creating girl user:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'ユーザー作成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return withAdminAuth(request, handler)
}