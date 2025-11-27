import { readFileSync } from 'fs';
import { join } from 'path';
import { importCSVToFirestore } from '../src/utils/importCaptures';

async function main() {
  try {
    console.log('Reading CSV file...');
    const csvPath = join(process.cwd(), 'public', 'data', 'tblCaptures.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    console.log('Starting Firestore import...');
    await importCSVToFirestore(csvContent);
    
    console.log('✅ Import completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

main();
