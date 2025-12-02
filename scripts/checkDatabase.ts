import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import * as dotenv from 'dotenv';
import serviceAccount from '../mbo-db-firebase-adminsdk-fbsvc-5fcd6de6b9.json';

dotenv.config();

async function main() {
  initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });

  const db = getDatabase();

  // Check root structure
  console.log('Checking database structure...\n');
  
  const rootSnapshot = await db.ref('/').once('value');
  const rootData = rootSnapshot.val();
  
  if (!rootData) {
    console.log('❌ Database is empty');
    process.exit(1);
  }

  console.log('📊 Top-level nodes in database:');
  Object.keys(rootData).forEach(key => {
    const value = rootData[key];
    const type = Array.isArray(value) ? 'array' : typeof value;
    const size = typeof value === 'object' && value !== null ? Object.keys(value).length : 1;
    console.log(`  • ${key}: ${type} (${size} items)`);
  });

  // Check if captures exist
  if (rootData.captures) {
    console.log('\n✅ Found captures node');
    const captures = Object.values(rootData.captures);
    console.log(`   Total captures: ${captures.length}`);
    
    if (captures.length > 0) {
      const firstCapture: any = captures[0];
      console.log('\n📝 Sample capture:');
      console.log(JSON.stringify(firstCapture, null, 2).substring(0, 500));
      
      // Check years
      const years = new Set<number>();
      captures.forEach((c: any) => {
        if (c.date) {
          const year = new Date(c.date).getFullYear();
          if (!isNaN(year)) years.add(year);
        }
      });
      console.log(`\n📅 Years with data: ${Array.from(years).sort().join(', ')}`);
    }
  } else {
    console.log('\n❌ No captures node found in database');
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
