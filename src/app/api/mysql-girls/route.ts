import { NextResponse } from 'next/server'
import { fetchMySQLGirls, getTotalGirlsCount } from '@/lib/mysql/girls'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const area = searchParams.get('area') || null
    const ageMin = parseInt(searchParams.get('ageMin') || '18')
    const ageMax = parseInt(searchParams.get('ageMax') || '50')

    const [girls, total] = await Promise.all([
      fetchMySQLGirls(limit, offset, area, ageMin, ageMax),
      getTotalGirlsCount(area, ageMin, ageMax)
    ])
    
    return NextResponse.json({
      girls,
      total,
      limit,
      offset,
      success: true
    })
  } catch (error: any) {
    console.error('Error fetching MySQL girls:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch girls from database',
        details: error.message,
        code: error.code 
      },
      { status: 500 }
    )
  }
}