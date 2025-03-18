import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Exit with error if DATABASE_URL is not defined
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined');
  process.exit(1);
}

const verifyDatabase = async () => {
  try {
    console.log('🔍 Verifying database setup...');
    
    // Initialize the database connection
    const client = neon(process.env.DATABASE_URL!);
    const db = drizzle(client);
    
    // Check if tables exist
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // Extract table names from the result
    const tableNames: string[] = [];
    if (result.rows) {
      for (const row of result.rows) {
        if (row.table_name) {
          tableNames.push(row.table_name as string);
        }
      }
    }
    
    console.log('📋 Found tables:', tableNames.join(', '));
    
    // Check for required tables
    const requiredTables = ['users', 'app_config'];
    const missingTables = requiredTables.filter(table => !tableNames.includes(table));
    
    if (missingTables.length > 0) {
      console.warn(`⚠️ Missing tables: ${missingTables.join(', ')}`);
      return false;
    }
    
    console.log('✅ Database verification complete. All required tables found.');
    return true;
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    return false;
  }
};

verifyDatabase()
  .then(isValid => {
    if (!isValid) {
      console.log('🔄 Database needs to be initialized. Run migrations.');
    }
    process.exit(isValid ? 0 : 1);
  })
  .catch(() => process.exit(1)); 