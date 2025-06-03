'use server'

import { getAdminFirestore } from '@/lib/firebase/admin'

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
    })

    return { success: true }
  } catch (error) {
    console.error('Error adding girl to Firestore:', error)
    throw new Error('Failed to add girl to database')
  }
}

export async function verifyApiPassword(password: string): Promise<boolean> {
  const API_PASSWORD = process.env.API_REGISTER_PASSWORD || 'nukune-api-2024'
  return password === API_PASSWORD
}