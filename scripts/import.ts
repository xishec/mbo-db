import { readFileSync } from 'fs';
import { join } from 'path';
import { importCSVToRTDB } from './importCaptures';
import { db } from './firebase-node';

async function main() {
  try {
    console.log('Reading CSV file...');
    const csvPath = join(process.cwd(), 'public', 'data', 'tblCaptures.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    console.log('Starting RTDB import...');
    await importCSVToRTDB(csvContent, db);
    
    console.log('✅ Import completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

main();
