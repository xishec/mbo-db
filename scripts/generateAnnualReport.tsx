import * as React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { Capture } from '../src/types';
import { 
  analyzeCaptures, 
  generateCharts, 
  generateExecutiveSummary,
  generateSpeciesAnalysis,
  generateDemographicsAnalysis,
  generateTemporalAnalysis,
  generateBiometricAnalysis,
  analyzeMultiYearTrends,
  analyzeSpeciesDiversity,
  analyzeCaptureEffort,
  analyzeTopSpeciesTrends,
  generateTrendsAnalysis,
  analyzeSexRatiosBySpecies,
  analyzeAgeRatiosBySpecies,
  analyzeCaptureTimingPatterns,
  analyzeRecaptureIntervals,
  analyzeNetUsage,
  analyzeBanderProductivity,
  analyzeMorphometricCorrelations,
  analyzeSpeciesByAgeSex,
  analyzeFatScoresByDemographics,
  analyzeWeightPatterns,
  analyzeNetEfficiencyByMonth,
  analyzeCaptureTimePatterns,
  analyzeSpeciesCoOccurrence,
  analyzeBodyConditionIndex,
  analyzeRecaptureRatesByNet,
  analyzeDailyCaptureRates,
  analyzeSpeciesAccumulation,
  analyzeBanderSpecialization,
} from './reportUtils';
import * as fs from 'fs';
import * as path from 'path';

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 20,
    marginBottom: 10,
    fontFamily: 'Helvetica-Bold',
  },
  section: {
    marginBottom: 15,
  },
  text: {
    marginBottom: 4,
    lineHeight: 1.35,
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingVertical: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    fontFamily: 'Helvetica-Bold',
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 5,
  },
  chart: {
    marginVertical: 15,
    width: '100%',
    height: 250,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#666666',
  },
  smallText: {
    fontSize: 9,
    marginBottom: 4,
    lineHeight: 1.4,
  },
});

interface ReportData {
  year: number;
  captures: Capture[];
  program?: string;
  multiYearData?: any;
}

