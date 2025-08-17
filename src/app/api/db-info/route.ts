import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';

export async function GET(request: NextRequest) {
  try {
    // Get all tables in the database
    const tables = await query<any>(`
      SELECT TABLE_NAME, TABLE_COMMENT 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);
    
    // Check specifically for photo/diary related tables
    const photoDiaryTables = tables.filter((table: any) => 
      table.TABLE_NAME.toLowerCase().includes('photo') || 
      table.TABLE_NAME.toLowerCase().includes('diary') ||
      table.TABLE_NAME.toLowerCase().includes('nikki') ||
      table.TABLE_NAME.toLowerCase().includes('image')
    );
    
    // Get columns for photo diary related tables if they exist
    let tableStructures: any = {};
    for (const table of photoDiaryTables) {
      const columns = await query<any>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [table.TABLE_NAME]);
      
      tableStructures[table.TABLE_NAME] = columns;
    }
    
    // Also check for girl_image_urls table structure
    const girlImageColumns = await query<any>(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'girl_image_urls'
      ORDER BY ORDINAL_POSITION
    `);
    
    return NextResponse.json({
      allTables: tables.map((t: any) => t.TABLE_NAME),
      photoDiaryTables: photoDiaryTables,
      tableStructures: tableStructures,
      girlImageUrlsStructure: girlImageColumns
    });
    
  } catch (error) {
    console.error('Error fetching database info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database info', details: error },
      { status: 500 }
    );
  }
}