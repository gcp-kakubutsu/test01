import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export async function getDb() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 100,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 60000,
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
    // If params are provided, use execute for prepared statements
    // Otherwise use query for simple SQL
    if (params && params.length > 0) {
      // Convert params to ensure they are in the correct format
      const processedParams = params.map(p => {
        // Ensure numbers are properly formatted
        if (typeof p === 'number' || !isNaN(Number(p))) {
          return Number(p);
        }
        return p;
      });
      const [rows] = await db.execute(sql, processedParams);
      return rows as T[];
    } else {
      const [rows] = await db.query(sql);
      return rows as T[];
    }
  } catch (error) {
    throw error;
  }
}

export async function querySingle<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}