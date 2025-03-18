import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Exit with error if DATABASE_URL is not defined
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined');
  process.exit(1);
}

const runMigration = async () => {
  try {
    console.log('🔄 Running migrations...');
    
    // Initialize the database connection
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);
    
    // Run the migrations
    await migrate(db, { migrationsFolder: 'drizzle' });
    
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration(); 