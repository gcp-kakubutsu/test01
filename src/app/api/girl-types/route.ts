import { NextResponse } from 'next/server';
import { getOptimizedDb } from '@/lib/mysql/db-optimized';

export async function GET() {
  try {
    const db = await getOptimizedDb();
    
    // Fetch all girl types grouped by class_id
    const [girlTypes] = await db.execute(`
      SELECT 
        id,
        name,
        class_id,
        alphabet
      FROM girl_types
      ORDER BY class_id, id
    `);
    
    // Group types by class_id
    const personalityTypes = (girlTypes as any[]).filter(type => type.class_id === 1);
    const physicalTypes = (girlTypes as any[]).filter(type => type.class_id === 2);
    const playTypes = (girlTypes as any[]).filter(type => type.class_id === 3);
    
    return NextResponse.json({
      personalityTypes,
      physicalTypes,
      playTypes,
      allTypes: girlTypes
    });
  } catch (error) {
    console.error('Error fetching girl types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch girl types' },
      { status: 500 }
    );
  }
}