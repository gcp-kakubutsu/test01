import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function fetchDatabaseTables() {
  let connection;
  
  try {
    // Create connection using environment variables
    console.log('Attempting to connect to:');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Port: ${process.env.DB_PORT}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`User: ${process.env.DB_USER}`);
    console.log('');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306'),
      connectTimeout: 20000, // 20 seconds timeout
      ssl: {
        rejectUnauthorized: false // For AWS RDS
      }
    });

    console.log('Connected to MySQL database successfully!\n');

    // Fetch all tables
    const [tables] = await connection.execute(
      'SHOW TABLES'
    ) as any[];

    console.log(`Found ${tables.length} tables in database "${process.env.DB_NAME}":\n`);

    // For each table, get its structure
    for (const table of tables) {
      const tableName = Object.values(table)[0] as string;
      console.log(`\n=== Table: ${tableName} ===`);

      // Get table structure
      const [columns] = await connection.execute(
        `DESCRIBE ${tableName}`
      ) as any[];

      console.log('Columns:');
      columns.forEach((column: any) => {
        console.log(`  - ${column.Field} (${column.Type}) ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
      });

      // Get row count
      const [countResult] = await connection.execute(
        `SELECT COUNT(*) as count FROM ${tableName}`
      ) as any[];
      console.log(`  Row count: ${countResult[0].count}`);
    }

  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run the script
fetchDatabaseTables();