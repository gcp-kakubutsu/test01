import { NextResponse } from 'next/server';
import { getOptimizedDb } from '@/lib/mysql/db-optimized';

export async function POST(request: Request) {
  try {
    const { girlTypeIds, location, ageMin, ageMax } = await request.json();
    
    const db = await getOptimizedDb();
    
    // Build the query dynamically based on provided filters
    let query = `
      SELECT DISTINCT
        g.id,
        g.name,
        g.age,
        g.height,
        g.bust_size,
        g.waist_size,
        g.hip_size,
        g.image_url,
        s.name as shop_name,
        s.location,
        s.opening_hours,
        s.shop_url,
        GROUP_CONCAT(DISTINCT gt.name) as girl_types
      FROM girls g
      INNER JOIN shops s ON g.shop_id = s.id
      LEFT JOIN girl_girl_type ggt ON g.id = ggt.girl_id
      LEFT JOIN girl_types gt ON ggt.girl_type_id = gt.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    // Filter by girl type IDs if provided
    if (girlTypeIds && girlTypeIds.length > 0) {
      query += ` AND ggt.girl_type_id IN (${girlTypeIds.map(() => '?').join(',')})`;
      params.push(...girlTypeIds);
    }
    
    // Filter by location if provided
    if (location) {
      query += ` AND s.location LIKE ?`;
      params.push(`%${location}%`);
    }
    
    // Filter by age range if provided
    if (ageMin) {
      query += ` AND g.age >= ?`;
      params.push(ageMin);
    }
    
    if (ageMax) {
      query += ` AND g.age <= ?`;
      params.push(ageMax);
    }
    
    query += ` GROUP BY g.id, s.id ORDER BY g.id DESC LIMIT 50`;
    
    const [girls] = await db.execute(query, params);
    
    return NextResponse.json({
      success: true,
      girls: girls,
      count: (girls as any[]).length
    });
    
  } catch (error) {
    console.error('Error searching girls by preferences:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to search girls',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}