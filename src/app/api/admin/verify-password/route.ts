import { NextRequest, NextResponse } from 'next/server'
import { verifyApiPassword } from '@/app/admin/actions'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    if (!password) {
      return NextResponse.json(
        { valid: false, error: 'Password is required' },
        { status: 400 }
      )
    }

    const isValid = await verifyApiPassword(password)
    
    return NextResponse.json({ valid: isValid })
  } catch (error) {
    console.error('Password verification error:', error)
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}