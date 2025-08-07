import { NextResponse } from 'next/server'
import { query } from '@/lib/mysql/db'

export async function GET() {
  try {
    // Get all prefectures from database
    const prefectures = await query<{
      id: number
      name: string
    }>(
      `SELECT id, name 
       FROM area_prefectures 
       ORDER BY sort_order, name`
    )
    
    return NextResponse.json({
      prefectures: prefectures.map(p => p.name),
      success: true
    })
    
  } catch (error) {
    console.error('Error fetching prefectures:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prefectures' },
      { status: 500 }
    )
  }
}