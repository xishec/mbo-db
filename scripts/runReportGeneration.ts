import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { generateAnnualReport } from './generateAnnualReport.tsx';
import { Capture } from '../src/types';
import * as dotenv from 'dotenv';
import * as path from 'path';
import serviceAccount from '../mbo-db-firebase-adminsdk-fbsvc-5fcd6de6b9.json';

dotenv.config();

/**
 * Example script to generate an annual report from Firebase data
 * 
 * Usage:
 *   npx tsx scripts/runReportGeneration.ts <year> [program]
 * 
 * Examples:
 *   npx tsx scripts/runReportGeneration.ts 2024
 *   npx tsx scripts/runReportGeneration.ts 2024 "Program Name"
 */

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/runReportGeneration.ts <year> [program]');
    console.error('Example: npx tsx scripts/runReportGeneration.ts 2024');
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
    // Initialize Firebase Admin
    initializeApp({
      credential: cert(serviceAccount as ServiceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    const db = getDatabase();

    // Fetch all captures from capturesMap
    const capturesSnapshot = await db.ref('capturesMap').once('value');
    const capturesData = capturesSnapshot.val();

    if (!capturesData) {
      console.error('No captures found in database');
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
    console.log('  • Executive Summary');
    console.log('  • Species Analysis with top 10 species');
    console.log('  • Age and Sex Demographics');
    console.log('  • Temporal Analysis (monthly trends)');
    console.log('  • Biometric Data Summary');
    console.log('  • Notes and Methodology');

    process.exit(0);
  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
}

main();
