import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';

export async function GET(request: NextRequest) {
  try {
    // Get girl_diaries table structure
    const diaryColumns = await query<any>(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'girl_diaries'
      ORDER BY ORDINAL_POSITION
    `);
    
    // Get girl_diary_image_urls table structure
    const diaryImageColumns = await query<any>(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'girl_diary_image_urls'
      ORDER BY ORDINAL_POSITION
    `);
    
    // Get sample data from girl_diaries
    const sampleDiaries = await query<any>(`
      SELECT * FROM girl_diaries 
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    // Get count of diaries
    const diaryCount = await query<any>(`
      SELECT COUNT(*) as count FROM girl_diaries
    `);
    
    return NextResponse.json({
      girl_diaries_structure: diaryColumns,
      girl_diary_image_urls_structure: diaryImageColumns,
      sample_diaries: sampleDiaries,
      total_diaries: diaryCount[0]?.count || 0
    });
    
  } catch (error) {
    console.error('Error fetching diary structure:', error);
    return NextResponse.json(
      { error: 'Failed to fetch diary structure', details: error },
      { status: 500 }
    );
  }
}