// Main PDF Document Component
const AnnualReportDocument: React.FC<{ data: ReportData; analysis: any; chartPaths: any }> = ({
  data,
  analysis,
  chartPaths,
}) => (
  <Document>
    {/* Cover Page */}
    <Page size="A4" style={styles.page}>
      <View style={{ marginTop: 200, alignItems: 'center' }}>
        <Text style={styles.title}>Monitoring Avian Productivity and Survivorship (MAPS)</Text>
        <Text style={{ fontSize: 20, marginTop: 20 }}>Annual Report {data.year}</Text>
        {data.program && <Text style={{ fontSize: 16, marginTop: 10 }}>{data.program}</Text>}
        <Text style={{ fontSize: 12, marginTop: 40, color: '#666666' }}>
          Generated: {new Date().toLocaleDateString()}
        </Text>
      </View>
    </Page>

    {/* Summary Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Executive Summary</Text>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Overview</Text>
        <Text style={styles.text}>Total Captures: {analysis.totalCaptures}</Text>
        <Text style={styles.text}>Unique Species: {analysis.uniqueSpecies}</Text>
        <Text style={styles.text}>New Bands: {analysis.newBands}</Text>
        <Text style={styles.text}>Recaptures: {analysis.recaptures}</Text>
        <Text style={styles.text}>Returns: {analysis.returns}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Seasonal Distribution</Text>
        <Text style={styles.text}>Peak Capture Month: {analysis.peakMonth}</Text>
        <Text style={styles.text}>Active Monitoring Days: {analysis.activeDays}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Summary Analysis</Text>
        <Text style={[styles.text, { textAlign: 'justify' }]}>{analysis.executiveSummaryText}</Text>
      </View>
    </Page>

    {/* Species Analysis Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Species Analysis</Text>

      <Text style={styles.subtitle}>Top 10 Species by Capture Frequency</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
          <Text style={styles.tableCell}>Count</Text>
          <Text style={styles.tableCell}>Percentage</Text>
          <Text style={styles.tableCell}>New</Text>
          <Text style={styles.tableCell}>Recap</Text>
        </View>
        {analysis.topSpecies.slice(0, 10).map((species: any, index: number) => (
          <View key={index} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{species.name}</Text>
            <Text style={styles.tableCell}>{species.count}</Text>
            <Text style={styles.tableCell}>{species.percentage.toFixed(1)}%</Text>
            <Text style={styles.tableCell}>{species.new}</Text>
            <Text style={styles.tableCell}>{species.recaptures}</Text>
          </View>
        ))}
      </View>

      {chartPaths.speciesChart && <Image style={styles.chart} src={chartPaths.speciesChart} />}

      <View style={styles.section}>
        <Text style={styles.subtitle}>Analysis</Text>
        <Text style={[styles.text, { textAlign: 'justify' }]}>{analysis.speciesAnalysisText}</Text>
      </View>
    </Page>

    {/* Demographics Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Age and Sex Demographics</Text>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Age Distribution</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCell}>Age Class</Text>
            <Text style={styles.tableCell}>Count</Text>
            <Text style={styles.tableCell}>Percentage</Text>
          </View>
          {Object.entries(analysis.ageDistribution).map(([age, count]: [string, any]) => (
            <View key={age} style={styles.tableRow}>
              <Text style={styles.tableCell}>{age || 'Unknown'}</Text>
              <Text style={styles.tableCell}>{count}</Text>
              <Text style={styles.tableCell}>
                {((count / analysis.totalCaptures) * 100).toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Sex Distribution</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCell}>Sex</Text>
            <Text style={styles.tableCell}>Count</Text>
            <Text style={styles.tableCell}>Percentage</Text>
          </View>
          {Object.entries(analysis.sexDistribution).map(([sex, count]: [string, any]) => (
            <View key={sex} style={styles.tableRow}>
              <Text style={styles.tableCell}>{sex || 'Unknown'}</Text>
              <Text style={styles.tableCell}>{count}</Text>
              <Text style={styles.tableCell}>
                {((count / analysis.totalCaptures) * 100).toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      {chartPaths.demographicsChart && <Image style={styles.chart} src={chartPaths.demographicsChart} />}

      <View style={styles.section}>
        <Text style={styles.subtitle}>Analysis</Text>
        <Text style={[styles.text, { textAlign: 'justify' }]}>{analysis.demographicsAnalysisText}</Text>
      </View>
    </Page>

    {/* Sex Ratios by Species Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Sex Ratios by Species</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          Sex ratio analysis for species with adequate sample sizes (n≥10) reveals demographic patterns 
          that may indicate breeding strategies, differential migration timing, or habitat preferences.
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
          <Text style={styles.tableCell}>M</Text>
          <Text style={styles.tableCell}>F</Text>
          <Text style={styles.tableCell}>M:F</Text>
          <Text style={styles.tableCell}>M%</Text>
          <Text style={styles.tableCell}>n</Text>
        </View>
        {analysis.sexRatios.slice(0, 20).map((ratio: any, idx: number) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{ratio.species}</Text>
            <Text style={styles.tableCell}>{ratio.male}</Text>
            <Text style={styles.tableCell}>{ratio.female}</Text>
            <Text style={styles.tableCell}>{ratio.ratio}</Text>
            <Text style={styles.tableCell}>{ratio.malePercent}%</Text>
            <Text style={styles.tableCell}>{ratio.total}</Text>
          </View>
        ))}
      </View>
    </Page>

    {/* Age Ratios by Species Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Age Ratios and Productivity by Species</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          Young-to-adult ratios indicate breeding success and productivity. Higher ratios suggest successful 
          local reproduction, while lower ratios may indicate predominantly non-breeding populations or poor breeding conditions.
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
          <Text style={styles.tableCell}>Young</Text>
          <Text style={styles.tableCell}>Adult</Text>
          <Text style={styles.tableCell}>Y:A</Text>
          <Text style={styles.tableCell}>Young%</Text>
          <Text style={styles.tableCell}>n</Text>
        </View>
        {analysis.ageRatios.slice(0, 20).map((ratio: any, idx: number) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{ratio.species}</Text>
            <Text style={styles.tableCell}>{ratio.young}</Text>
            <Text style={styles.tableCell}>{ratio.adult}</Text>
            <Text style={styles.tableCell}>{ratio.ratio}</Text>
            <Text style={styles.tableCell}>{ratio.youngPercent}%</Text>
            <Text style={styles.tableCell}>{ratio.total}</Text>
          </View>
        ))}
      </View>
    </Page>

    {/* Morphometric Analysis Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Morphometric Analysis with Variation</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          Morphological measurements with standard deviations reveal population variation and can indicate 
          sexual dimorphism, age classes, or geographic subspecies. Ranges show measurement extremes captured.
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
          <Text style={styles.tableCell}>Weight (g)</Text>
          <Text style={styles.tableCell}>SD</Text>
          <Text style={styles.tableCell}>Wing (mm)</Text>
          <Text style={styles.tableCell}>SD</Text>
          <Text style={styles.tableCell}>n</Text>
        </View>
        {analysis.morphometrics.slice(0, 15).map((morph: any, idx: number) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{morph.species}</Text>
            <Text style={[styles.tableCell, { fontSize: 9 }]}>{morph.avgWeight}</Text>
            <Text style={[styles.tableCell, { fontSize: 9 }]}>±{morph.weightSD}</Text>
            <Text style={[styles.tableCell, { fontSize: 9 }]}>{morph.avgWing}</Text>
            <Text style={[styles.tableCell, { fontSize: 9 }]}>±{morph.wingSD}</Text>
            <Text style={styles.tableCell}>{morph.count}</Text>
          </View>
        ))}
      </View>
    </Page>

    {/* Temporal Analysis Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Temporal Analysis</Text>

      <Text style={styles.subtitle}>Monthly Capture Trends</Text>
      {chartPaths.monthlyTrendChart && <Image style={styles.chart} src={chartPaths.monthlyTrendChart} />}

      <View style={styles.section}>
        <Text style={[styles.text, { textAlign: 'justify' }]}>{analysis.temporalAnalysisText}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Monthly Summary</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCell}>Month</Text>
            <Text style={styles.tableCell}>Captures</Text>
            <Text style={styles.tableCell}>Species</Text>
            <Text style={styles.tableCell}>Days Active</Text>
          </View>
          {analysis.monthlyData.map((month: any) => (
            <View key={month.month} style={styles.tableRow}>
              <Text style={styles.tableCell}>{month.month}</Text>
              <Text style={styles.tableCell}>{month.captures}</Text>
              <Text style={styles.tableCell}>{month.species}</Text>
              <Text style={styles.tableCell}>{month.days}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>

    {/* Biometric Data Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Biometric Data Summary</Text>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Average Measurements by Top Species</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
            <Text style={styles.tableCell}>Avg Weight (g)</Text>
            <Text style={styles.tableCell}>Avg Wing (mm)</Text>
            <Text style={styles.tableCell}>Avg Fat</Text>
            <Text style={styles.tableCell}>n</Text>
          </View>
          {analysis.biometricData.slice(0, 15).map((species: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{species.name}</Text>
              <Text style={styles.tableCell}>{species.avgWeight?.toFixed(1) || 'N/A'}</Text>
              <Text style={styles.tableCell}>{species.avgWing?.toFixed(1) || 'N/A'}</Text>
              <Text style={styles.tableCell}>{species.avgFat?.toFixed(1) || 'N/A'}</Text>
              <Text style={styles.tableCell}>{species.count}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Analysis</Text>
        <Text style={[styles.text, { textAlign: 'justify' }]}>{analysis.biometricAnalysisText}</Text>
      </View>
    </Page>

    {/* Multi-variable Demographic Cross-Tab Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Multi-Variable Demographic Analysis</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          This section combines age and sex information to highlight population structure within each species. Only
          species with adequate sample sizes (n≥10) are shown.
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
          <Text style={styles.tableCell}>M Ad</Text>
          <Text style={styles.tableCell}>M Yng</Text>
          <Text style={styles.tableCell}>F Ad</Text>
          <Text style={styles.tableCell}>F Yng</Text>
          <Text style={styles.tableCell}>Unk</Text>
          <Text style={styles.tableCell}>n</Text>
        </View>
        {analysis.speciesAgeSex.slice(0, 18).map((row: any, idx: number) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{row.species}</Text>
            <Text style={styles.tableCell}>{row.maleAdult}</Text>
            <Text style={styles.tableCell}>{row.maleYoung}</Text>
            <Text style={styles.tableCell}>{row.femaleAdult}</Text>
            <Text style={styles.tableCell}>{row.femaleYoung}</Text>
            <Text style={styles.tableCell}>{row.unknownSex}</Text>
            <Text style={styles.tableCell}>{row.total}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Body Condition (Fat Scores)</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
            <Text style={styles.tableCell}>Overall</Text>
            <Text style={styles.tableCell}>M Ad</Text>
            <Text style={styles.tableCell}>F Ad</Text>
            <Text style={styles.tableCell}>M Yng</Text>
            <Text style={styles.tableCell}>F Yng</Text>
            <Text style={styles.tableCell}>n</Text>
          </View>
          {analysis.fatDemographics.slice(0, 12).map((row: any, idx: number) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{row.species}</Text>
              <Text style={styles.tableCell}>{row.overall}</Text>
              <Text style={styles.tableCell}>{row.maleAdult}</Text>
              <Text style={styles.tableCell}>{row.femaleAdult}</Text>
              <Text style={styles.tableCell}>{row.maleYoung}</Text>
              <Text style={styles.tableCell}>{row.femaleYoung}</Text>
              <Text style={styles.tableCell}>{row.n}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>

    {/* Body Condition and Weight Patterns Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Body Condition and Weight Patterns</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          Weight patterns by age, sex, and season provide a multi-dimensional view of body condition and energy
          reserves through the monitoring period.
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
          <Text style={styles.tableCell}>M</Text>
          <Text style={styles.tableCell}>F</Text>
          <Text style={styles.tableCell}>Young</Text>
          <Text style={styles.tableCell}>Adult</Text>
          <Text style={styles.tableCell}>Early</Text>
          <Text style={styles.tableCell}>Late</Text>
        </View>
        {analysis.weightPatterns.slice(0, 15).map((row: any, idx: number) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{row.species}</Text>
            <Text style={styles.tableCell}>{row.male}</Text>
            <Text style={styles.tableCell}>{row.female}</Text>
            <Text style={styles.tableCell}>{row.young}</Text>
            <Text style={styles.tableCell}>{row.adult}</Text>
            <Text style={styles.tableCell}>{row.early}</Text>
            <Text style={styles.tableCell}>{row.late}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Body Condition Index</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
            <Text style={styles.tableCell}>Index</Text>
            <Text style={styles.tableCell}>CV%</Text>
            <Text style={styles.tableCell}>Wt</Text>
            <Text style={styles.tableCell}>Wing</Text>
            <Text style={styles.tableCell}>n</Text>
          </View>
          {analysis.bodyCondition.slice(0, 12).map((row: any, idx: number) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{row.species}</Text>
              <Text style={styles.tableCell}>{row.avgRatio}</Text>
              <Text style={styles.tableCell}>{row.cv}</Text>
              <Text style={styles.tableCell}>{row.avgWeight}</Text>
              <Text style={styles.tableCell}>{row.avgWing}</Text>
              <Text style={styles.tableCell}>{row.n}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>

    {/* Weekly Capture Patterns Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Weekly Capture Patterns</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          Weekly capture patterns reveal phenological timing of migration peaks, breeding periods, and seasonal movements. 
          Peaks coincide with optimal conditions for capturing migrants and local breeding populations.
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableCell}>Period</Text>
          <Text style={styles.tableCell}>Captures</Text>
          <Text style={styles.tableCell}>Species</Text>
          <Text style={styles.tableCell}>Avg/Day</Text>
        </View>
        {analysis.weeklyPatterns.slice(0, 25).map((week: any, idx: number) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={styles.tableCell}>{week.period}</Text>
            <Text style={styles.tableCell}>{week.captures}</Text>
            <Text style={styles.tableCell}>{week.species}</Text>
            <Text style={styles.tableCell}>{(week.captures / 7).toFixed(1)}</Text>
          </View>
        ))}
      </View>
    </Page>

    {/* Daily and Hourly Effort Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Daily and Hourly Capture Rates</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          Combining daily totals with hourly patterns highlights when capture effort and bird activity peak during
          the monitoring season.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Daily Capture Summary</Text>
        <Text style={styles.smallText}>
          Avg/day: {analysis.dailyRates.summary.avgCaptures}, Max: {analysis.dailyRates.summary.maxCaptures}, Min:{' '}
          {analysis.dailyRates.summary.minCaptures}, SD: {analysis.dailyRates.summary.stdDev} (n={
            analysis.dailyRates.summary.totalDays
          }
          days)
        </Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCell}>Date</Text>
            <Text style={styles.tableCell}>Captures</Text>
            <Text style={styles.tableCell}>Species</Text>
            <Text style={styles.tableCell}>New</Text>
          </View>
          {analysis.dailyRates.dailyRates.slice(0, 18).map((d: any, idx: number) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { fontSize: 9 }]}>{d.date}</Text>
              <Text style={styles.tableCell}>{d.captures}</Text>
              <Text style={styles.tableCell}>{d.species}</Text>
              <Text style={styles.tableCell}>{d.newBands}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Hourly Capture Patterns</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Hour</Text>
            <Text style={styles.tableCell}>Captures</Text>
            <Text style={styles.tableCell}>Species</Text>
            <Text style={styles.tableCell}>New</Text>
            <Text style={styles.tableCell}>Recaps</Text>
          </View>
          {analysis.hourlyPatterns.slice(0, 16).map((h: any, idx: number) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{h.timeRange}</Text>
              <Text style={styles.tableCell}>{h.captures}</Text>
              <Text style={styles.tableCell}>{h.species}</Text>
              <Text style={styles.tableCell}>{h.newBands}</Text>
              <Text style={styles.tableCell}>{h.recaptures}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>

    {/* Recapture Intervals Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Recapture Intervals and Longevity</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          Recapture intervals provide minimum longevity estimates and insights into site fidelity. 
          Maximum intervals represent the longest time between first capture and any subsequent recapture for each species.
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
          <Text style={styles.tableCell}>Recaps</Text>
          <Text style={styles.tableCell}>Min Days</Text>
          <Text style={styles.tableCell}>Avg Days</Text>
          <Text style={styles.tableCell}>Max Years</Text>
        </View>
        {analysis.recaptureIntervals.map((interval: any, idx: number) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{interval.species}</Text>
            <Text style={styles.tableCell}>{interval.count}</Text>
            <Text style={styles.tableCell}>{interval.minDays}</Text>
            <Text style={styles.tableCell}>{interval.avgDays}</Text>
            <Text style={styles.tableCell}>{interval.maxYears}</Text>
          </View>
        ))}
      </View>
    </Page>

    {/* Net Usage and Efficiency Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Net Location Analysis</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          Net-specific data reveals habitat microsite preferences and capture efficiency across locations. 
          Recapture rates indicate site fidelity and local movement patterns within the study area.
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableCell}>Net</Text>
          <Text style={styles.tableCell}>Captures</Text>
          <Text style={styles.tableCell}>Species</Text>
          <Text style={styles.tableCell}>New</Text>
          <Text style={styles.tableCell}>Recaps</Text>
          <Text style={styles.tableCell}>Rate%</Text>
        </View>
        {analysis.netUsage.map((net: any, idx: number) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={styles.tableCell}>{net.net}</Text>
            <Text style={styles.tableCell}>{net.captures}</Text>
            <Text style={styles.tableCell}>{net.species}</Text>
            <Text style={styles.tableCell}>{net.newBands}</Text>
            <Text style={styles.tableCell}>{net.recaptures}</Text>
            <Text style={styles.tableCell}>{net.recaptureRate}%</Text>
          </View>
        ))}
      </View>
    </Page>

    {/* Net and Habitat Multi-Variable Analysis Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Net Performance by Month and Species</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          This page combines capture totals, species richness, and recapture rates by net and month to highlight
          microsite productivity and habitat use.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Net × Month Summary</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCell}>Net</Text>
            <Text style={styles.tableCell}>Month</Text>
            <Text style={styles.tableCell}>Captures</Text>
            <Text style={styles.tableCell}>Species</Text>
            <Text style={styles.tableCell}>New</Text>
          </View>
          {analysis.netMonth.slice(0, 20).map((row: any, idx: number) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.tableCell}>{row.net}</Text>
              <Text style={styles.tableCell}>{row.month}</Text>
              <Text style={styles.tableCell}>{row.captures}</Text>
              <Text style={styles.tableCell}>{row.species}</Text>
              <Text style={styles.tableCell}>{row.newBands}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Recapture Rates by Net and Species</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Net</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>Species</Text>
            <Text style={styles.tableCell}>Total</Text>
            <Text style={styles.tableCell}>Recaps</Text>
            <Text style={styles.tableCell}>Rate%</Text>
          </View>
          {analysis.recaptureByNet.slice(0, 18).map((row: any, idx: number) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{row.net}</Text>
              <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{row.species}</Text>
              <Text style={styles.tableCell}>{row.total}</Text>
              <Text style={styles.tableCell}>{row.recaptures}</Text>
              <Text style={styles.tableCell}>{row.recaptureRate}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>

    {/* Bander Productivity Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Bander Performance and Productivity</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          Bander-specific metrics document individual contributions and experience levels. 
          Captures per day reflect efficiency and consistency across monitoring sessions.
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Bander</Text>
          <Text style={styles.tableCell}>Captures</Text>
          <Text style={styles.tableCell}>Species</Text>
          <Text style={styles.tableCell}>New</Text>
          <Text style={styles.tableCell}>Days</Text>
          <Text style={styles.tableCell}>Per Day</Text>
        </View>
        {analysis.banderProductivity.map((bander: any, idx: number) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{bander.bander}</Text>
            <Text style={styles.tableCell}>{bander.captures}</Text>
            <Text style={styles.tableCell}>{bander.species}</Text>
            <Text style={styles.tableCell}>{bander.newBands}</Text>
            <Text style={styles.tableCell}>{bander.days}</Text>
            <Text style={styles.tableCell}>{bander.capturesPerDay}</Text>
          </View>
        ))}
      </View>
    </Page>

    {/* Bander Specialization Page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Bander Specialization and Diversity</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          Multi-variable bander metrics combine total captures, species diversity, and species composition to
          characterize individual contributions and specializations.
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Bander</Text>
          <Text style={styles.tableCell}>Captures</Text>
          <Text style={styles.tableCell}>Species</Text>
          <Text style={styles.tableCell}>Diversity</Text>
          <Text style={[styles.tableCell, { flex: 3 }]}>Top Species</Text>
        </View>
        {analysis.banderSpecialization.slice(0, 15).map((row: any, idx: number) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontSize: 9 }]}>{row.bander}</Text>
            <Text style={styles.tableCell}>{row.total}</Text>
            <Text style={styles.tableCell}>{row.speciesCount}</Text>
            <Text style={styles.tableCell}>{row.diversity}</Text>
            <Text style={[styles.tableCell, { flex: 3, fontSize: 8 }]}>{row.topSpecies}</Text>
          </View>
        ))}
      </View>
    </Page>

    {/* Multi-Year Trends Page */}
    {data.multiYearData && (
      <>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Long-Term Population Trends</Text>

          <View style={styles.section}>
            <Text style={[styles.text, { textAlign: 'justify' }]}>{analysis.trendsAnalysisText}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.subtitle}>Annual Capture Summary (All Years)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCell}>Year</Text>
                <Text style={styles.tableCell}>Total</Text>
                <Text style={styles.tableCell}>Species</Text>
                <Text style={styles.tableCell}>New Bands</Text>
                <Text style={styles.tableCell}>Returns</Text>
                <Text style={styles.tableCell}>Y:A Ratio</Text>
              </View>
              {data.multiYearData.yearlyMetrics.slice(-10).map((metric: any) => (
                <View key={metric.year} style={[styles.tableRow, metric.year === data.year ? { backgroundColor: '#ffffcc' } : {}]}>
                  <Text style={styles.tableCell}>{metric.year}</Text>
                  <Text style={styles.tableCell}>{metric.totalCaptures}</Text>
                  <Text style={styles.tableCell}>{metric.uniqueSpecies}</Text>
                  <Text style={styles.tableCell}>{metric.newBands}</Text>
                  <Text style={styles.tableCell}>{metric.returns}</Text>
                  <Text style={styles.tableCell}>{metric.youngToAdultRatio.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </View>
        </Page>

        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Species Diversity Trends</Text>

          <View style={styles.section}>
            <Text style={styles.subtitle}>Diversity Indices Over Time</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCell}>Year</Text>
                <Text style={styles.tableCell}>Richness</Text>
                <Text style={styles.tableCell}>Shannon H'</Text>
                <Text style={styles.tableCell}>Evenness</Text>
                <Text style={styles.tableCell}>Captures</Text>
              </View>
              {data.multiYearData.diversity.slice(-10).map((div: any) => (
                <View key={div.year} style={[styles.tableRow, div.year === data.year ? { backgroundColor: '#ffffcc' } : {}]}>
                  <Text style={styles.tableCell}>{div.year}</Text>
                  <Text style={styles.tableCell}>{div.richness}</Text>
                  <Text style={styles.tableCell}>{div.shannon}</Text>
                  <Text style={styles.tableCell}>{div.evenness}</Text>
                  <Text style={styles.tableCell}>{div.totalCaptures}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.text}>
              Species diversity indices provide quantitative measures of community structure. Richness represents the number of species, 
              Shannon index (H') measures both abundance and evenness, and Evenness indicates how equally distributed species are. 
              Higher values generally indicate more diverse and stable communities.
            </Text>
          </View>
        </Page>

        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Capture Effort Analysis</Text>

          <View style={styles.section}>
            <Text style={styles.subtitle}>Monitoring Effort and Efficiency</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCell}>Year</Text>
                <Text style={styles.tableCell}>Days</Text>
                <Text style={styles.tableCell}>Total</Text>
                <Text style={styles.tableCell}>Per Day</Text>
                <Text style={styles.tableCell}>Species</Text>
                <Text style={styles.tableCell}>Spp/Day</Text>
              </View>
              {data.multiYearData.effort.slice(-10).map((eff: any) => (
                <View key={eff.year} style={[styles.tableRow, eff.year === data.year ? { backgroundColor: '#ffffcc' } : {}]}>
                  <Text style={styles.tableCell}>{eff.year}</Text>
                  <Text style={styles.tableCell}>{eff.activeDays}</Text>
                  <Text style={styles.tableCell}>{eff.totalCaptures}</Text>
                  <Text style={styles.tableCell}>{eff.capturesPerDay}</Text>
                  <Text style={styles.tableCell}>{eff.uniqueSpecies}</Text>
                  <Text style={styles.tableCell}>{eff.speciesPerDay}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.text}>
              Capture efficiency metrics help standardize comparisons across years by accounting for sampling effort. 
              Captures per day reflects both bird abundance and site quality, while species per day indicates diversity 
              relative to effort. Consistent effort across years improves trend reliability.
            </Text>
          </View>
        </Page>

        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Top Species Population Trends</Text>

          {data.multiYearData.speciesTrends.topSpecies.slice(0, 5).map((species: string, idx: number) => {
            const trendData = data.multiYearData.speciesTrends.speciesTrends.find((t: any) => t.species === species);
            if (!trendData) return null;

            return (
              <View key={species} style={styles.section}>
                <Text style={styles.subtitle}>{idx + 1}. {species}</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    {trendData.yearlyData.slice(-8).map((yd: any) => (
                      <Text key={yd.year} style={styles.tableCell}>{yd.year}</Text>
                    ))}
                  </View>
                  <View style={styles.tableRow}>
                    {trendData.yearlyData.slice(-8).map((yd: any) => (
                      <Text key={`${yd.year}-count`} style={styles.tableCell}>{yd.count}</Text>
                    ))}
                  </View>
                  <View style={styles.tableRow}>
                    {trendData.yearlyData.slice(-8).map((yd: any) => (
                      <Text key={`${yd.year}-pct`} style={[styles.tableCell, { fontSize: 9 }]}>{yd.percentage}%</Text>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.section}>
            <Text style={styles.text}>
              Individual species trends reveal population dynamics and potential conservation concerns. 
              Stable or increasing trends suggest healthy populations, while declining trends may warrant 
              further investigation into habitat changes, climate effects, or regional population shifts.
            </Text>
          </View>
        </Page>
      </>
    )}

    {/* Footer on last page */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Notes and Methodology</Text>

      <View style={styles.section}>
        <Text style={styles.text}>
          This report was automatically generated from capture data collected during the {data.year} monitoring
          season. Data follows MAPS (Monitoring Avian Productivity and Survivorship) protocols established by
          The Institute for Bird Populations.
        </Text>
        <Text style={styles.text}>
          {'\n'}Bird banding activities were conducted under federal and state permits. All measurements and
          observations were recorded by trained and certified bird banders.
        </Text>
        <Text style={styles.text}>
          {'\n'}For questions or more information about this report, please contact your local monitoring station.
        </Text>
      </View>

      <Text style={styles.footer}>
        Generated by MBO Database System • {new Date().toLocaleDateString()}
      </Text>
    </Page>
  </Document>
);

/**
 * Generate an annual report PDF from capture data
 * @param year - The year to generate the report for
 * @param captures - Array of capture records (all years for trend analysis)
 * @param outputPath - Path to save the PDF (default: reports/annual-report-{year}.pdf)
 * @param program - Optional program name to filter by
 */
export async function generateAnnualReport(
  year: number,
  allCaptures: Capture[],
  outputPath?: string,
  program?: string
): Promise<string> {
  console.log(`Generating annual report for ${year}...`);

  // Filter captures by year and optionally by program
  const yearCaptures = allCaptures.filter((c) => {
    const captureYear = new Date(c.date).getFullYear();
    const matchesYear = captureYear === year;
    const matchesProgram = !program || c.programId === program;
    return matchesYear && matchesProgram;
  });

  if (yearCaptures.length === 0) {
    throw new Error(`No captures found for year ${year}${program ? ` and program ${program}` : ''}`);
  }

  console.log(`Found ${yearCaptures.length} captures for ${year}`);
  console.log(`Analyzing trends across ${new Set(allCaptures.map(c => new Date(c.date).getFullYear())).size} years of data...`);

  // Analyze the data
  const analysis = analyzeCaptures(yearCaptures);
  
  // Generate explanatory text for each section
  analysis.executiveSummaryText = generateExecutiveSummary(analysis, year);
  analysis.speciesAnalysisText = generateSpeciesAnalysis(analysis);
  analysis.demographicsAnalysisText = generateDemographicsAnalysis(analysis);
  analysis.temporalAnalysisText = generateTemporalAnalysis(analysis, year);
  analysis.biometricAnalysisText = generateBiometricAnalysis(analysis);

  // Multi-variable analyses on current-year captures
  analysis.sexRatios = analyzeSexRatiosBySpecies(yearCaptures);
  analysis.ageRatios = analyzeAgeRatiosBySpecies(yearCaptures);
  analysis.morphometrics = analyzeMorphometricCorrelations(yearCaptures);
  analysis.weeklyPatterns = analyzeCaptureTimingPatterns(yearCaptures);
  analysis.recaptureIntervals = analyzeRecaptureIntervals(allCaptures, year);
  analysis.netUsage = analyzeNetUsage(yearCaptures);
  analysis.banderProductivity = analyzeBanderProductivity(yearCaptures);

  // New multi-variable data sets
  analysis.speciesAgeSex = analyzeSpeciesByAgeSex(yearCaptures);
  analysis.fatDemographics = analyzeFatScoresByDemographics(yearCaptures);
  analysis.weightPatterns = analyzeWeightPatterns(yearCaptures);
  analysis.netMonth = analyzeNetEfficiencyByMonth(yearCaptures);
  analysis.hourlyPatterns = analyzeCaptureTimePatterns(yearCaptures);
  analysis.speciesCoOccurrence = analyzeSpeciesCoOccurrence(yearCaptures, 10);
  analysis.bodyCondition = analyzeBodyConditionIndex(yearCaptures);
  analysis.recaptureByNet = analyzeRecaptureRatesByNet(yearCaptures);
  analysis.dailyRates = analyzeDailyCaptureRates(yearCaptures);
  analysis.speciesAccumulation = analyzeSpeciesAccumulation(yearCaptures);
  analysis.banderSpecialization = analyzeBanderSpecialization(yearCaptures);
  
  // Multi-year trend analysis
  const multiYearTrends = analyzeMultiYearTrends(allCaptures, year);
  const diversity = analyzeSpeciesDiversity(allCaptures, year);
  const effort = analyzeCaptureEffort(allCaptures, year);
  const speciesTrends = analyzeTopSpeciesTrends(allCaptures, 5);
  
  analysis.trendsAnalysisText = generateTrendsAnalysis(multiYearTrends, year);
  
  const multiYearData = {
    yearlyMetrics: multiYearTrends.yearlyMetrics,
    trends: multiYearTrends.trends,
    diversity,
    effort,
    speciesTrends,
  };
  
  console.log('Data analysis complete');

  // Generate charts
  const chartPaths = await generateCharts(yearCaptures, analysis, year);
  console.log('Charts generated');

  // Create the PDF document
  const doc = <AnnualReportDocument data={{ year, captures: yearCaptures, program, multiYearData }} analysis={analysis} chartPaths={chartPaths} />;

  // Generate PDF
  const asPdf = pdf(doc);
  const blob = await asPdf.toBlob();
  const buffer = Buffer.from(await blob.arrayBuffer());

  // Save to file
  const finalOutputPath =
    outputPath || path.join(process.cwd(), 'reports', `annual-report-${year}${program ? `-${program}` : ''}.pdf`);

  const dir = path.dirname(finalOutputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(finalOutputPath, buffer);
  console.log(`Report saved to: ${finalOutputPath}`);

  return finalOutputPath;
}
