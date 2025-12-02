import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import { generateAnnualReport } from './generateAnnualReport.tsx';
import { Capture } from '../src/types';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

/**
 * Generate an annual report from Firebase data using client SDK
 * 
 * Usage:
 *   npx tsx scripts/runReportGenerationClient.ts <year> [program]
 * 
 * Examples:
 *   npx tsx scripts/runReportGenerationClient.ts 2024
 *   npx tsx scripts/runReportGenerationClient.ts 2024 "Program Name"
 */

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/runReportGenerationClient.ts <year> [program]');
    console.error('Example: npx tsx scripts/runReportGenerationClient.ts 2024');
    process.exit(1);
  }

  const year = parseInt(args[0], 10);
  const program = args[1] || undefined;

  if (isNaN(year) || year < 1900 || year > 2100) {
    console.error('Invalid year. Please provide a valid year (e.g., 2024)');
    process.exit(1);
  }

  console.log(`Fetching data from Firebase for year ${year}${program ? ` and program ${program}` : ''}...`);

  try {
    // Initialize Firebase with client SDK
    const firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
      measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);

    // Fetch all captures from capturesMap
    const capturesRef = ref(db, 'capturesMap');
    const capturesSnapshot = await get(capturesRef);
    const capturesData = capturesSnapshot.val();

    if (!capturesData) {
      console.error('No captures found in database (capturesMap is empty)');
      process.exit(1);
    }

    // Convert to array
    const captures: Capture[] = Object.values(capturesData);
    console.log(`Total captures in database: ${captures.length}`);

    // Generate the report
    const outputPath = await generateAnnualReport(year, captures, undefined, program);

    console.log('\n✅ Annual report generated successfully!');
    console.log(`📄 Report location: ${outputPath}`);
    console.log('\nReport includes:');
    console.log('  • Executive Summary with narrative analysis');
    console.log('  • Species Analysis with top 10 species');
    console.log('  • Age and Sex Demographics with interpretation');
    console.log('  • Temporal Analysis (monthly trends)');
    console.log('  • Biometric Data Summary');
    console.log('  • Long-Term Population Trends (multi-year comparison)');
    console.log('  • Species Diversity Trends (Shannon index, evenness)');
    console.log('  • Capture Effort Analysis (efficiency metrics)');
    console.log('  • Top 5 Species Population Trends over time');
    console.log('  • Notes and Methodology');

    process.exit(0);
  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
}

main();
