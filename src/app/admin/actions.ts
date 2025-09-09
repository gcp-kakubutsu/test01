'use server'

import { getAdminFirestore } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

interface AddGirlData {
  uid: string
  username: string
  email: string
  birthDate: string
  location?: string
  bio?: string
  interests?: string[]
  profilePhotoUrl?: string
}

export async function addGirlToFirestore(data: AddGirlData) {
  try {
    const db = getAdminFirestore()
    const birthDateObj = new Date(data.birthDate)
    const currentYear = new Date().getFullYear()
    const birthYear = birthDateObj.getFullYear()
    const age = currentYear - birthYear

    // payment_uid生成（ユニークチェック付き）
    const gen = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let r = ''
      for (let i = 0; i < 16; i++) r += chars[Math.floor(Math.random() * chars.length)]
      return r
    }
    async function generateUniquePaymentUid(): Promise<string> {
      for (let i = 1; i <= 10; i++) {
        const candidate = gen()
        const snap = await db.collection('users').where('payment_uid', '==', candidate).limit(1).get()
        if (snap.empty) return candidate
        await new Promise(r => setTimeout(r, 100 * i))
      }
      throw new Error('payment_uidのユニーク生成に失敗しました（admin/actions）')
    }
    const paymentUid = await generateUniquePaymentUid()

    await db.collection('users').doc(data.uid).set({
      uid: data.uid,
      username: data.username,
      email: data.email,
      birthDate: data.birthDate,
      gender: 'female',
      location: data.location || '',
      bio: data.bio || '',
      interests: data.interests || [],
      profilePhotoUrl: data.profilePhotoUrl || '',
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

    return { success: true }
  } catch (error) {
    console.error('Error adding girl to Firestore:', error)
    throw new Error('Failed to add girl to database')
  }
}

export async function verifyApiPassword(password: string): Promise<boolean> {
  const API_PASSWORD = process.env.API_REGISTER_PASSWORD
  
  if (!API_PASSWORD) {
    console.error('API_REGISTER_PASSWORD environment variable is not set')
    return false
  }
  
  return password === API_PASSWORD
}