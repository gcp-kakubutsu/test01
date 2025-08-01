import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export async function getDb() {
  if (!pool) {
    // Debug: Log database connection info
    console.log('Creating MySQL pool with:', {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const db = await getDb();
  
  try {
    // Use query method instead of execute to avoid parameter binding issues
    if (!params || params.length === 0) {
      const [rows] = await db.query(sql);
      return rows as T[];
    }
    
    // Replace ? placeholders with actual values for query method
    let processedSql = sql;
    let paramIndex = 0;
    
    processedSql = processedSql.replace(/\?/g, () => {
      if (paramIndex < params.length) {
        const value = params[paramIndex++];
        // Escape and format the value
        if (value === null || value === undefined) {
          return 'NULL';
        } else if (typeof value === 'number') {
          return value.toString();
        } else if (typeof value === 'string') {
          // Escape single quotes in strings
          return `'${value.replace(/'/g, "''")}'`;
        } else {
          return `'${value.toString()}'`;
        }
      }
      return '?';
    });
    
    console.log('Processed SQL:', processedSql);
    
    const [rows] = await db.query(processedSql);
    return rows as T[];
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

export async function querySingle<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}