import { generateAnnualReport } from './generateAnnualReport.tsx';
import { Capture, HEADER_TO_CAPTURE_PROPERTY, NUMERIC_FIELDS } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate an annual report from local CSV data
 * 
 * Usage:
 *   npx tsx scripts/runReportGenerationFromCSV.ts <year> [csvFile] [program]
 * 
 * Examples:
 *   npx tsx scripts/runReportGenerationFromCSV.ts 2024
 *   npx tsx scripts/runReportGenerationFromCSV.ts 2024 public/data/tblCaptures.csv
 *   npx tsx scripts/runReportGenerationFromCSV.ts 2024 public/data/tblCaptures.csv "Program Name"
 */

function parseCSV(csvContent: string): any[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index];
      const propertyName = HEADER_TO_CAPTURE_PROPERTY[header] || header.toLowerCase();
      
      if (NUMERIC_FIELDS.has(header) && value) {
        row[propertyName] = parseFloat(value) || 0;
      } else {
        row[propertyName] = value || '';
      }
    });
    
    data.push(row);
  }

  return data;
}

function csvToCaptures(csvData: any[]): Capture[] {
  return csvData.map((row, index) => {
    // Generate band info
    const bandPrefix = row.bandPrefix || row.BandPrefix || '';
    const bandSuffix = row.bandSuffix || row.BandSuffix || '';
    const bandId = `${bandPrefix}${bandSuffix}`;
    const bandGroup = bandPrefix.substring(0, bandPrefix.length - 2) || 'Unknown';
    const bandLastTwoDigits = bandPrefix.substring(bandPrefix.length - 2) || '00';

    return {
      id: `capture_${index}`,
      bandGroup,
      bandLastTwoDigits,
      bandId,
      programId: row.programId || row.Program || 'Unknown',
      bandPrefix,
      bandSuffix,
      species: row.species || row.Species || 'Unknown',
      wing: row.wing || row.WingChord || 0,
      age: row.age || row.Age || '',
      howAged: row.howAged || row.HowAged || '',
      sex: row.sex || row.Sex || '',
      howSexed: row.howSexed || row.HowSexed || '',
      fat: row.fat || row.Fat || 0,
      weight: row.weight || row.Weight || 0,
      date: row.date || row.CaptureDate || '',
      time: row.time || '',
      bander: row.bander || row.Bander || '',
      scribe: row.scribe || row.Scribe || '',
      net: row.net || row.Net || '',
      notes: row.notes || row.NotesForMBO || '',
      captureType: (row.captureType || row.D18 || 'None') as keyof typeof import('../src/types').CaptureType,
    };
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/runReportGenerationFromCSV.ts <year> [csvFile] [program]');
    console.error('Example: npx tsx scripts/runReportGenerationFromCSV.ts 2024');
    process.exit(1);
  }

  const year = parseInt(args[0], 10);
  const csvFile = args[1] || 'public/data/tblCaptures.csv';
  const program = args[2] || undefined;

  if (isNaN(year) || year < 1900 || year > 2100) {
    console.error('Invalid year. Please provide a valid year (e.g., 2024)');
    process.exit(1);
  }

  console.log(`Reading data from CSV: ${csvFile}`);

  try {
    const csvPath = path.join(process.cwd(), csvFile);
    
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found: ${csvPath}`);
      process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const csvData = parseCSV(csvContent);
    const captures = csvToCaptures(csvData);

    console.log(`Total captures in CSV: ${captures.length}`);

    if (captures.length === 0) {
      console.error('No captures found in CSV file');
      process.exit(1);
    }

    // Generate the report
    const outputPath = await generateAnnualReport(year, captures, undefined, program);

    console.log('\n✅ Annual report generated successfully!');
    console.log(`📄 Report location: ${outputPath}`);
    console.log('\nReport includes:');
    console.log('  • Executive Summary with narrative analysis');
    console.log('  • Species Analysis with explanatory text');
    console.log('  • Age and Sex Demographics with interpretation');
    console.log('  • Temporal Analysis with seasonal patterns');
    console.log('  • Biometric Data Summary with health indicators');
    console.log('  • Notes and Methodology');

    process.exit(0);
  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
}

main();
