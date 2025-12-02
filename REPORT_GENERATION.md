# Annual Report Generation

This project includes tools to automatically generate comprehensive annual reports from bird capture data.

## Libraries Used

- **@react-pdf/renderer** - PDF generation using React components
- **recharts** - Chart and graph generation
- **natural** - Natural language processing for text analysis

## Features

The generated reports include:

1. **Executive Summary**
   - Total captures, species count, capture types
   - Seasonal distribution and peak activity periods

2. **Species Analysis**
   - Top species by capture frequency
   - New bands, recaptures, and returns by species
   - Species distribution charts

3. **Demographics**
   - Age distribution across all captures
   - Sex distribution analysis
   - Visual charts for demographics

4. **Temporal Analysis**
   - Monthly capture trends
   - Active monitoring days per month
   - Species diversity by month

5. **Biometric Data**
   - Average weight, wing chord, and fat scores by species
   - Sample sizes for statistical validity

6. **Text Analysis** (in utilities)
   - Common phrases in notes
   - Word frequency analysis
   - Key terms extraction using TF-IDF

## Usage

### Generate a Report

```bash
# Generate report for a specific year
npx tsx scripts/runReportGeneration.ts 2024

# Generate report for a specific year and program
npx tsx scripts/runReportGeneration.ts 2024 "Program Name"
```

### Programmatic Usage

```typescript
import { generateAnnualReport } from './scripts/generateAnnualReport';
import { analyzeCaptures, analyzeNotes } from './scripts/reportUtils';

// Generate report
const captures = [...]; // Your capture data
const reportPath = await generateAnnualReport(2024, captures);

// Or analyze data separately
const analysis = analyzeCaptures(captures);
const textAnalysis = analyzeNotes(captures);
```

## Output

Reports are saved to `reports/annual-report-{year}-{program}.pdf`

## Customization

### Adding Charts

To add actual chart rendering, install chart generation library:

```bash
npm install chartjs-node-canvas
```

Then modify `generateCharts()` in `scripts/reportUtils.ts` to generate actual chart images.

Example:
```typescript
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 400 });

const configuration = {
  type: 'bar',
  data: {
    labels: ['Species 1', 'Species 2'],
    datasets: [{
      label: 'Captures',
      data: [10, 20],
    }]
  }
};

const image = await chartJSNodeCanvas.renderToBuffer(configuration);
fs.writeFileSync('chart.png', image);
```

### Customizing Report Layout

Edit `scripts/generateAnnualReport.ts` to modify:
- Page layouts and sections
- Styling (fonts, colors, spacing)
- Table structures
- Additional pages or analyses

### Adding More Analysis

Add new analysis functions to `scripts/reportUtils.ts`:
- Survival rate calculations
- Station comparison analysis
- Weather correlation
- Multi-year trends

## Environment Variables

Make sure your `.env` file includes:

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

## Future Enhancements

- Interactive charts in PDF
- Multi-year comparison reports
- Custom branding/logos
- Email distribution
- Automated scheduling (e.g., generate at year end)
- Data quality reports
- Export to other formats (Excel, Word)
