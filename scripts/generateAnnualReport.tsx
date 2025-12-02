import * as React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image, Link } from '@react-pdf/renderer';
import { Capture } from '../src/types';
import {
  analyzeCaptures,
  generateCharts,
  analyzeMultiYearTrends,
  analyzeSpeciesDiversity,
  analyzeCaptureEffort,
  analyzeTopSpeciesTrends,
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
  analyzeDetailedReturns,
  analyzeNetUsageDetailed,
  analyzeReturnsBySeason,
  analyzeSpeciesTotalsDetailed,
  analyzeEffortByMonth,
  analyzeNotableCaptures,
} from './reportUtils';
import * as fs from 'fs';
import * as path from 'path';

// MBO Brand Colors
const colors = {
  primary: '#1a5f2a',      // Dark green
  secondary: '#2e7d32',    // Medium green
  accent: '#4caf50',       // Light green
  text: '#333333',
  lightGray: '#f5f5f5',
  mediumGray: '#e0e0e0',
  darkGray: '#666666',
  white: '#ffffff',
  highlight: '#fff9c4',    // Light yellow for highlighting
};

// Professional styles matching MBO report format
const styles = StyleSheet.create({
  // Page styles
  page: {
    padding: 40,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: colors.text,
  },
  coverPage: {
    padding: 0,
    backgroundColor: colors.white,
  },

  // Cover page elements
  coverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 10,
  },
  coverSubtitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  coverYear: {
    fontSize: 48,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 60,
  },
  coverInfo: {
    fontSize: 12,
    color: colors.darkGray,
    textAlign: 'center',
    marginTop: 20,
  },

  // Headers and titles
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 10,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  headerYear: {
    fontSize: 10,
    color: colors.darkGray,
  },

  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginBottom: 10,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  subsectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.secondary,
    marginTop: 10,
    marginBottom: 6,
  },
  subsubsectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
    marginTop: 6,
    marginBottom: 4,
  },

  // Content styles
  paragraph: {
    fontSize: 8,
    lineHeight: 1.4,
    marginBottom: 6,
    textAlign: 'justify',
  },
  highlightBox: {
    backgroundColor: colors.lightGray,
    padding: 10,
    marginVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  highlightText: {
    fontSize: 7,
    lineHeight: 1.3,
  },

  // Statistics boxes
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.lightGray,
    padding: 8,
    marginHorizontal: 3,
    alignItems: 'center',
    borderRadius: 3,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 7,
    color: colors.darkGray,
    marginTop: 2,
    textAlign: 'center',
  },

  // Tables
  table: {
    marginVertical: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  tableHeaderCell: {
    color: colors.white,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.mediumGray,
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.mediumGray,
    paddingVertical: 3,
    paddingHorizontal: 2,
    backgroundColor: colors.lightGray,
  },
  tableRowHighlight: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.mediumGray,
    paddingVertical: 3,
    paddingHorizontal: 2,
    backgroundColor: colors.highlight,
  },
  tableCell: {
    flex: 1,
    fontSize: 7,
    textAlign: 'center',
  },
  tableCellLeft: {
    flex: 2,
    fontSize: 7,
    textAlign: 'left',
  },
  tableCellBold: {
    flex: 1,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },

  // Charts
  chartContainer: {
    marginVertical: 8,
    alignItems: 'center',
  },
  chart: {
    width: '100%',
    height: 160,
  },
  chartCaption: {
    fontSize: 7,
    color: colors.darkGray,
    textAlign: 'center',
    marginTop: 3,
    fontStyle: 'italic',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: colors.mediumGray,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 6,
    color: colors.darkGray,
  },
  pageNumber: {
    fontSize: 6,
    color: colors.darkGray,
  },

  // Two-column layout
  twoColumn: {
    flexDirection: 'row',
    gap: 20,
  },
  column: {
    flex: 1,
  },

  // Species account cards
  speciesCard: {
    marginBottom: 8,
    padding: 6,
    backgroundColor: colors.lightGray,
    borderRadius: 3,
  },
  speciesName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginBottom: 3,
  },
  speciesStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  speciesStat: {
    fontSize: 7,
  },

  // TOC styles
  tocEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lightGray,
    borderBottomStyle: 'dotted',
  },
  tocTitle: {
    fontSize: 8,
  },
  tocPage: {
    fontSize: 8,
    color: colors.darkGray,
  },
  tocSection: {
    marginTop: 6,
    marginBottom: 3,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  // Table note style
  tableNote: {
    fontSize: 6,
    color: colors.darkGray,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Compact table styles
  tableHeaderSmall: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 3,
    paddingHorizontal: 1,
  },
  tableHeaderCellSmall: {
    color: colors.white,
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    textAlign: 'center',
  },
  tableCellSmall: {
    flex: 1,
    fontSize: 6,
    textAlign: 'center',
  },
});

interface ReportData {
  year: number;
  captures: Capture[];
  program?: string;
  multiYearData?: any;
  springCaptures?: Capture[];
  fallCaptures?: Capture[];
  mapsCaptures?: Capture[];
}

// Helper to format numbers with commas
const formatNumber = (num: number) => num.toLocaleString();

// Helper to get season from date
const getSeason = (date: string): 'spring' | 'fall' | 'maps' | 'other' => {
  const month = new Date(date).getMonth() + 1;
  if (month >= 4 && month <= 5) return 'spring';
  if (month >= 6 && month <= 7) return 'maps';
  if (month >= 8 && month <= 11) return 'fall';
  return 'other';
};

// Page Header Component
const PageHeader: React.FC<{ title: string; year: number }> = ({ title, year }) => (
  <View style={styles.pageHeader}>
    <Text style={styles.headerTitle}>McGill Bird Observatory</Text>
    <Text style={styles.headerYear}>{title} • {year}</Text>
  </View>
);

// Page Footer Component
const PageFooter: React.FC<{ pageNum: number }> = ({ pageNum }) => (
  <View style={styles.footer}>
    <Text style={styles.footerText}>McGill Bird Observatory Annual Report</Text>
    <Text style={styles.pageNumber}>{pageNum}</Text>
  </View>
);

// Statistics Box Row Component
const StatsRow: React.FC<{ stats: Array<{ value: string | number; label: string }> }> = ({ stats }) => (
  <View style={styles.statsRow}>
    {stats.map((stat, idx) => (
      <View key={idx} style={styles.statBox}>
        <Text style={styles.statValue}>{typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}</Text>
        <Text style={styles.statLabel}>{stat.label}</Text>
      </View>
    ))}
  </View>
);

// Main PDF Document Component
const AnnualReportDocument: React.FC<{ data: ReportData; analysis: any; chartPaths: any }> = ({
  data,
  analysis,
  chartPaths,
}) => {
  // Separate captures by season
  const springCaptures = data.captures.filter(c => getSeason(c.date) === 'spring');
  const fallCaptures = data.captures.filter(c => getSeason(c.date) === 'fall');
  const mapsCaptures = data.captures.filter(c => getSeason(c.date) === 'maps');

  // Calculate season-specific stats
  const springStats = springCaptures.length > 0 ? analyzeCaptures(springCaptures) : null;
  const fallStats = fallCaptures.length > 0 ? analyzeCaptures(fallCaptures) : null;
  const mapsStats = mapsCaptures.length > 0 ? analyzeCaptures(mapsCaptures) : null;

  let pageNum = 0;

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverContainer}>
          <Text style={styles.coverTitle}>McGill Bird Observatory</Text>
          <Text style={styles.coverSubtitle}>Annual Report</Text>
          <Text style={styles.coverYear}>{data.year}</Text>
          
          <View style={{ marginTop: 40 }}>
            <Text style={styles.coverInfo}>Migration Monitoring &amp; MAPS Banding Station</Text>
            <Text style={styles.coverInfo}>Ste-Anne-de-Bellevue, Quebec, Canada</Text>
          </View>

          <View style={{ marginTop: 60 }}>
            <Text style={[styles.coverInfo, { fontSize: 10 }]}>
              A project of The Migration Research Foundation Inc.
            </Text>
          </View>

          <View style={{ position: 'absolute', bottom: 60, width: '100%' }}>
            <Text style={[styles.coverInfo, { fontSize: 9 }]}>
              www.migrationresearch.org
            </Text>
          </View>
        </View>
      </Page>

      {/* Table of Contents */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Table of Contents</Text>
        
        <View style={{ marginTop: 20 }}>
          <Text style={styles.tocSection}>Overview</Text>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Season Summary</Text>
            <Text style={styles.tocPage}>3</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Key Highlights</Text>
            <Text style={styles.tocPage}>3</Text>
          </View>

          <Text style={styles.tocSection}>Seasonal Reports</Text>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Spring Migration (April–May)</Text>
            <Text style={styles.tocPage}>4</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>MAPS Breeding Season (June–July)</Text>
            <Text style={styles.tocPage}>5</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Fall Migration (August–November)</Text>
            <Text style={styles.tocPage}>6</Text>
          </View>

          <Text style={styles.tocSection}>Detailed Analysis</Text>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Species Accounts</Text>
            <Text style={styles.tocPage}>7</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Banding Totals by Species</Text>
            <Text style={styles.tocPage}>8</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Age and Sex Demographics</Text>
            <Text style={styles.tocPage}>9</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Recaptures and Returns</Text>
            <Text style={styles.tocPage}>10</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Detailed Returns by Season</Text>
            <Text style={styles.tocPage}>11-13</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Net Usage and Capture Rates</Text>
            <Text style={styles.tocPage}>14</Text>
          </View>

          <Text style={styles.tocSection}>Long-term Trends</Text>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Multi-year Population Trends</Text>
            <Text style={styles.tocPage}>15</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Species Diversity Analysis</Text>
            <Text style={styles.tocPage}>16</Text>
          </View>

          <Text style={styles.tocSection}>Appendices</Text>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Complete Species List</Text>
            <Text style={styles.tocPage}>17</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Acknowledgements</Text>
            <Text style={styles.tocPage}>18</Text>
          </View>
        </View>
        <PageFooter pageNum={2} />
      </Page>

      {/* Season Summary Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Season Summary" year={data.year} />
        
        <Text style={styles.sectionTitle}>{data.year} Season Overview</Text>
        
        <Text style={styles.paragraph}>
          The {data.year} banding season at McGill Bird Observatory was conducted from April through November,
          encompassing spring migration, the MAPS breeding bird monitoring program, and fall migration monitoring.
          This report summarizes the results of our standardized monitoring efforts.
        </Text>

        <StatsRow stats={[
          { value: analysis.totalCaptures, label: 'Total Captures' },
          { value: analysis.uniqueSpecies, label: 'Species Recorded' },
          { value: analysis.newBands, label: 'New Bands' },
          { value: analysis.activeDays, label: 'Active Days' },
        ]} />

        <Text style={styles.subsectionTitle}>Capture Summary</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Capture Type</Text>
            <Text style={styles.tableHeaderCell}>Count</Text>
            <Text style={styles.tableHeaderCell}>Percentage</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLeft}>New Bands</Text>
            <Text style={styles.tableCell}>{formatNumber(analysis.newBands)}</Text>
            <Text style={styles.tableCell}>{((analysis.newBands / analysis.totalCaptures) * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.tableRowAlt}>
            <Text style={styles.tableCellLeft}>Recaptures (same season)</Text>
            <Text style={styles.tableCell}>{formatNumber(analysis.recaptures)}</Text>
            <Text style={styles.tableCell}>{((analysis.recaptures / analysis.totalCaptures) * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLeft}>Returns (previous years)</Text>
            <Text style={styles.tableCell}>{formatNumber(analysis.returns)}</Text>
            <Text style={styles.tableCell}>{((analysis.returns / analysis.totalCaptures) * 100).toFixed(1)}%</Text>
          </View>
        </View>

        <Text style={styles.subsectionTitle}>Seasonal Distribution</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Season</Text>
            <Text style={styles.tableHeaderCell}>Captures</Text>
            <Text style={styles.tableHeaderCell}>Species</Text>
            <Text style={styles.tableHeaderCell}>Days</Text>
          </View>
          {springStats && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLeft}>Spring Migration (Apr–May)</Text>
              <Text style={styles.tableCell}>{formatNumber(springStats.totalCaptures)}</Text>
              <Text style={styles.tableCell}>{springStats.uniqueSpecies}</Text>
              <Text style={styles.tableCell}>{springStats.activeDays}</Text>
            </View>
          )}
          {mapsStats && (
            <View style={styles.tableRowAlt}>
              <Text style={styles.tableCellLeft}>MAPS Season (Jun–Jul)</Text>
              <Text style={styles.tableCell}>{formatNumber(mapsStats.totalCaptures)}</Text>
              <Text style={styles.tableCell}>{mapsStats.uniqueSpecies}</Text>
              <Text style={styles.tableCell}>{mapsStats.activeDays}</Text>
            </View>
          )}
          {fallStats && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLeft}>Fall Migration (Aug–Nov)</Text>
              <Text style={styles.tableCell}>{formatNumber(fallStats.totalCaptures)}</Text>
              <Text style={styles.tableCell}>{fallStats.uniqueSpecies}</Text>
              <Text style={styles.tableCell}>{fallStats.activeDays}</Text>
            </View>
          )}
        </View>

        <Text style={styles.subsectionTitle}>Key Highlights</Text>
        
        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
            • Peak capture day: {analysis.peakMonth} with the highest daily totals{'\n'}
            • Most abundant species: {analysis.topSpecies[0]?.name} ({formatNumber(analysis.topSpecies[0]?.count)} captures){'\n'}
            • Species diversity: {analysis.uniqueSpecies} species recorded across all seasons{'\n'}
            • Return rate: {((analysis.returns / analysis.totalCaptures) * 100).toFixed(1)}% of captures were returning birds
          </Text>
        </View>

        <PageFooter pageNum={3} />
      </Page>

      {/* Spring Migration Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Spring Migration" year={data.year} />
        
        <Text style={styles.sectionTitle}>Spring Migration (April–May)</Text>
        
        {springStats ? (
          <>
            <Text style={styles.paragraph}>
              Spring migration monitoring captured the northward movement of neotropical migrants and 
              short-distance migrants returning to breeding grounds. The spring season recorded 
              {formatNumber(springStats.totalCaptures)} captures of {springStats.uniqueSpecies} species 
              over {springStats.activeDays} monitoring days.
            </Text>

            <StatsRow stats={[
              { value: springStats.totalCaptures, label: 'Spring Captures' },
              { value: springStats.uniqueSpecies, label: 'Species' },
              { value: springStats.newBands, label: 'New Bands' },
            ]} />

            <Text style={styles.subsectionTitle}>Top Spring Migrants</Text>
            
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3, textAlign: 'left' }]}>Species</Text>
                <Text style={styles.tableHeaderCell}>Count</Text>
                <Text style={styles.tableHeaderCell}>% Total</Text>
                <Text style={styles.tableHeaderCell}>New</Text>
                <Text style={styles.tableHeaderCell}>Recap</Text>
              </View>
              {springStats.topSpecies.slice(0, 15).map((species: any, idx: number) => (
                <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={styles.tableCellLeft}>{species.name}</Text>
                  <Text style={styles.tableCell}>{species.count}</Text>
                  <Text style={styles.tableCell}>{species.percentage.toFixed(1)}%</Text>
                  <Text style={styles.tableCell}>{species.new}</Text>
                  <Text style={styles.tableCell}>{species.recaptures}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.paragraph}>No spring migration data available for {data.year}.</Text>
        )}

        <PageFooter pageNum={4} />
      </Page>

      {/* MAPS Season Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="MAPS Program" year={data.year} />
        
        <Text style={styles.sectionTitle}>MAPS Breeding Season (June–July)</Text>
        
        {mapsStats ? (
          <>
            <Text style={styles.paragraph}>
              The Monitoring Avian Productivity and Survivorship (MAPS) program operates during the breeding 
              season to assess local breeding bird populations, productivity (young:adult ratios), and 
              survivorship through standardized mist-netting protocols.
            </Text>

            <StatsRow stats={[
              { value: mapsStats.totalCaptures, label: 'MAPS Captures' },
              { value: mapsStats.uniqueSpecies, label: 'Species' },
              { value: mapsStats.newBands, label: 'New Bands' },
            ]} />

            <Text style={styles.subsectionTitle}>Age Distribution (Breeding Season)</Text>
            
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Age Class</Text>
                <Text style={styles.tableHeaderCell}>Count</Text>
                <Text style={styles.tableHeaderCell}>Percentage</Text>
              </View>
              {Object.entries(mapsStats.ageDistribution).map(([age, count]: [string, any], idx: number) => (
                <View key={age} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={styles.tableCellLeft}>{age || 'Unknown'}</Text>
                  <Text style={styles.tableCell}>{count}</Text>
                  <Text style={styles.tableCell}>{((count / mapsStats.totalCaptures) * 100).toFixed(1)}%</Text>
                </View>
              ))}
            </View>

            <Text style={styles.subsectionTitle}>Top Breeding Species</Text>
            
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3, textAlign: 'left' }]}>Species</Text>
                <Text style={styles.tableHeaderCell}>Count</Text>
                <Text style={styles.tableHeaderCell}>New</Text>
                <Text style={styles.tableHeaderCell}>Returns</Text>
              </View>
              {mapsStats.topSpecies.slice(0, 12).map((species: any, idx: number) => (
                <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={styles.tableCellLeft}>{species.name}</Text>
                  <Text style={styles.tableCell}>{species.count}</Text>
                  <Text style={styles.tableCell}>{species.new}</Text>
                  <Text style={styles.tableCell}>{species.returns || 0}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.paragraph}>No MAPS data available for {data.year}.</Text>
        )}

        <PageFooter pageNum={5} />
      </Page>

      {/* Fall Migration Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Fall Migration" year={data.year} />
        
        <Text style={styles.sectionTitle}>Fall Migration (August–November)</Text>
        
        {fallStats ? (
          <>
            <Text style={styles.paragraph}>
              Fall migration monitoring tracked the southward passage of breeding adults and hatching-year 
              birds. The fall season is typically the busiest period, with larger numbers of young birds 
              captured as they make their first migratory journey.
            </Text>

            <StatsRow stats={[
              { value: fallStats.totalCaptures, label: 'Fall Captures' },
              { value: fallStats.uniqueSpecies, label: 'Species' },
              { value: fallStats.newBands, label: 'New Bands' },
            ]} />

            {chartPaths.monthlyTrendChart && (
              <View style={styles.chartContainer}>
                <Image style={styles.chart} src={chartPaths.monthlyTrendChart} />
                <Text style={styles.chartCaption}>Figure 1. Monthly capture totals for {data.year}</Text>
              </View>
            )}

            <Text style={styles.subsectionTitle}>Top Fall Migrants</Text>
            
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3, textAlign: 'left' }]}>Species</Text>
                <Text style={styles.tableHeaderCell}>Count</Text>
                <Text style={styles.tableHeaderCell}>% Total</Text>
                <Text style={styles.tableHeaderCell}>New</Text>
              </View>
              {fallStats.topSpecies.slice(0, 12).map((species: any, idx: number) => (
                <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={styles.tableCellLeft}>{species.name}</Text>
                  <Text style={styles.tableCell}>{species.count}</Text>
                  <Text style={styles.tableCell}>{species.percentage.toFixed(1)}%</Text>
                  <Text style={styles.tableCell}>{species.new}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.paragraph}>No fall migration data available for {data.year}.</Text>
        )}

        <PageFooter pageNum={6} />
      </Page>

      {/* Species Accounts Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Species Accounts" year={data.year} />
        
        <Text style={styles.sectionTitle}>Notable Species Accounts</Text>
        
        <Text style={styles.paragraph}>
          The following accounts highlight species of particular interest based on capture numbers, 
          population trends, or conservation significance.
        </Text>

        {analysis.topSpecies.slice(0, 6).map((species: any, idx: number) => (
          <View key={idx} style={styles.speciesCard}>
            <Text style={styles.speciesName}>{species.name}</Text>
            <View style={styles.speciesStats}>
              <Text style={styles.speciesStat}>Total: {species.count}</Text>
              <Text style={styles.speciesStat}>New bands: {species.new}</Text>
              <Text style={styles.speciesStat}>Recaptures: {species.recaptures}</Text>
              <Text style={styles.speciesStat}>{species.percentage.toFixed(1)}% of total</Text>
            </View>
            <Text style={[styles.paragraph, { marginBottom: 0, fontSize: 9 }]}>
              {species.name} was {idx === 0 ? 'the most abundant species' : `the #${idx + 1} most captured species`} 
              {' '}during the {data.year} season, representing {species.percentage.toFixed(1)}% of all captures.
              {species.recaptures > 0 ? ` The recapture rate of ${((species.recaptures / species.count) * 100).toFixed(1)}% indicates site fidelity during the monitoring period.` : ''}
            </Text>
          </View>
        ))}

        <PageFooter pageNum={7} />
      </Page>

      {/* Complete Banding Totals Page - Full species breakdown */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Banding Totals" year={data.year} />
        
        <Text style={styles.sectionTitle}>Complete Banding Totals by Species</Text>
        
        <Text style={styles.paragraph}>
          Complete capture totals for all species banded during the {data.year} season, including 
          breakdown by capture type and demographics.
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Species</Text>
            <Text style={styles.tableHeaderCell}>Total</Text>
            <Text style={styles.tableHeaderCell}>Banded</Text>
            <Text style={styles.tableHeaderCell}>Returns</Text>
            <Text style={styles.tableHeaderCell}>Repeats</Text>
            <Text style={styles.tableHeaderCell}>M</Text>
            <Text style={styles.tableHeaderCell}>F</Text>
            <Text style={styles.tableHeaderCell}>U</Text>
            <Text style={styles.tableHeaderCell}>HY</Text>
            <Text style={styles.tableHeaderCell}>AHY+</Text>
          </View>
          {analysis.speciesTotals?.slice(0, 35).map((species: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 2, textAlign: 'left', fontSize: 6 }]}>{species.species}</Text>
              <Text style={[styles.tableCellBold, { fontSize: 6 }]}>{species.total}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.banded}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.returns}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.repeats}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.male}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.female}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.unknown}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.hy}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.ahy}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.tableNote}>
          M = Male, F = Female, U = Unknown sex, HY = Hatch Year, AHY+ = After Hatch Year and older
        </Text>

        <PageFooter pageNum={8} />
      </Page>

      {/* Additional Species Totals (Continued) */}
      {analysis.speciesTotals && analysis.speciesTotals.length > 35 && (
        <Page size="A4" style={styles.page}>
          <PageHeader title="Banding Totals (cont.)" year={data.year} />
          
          <Text style={styles.sectionTitle}>Complete Banding Totals by Species (continued)</Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Species</Text>
              <Text style={styles.tableHeaderCell}>Total</Text>
              <Text style={styles.tableHeaderCell}>Banded</Text>
              <Text style={styles.tableHeaderCell}>Returns</Text>
              <Text style={styles.tableHeaderCell}>Repeats</Text>
              <Text style={styles.tableHeaderCell}>M</Text>
              <Text style={styles.tableHeaderCell}>F</Text>
              <Text style={styles.tableHeaderCell}>U</Text>
              <Text style={styles.tableHeaderCell}>HY</Text>
              <Text style={styles.tableHeaderCell}>AHY+</Text>
            </View>
            {analysis.speciesTotals?.slice(35, 70).map((species: any, idx: number) => (
              <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.tableCell, { flex: 2, textAlign: 'left', fontSize: 6 }]}>{species.species}</Text>
                <Text style={[styles.tableCellBold, { fontSize: 6 }]}>{species.total}</Text>
                <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.banded}</Text>
                <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.returns}</Text>
                <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.repeats}</Text>
                <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.male}</Text>
                <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.female}</Text>
                <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.unknown}</Text>
                <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.hy}</Text>
                <Text style={[styles.tableCell, { fontSize: 6 }]}>{species.ahy}</Text>
              </View>
            ))}
          </View>

          {/* Totals Row */}
          <View style={[styles.table, { marginTop: 6 }]}>
            <View style={styles.tableRowHighlight}>
              <Text style={[styles.tableCell, { flex: 2, textAlign: 'left', fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>TOTALS</Text>
              <Text style={[styles.tableCellBold, { fontSize: 6 }]}>{analysis.totalCaptures}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.newBands}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.returns}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.recaptures}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.sexDistribution?.['M'] || 0}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.sexDistribution?.['F'] || 0}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.sexDistribution?.['U'] || 0}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>-</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>-</Text>
            </View>
          </View>

          <PageFooter pageNum={9} />
        </Page>
      )}

      {/* Demographics Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Demographics" year={data.year} />
        
        <Text style={styles.sectionTitle}>Age and Sex Demographics</Text>

        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Text style={styles.subsectionTitle}>Age Distribution</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Age</Text>
                <Text style={styles.tableHeaderCell}>Count</Text>
                <Text style={styles.tableHeaderCell}>%</Text>
              </View>
              {Object.entries(analysis.ageDistribution).map(([age, count]: [string, any], idx: number) => (
                <View key={age} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={styles.tableCellLeft}>{age || 'Unknown'}</Text>
                  <Text style={styles.tableCell}>{count}</Text>
                  <Text style={styles.tableCell}>{((count / analysis.totalCaptures) * 100).toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.subsectionTitle}>Sex Distribution</Text>
            {chartPaths.demographicsChart && (
              <Image style={{ width: '100%', height: 100 }} src={chartPaths.demographicsChart} />
            )}
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Sex</Text>
                <Text style={styles.tableHeaderCell}>Count</Text>
                <Text style={styles.tableHeaderCell}>%</Text>
              </View>
              {Object.entries(analysis.sexDistribution).map(([sex, count]: [string, any], idx: number) => (
                <View key={sex} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={styles.tableCellLeft}>{sex || 'Unknown'}</Text>
                  <Text style={styles.tableCell}>{count}</Text>
                  <Text style={styles.tableCell}>{((count / analysis.totalCaptures) * 100).toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.subsectionTitle}>Age Ratios by Species (n≥10)</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2.5, textAlign: 'left' }]}>Species</Text>
            <Text style={styles.tableHeaderCell}>HY</Text>
            <Text style={styles.tableHeaderCell}>AHY+</Text>
            <Text style={styles.tableHeaderCell}>Y:A</Text>
            <Text style={styles.tableHeaderCell}>n</Text>
          </View>
          {analysis.ageRatios?.slice(0, 12).map((ratio: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 2.5, textAlign: 'left', fontSize: 6 }]}>{ratio.species}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{ratio.young}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{ratio.adult}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{ratio.ratio}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{ratio.total}</Text>
            </View>
          ))}
        </View>

        <PageFooter pageNum={9} />
      </Page>

      {/* Monthly Effort Summary Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Effort Summary" year={data.year} />
        
        <Text style={styles.sectionTitle}>Monthly Effort and Capture Summary</Text>
        
        <Text style={styles.paragraph}>
          Summary of banding effort and captures by month. Net-hours are estimated based on active 
          days and standard net operation (12 nets × 6 hours/day).
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'left' }]}>Month</Text>
            <Text style={styles.tableHeaderCell}>Days</Text>
            <Text style={styles.tableHeaderCell}>Net-Hours</Text>
            <Text style={styles.tableHeaderCell}>Total Cap</Text>
            <Text style={styles.tableHeaderCell}>Banded</Text>
            <Text style={styles.tableHeaderCell}>Recaps</Text>
            <Text style={styles.tableHeaderCell}>Species</Text>
            <Text style={styles.tableHeaderCell}>B/100h</Text>
          </View>
          {analysis.effortByMonth?.map((m: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'left', fontSize: 6 }]}>{m.month}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.days}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.netHours}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.captures}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.newBands}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.recaps}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.species}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.capturesPerHour}</Text>
            </View>
          ))}
        </View>

        {chartPaths.monthlyTrendChart && (
          <View style={styles.chartContainer}>
            <Image style={styles.chart} src={chartPaths.monthlyTrendChart} />
            <Text style={styles.chartCaption}>Figure 1. Monthly capture totals for {data.year}</Text>
          </View>
        )}

        <Text style={styles.subsectionTitle}>Sex Ratios by Species (n≥10)</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Species</Text>
            <Text style={styles.tableHeaderCell}>Male</Text>
            <Text style={styles.tableHeaderCell}>Female</Text>
            <Text style={styles.tableHeaderCell}>Unknown</Text>
            <Text style={styles.tableHeaderCell}>M:F</Text>
            <Text style={styles.tableHeaderCell}>n</Text>
          </View>
          {analysis.sexRatios?.slice(0, 10).map((ratio: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 2, textAlign: 'left', fontSize: 6 }]}>{ratio.species}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{ratio.male}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{ratio.female}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{ratio.unknown}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{ratio.ratio}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{ratio.total}</Text>
            </View>
          ))}
        </View>

        <PageFooter pageNum={10} />
      </Page>

      {/* Recaptures and Returns Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Recaptures & Returns" year={data.year} />
        
        <Text style={styles.sectionTitle}>Recaptures and Returns</Text>
        
        <Text style={styles.paragraph}>
          Recapture data provides valuable information on site fidelity, local movements, and minimum 
          longevity. Returns represent birds banded in previous years and recaptured in {data.year}.
        </Text>

        <Text style={styles.subsectionTitle}>Longevity Records</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2.5, textAlign: 'left' }]}>Species</Text>
            <Text style={styles.tableHeaderCell}>Recaps</Text>
            <Text style={styles.tableHeaderCell}>Min Days</Text>
            <Text style={styles.tableHeaderCell}>Avg Days</Text>
            <Text style={styles.tableHeaderCell}>Max Days</Text>
            <Text style={styles.tableHeaderCell}>Max Years</Text>
          </View>
          {analysis.recaptureIntervals?.slice(0, 12).map((interval: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 2.5, textAlign: 'left', fontSize: 6 }]}>{interval.species}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{interval.count}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{interval.minDays}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{interval.avgDays}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{interval.maxDays}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{interval.maxYears}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.subsectionTitle}>Net Location Efficiency</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'left' }]}>Net</Text>
            <Text style={styles.tableHeaderCell}>Captures</Text>
            <Text style={styles.tableHeaderCell}>Species</Text>
            <Text style={styles.tableHeaderCell}>New</Text>
            <Text style={styles.tableHeaderCell}>Recaps</Text>
            <Text style={styles.tableHeaderCell}>Recap %</Text>
          </View>
          {analysis.netUsage?.slice(0, 10).map((net: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'left', fontSize: 6 }]}>{net.net}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{net.captures}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{net.species}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{net.newBands}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{net.recaptures}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{net.recaptureRate}%</Text>
            </View>
          ))}
        </View>

        <PageFooter pageNum={11} />
      </Page>

      {/* Detailed Returns by Season - MBO Table 6.5 format */}
      {analysis.returnsBySeason && Object.keys(analysis.returnsBySeason).length > 0 && (
        <>
          {/* Spring Migration Returns */}
          {analysis.returnsBySeason['Spring Migration'] && analysis.returnsBySeason['Spring Migration'].length > 0 && (
            <Page size="A4" style={styles.page}>
              <PageHeader title="Spring Returns" year={data.year} />
              
              <Text style={styles.sectionTitle}>Returns – Spring Migration</Text>
              
              <Text style={styles.paragraph}>
                List of returns captured during the {data.year} spring migration monitoring, 
                sorted by time elapsed since original banding.
              </Text>

              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'left' }]}>Band #</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'left' }]}>Species</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Age/Sex {data.year}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Age/Sex Band</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Banding</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Prev. Cap</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>{data.year}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Time Elapsed</Text>
                </View>
                {analysis.returnsBySeason['Spring Migration'].slice(0, 35).map((ret: any, idx: number) => (
                  <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'left', fontSize: 6 }]}>{ret.bandId}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'left', fontSize: 6 }]}>{ret.species}</Text>
                    <Text style={[styles.tableCell, { flex: 0.7, fontSize: 6 }]}>{ret.ageSexNow}</Text>
                    <Text style={[styles.tableCell, { flex: 0.7, fontSize: 6 }]}>{ret.ageSexBanding}</Text>
                    <Text style={[styles.tableCell, { flex: 0.9, fontSize: 6 }]}>{ret.bandingDate}</Text>
                    <Text style={[styles.tableCell, { flex: 0.9, fontSize: 6 }]}>{ret.previousCapture}</Text>
                    <Text style={[styles.tableCell, { flex: 0.6, fontSize: 6 }]}>{ret.returnDate}</Text>
                    <Text style={[styles.tableCell, { flex: 1.2, fontSize: 5 }]}>{ret.yearsElapsed > 0 ? `${ret.yearsElapsed}y` : ''}{ret.monthsElapsed > 0 ? ` ${ret.monthsElapsed}m` : ''}{ret.daysElapsed > 0 ? ` ${ret.daysElapsed}d` : ''}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.tableNote}>
                Total spring returns: {analysis.returnsBySeason['Spring Migration'].length} birds. 
                Longest return: {analysis.returnsBySeason['Spring Migration'][0]?.timeElapsedText || 'N/A'}
              </Text>

              <PageFooter pageNum={11} />
            </Page>
          )}

          {/* MAPS/Breeding Season Returns */}
          {analysis.returnsBySeason['MAPS/Breeding'] && analysis.returnsBySeason['MAPS/Breeding'].length > 0 && (
            <Page size="A4" style={styles.page}>
              <PageHeader title="MAPS Returns" year={data.year} />
              
              <Text style={styles.sectionTitle}>Returns – MAPS/Breeding Season</Text>
              
              <Text style={styles.paragraph}>
                List of returns captured during the {data.year} MAPS breeding season, sorted by time elapsed.
              </Text>

              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'left' }]}>Band #</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'left' }]}>Species</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Age/Sex {data.year}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Age/Sex Band</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Banding</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Prev. Cap</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>{data.year}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Time Elapsed</Text>
                </View>
                {analysis.returnsBySeason['MAPS/Breeding'].slice(0, 35).map((ret: any, idx: number) => (
                  <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'left', fontSize: 6 }]}>{ret.bandId}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'left', fontSize: 6 }]}>{ret.species}</Text>
                    <Text style={[styles.tableCell, { flex: 0.7, fontSize: 6 }]}>{ret.ageSexNow}</Text>
                    <Text style={[styles.tableCell, { flex: 0.7, fontSize: 6 }]}>{ret.ageSexBanding}</Text>
                    <Text style={[styles.tableCell, { flex: 0.9, fontSize: 6 }]}>{ret.bandingDate}</Text>
                    <Text style={[styles.tableCell, { flex: 0.9, fontSize: 6 }]}>{ret.previousCapture}</Text>
                    <Text style={[styles.tableCell, { flex: 0.6, fontSize: 6 }]}>{ret.returnDate}</Text>
                    <Text style={[styles.tableCell, { flex: 1.2, fontSize: 5 }]}>{ret.yearsElapsed > 0 ? `${ret.yearsElapsed}y` : ''}{ret.monthsElapsed > 0 ? ` ${ret.monthsElapsed}m` : ''}{ret.daysElapsed > 0 ? ` ${ret.daysElapsed}d` : ''}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.tableNote}>
                Total MAPS returns: {analysis.returnsBySeason['MAPS/Breeding'].length} birds. 
                Longest return: {analysis.returnsBySeason['MAPS/Breeding'][0]?.timeElapsedText || 'N/A'}
              </Text>

              <PageFooter pageNum={12} />
            </Page>
          )}

          {/* Fall Migration Returns */}
          {analysis.returnsBySeason['Fall Migration'] && analysis.returnsBySeason['Fall Migration'].length > 0 && (
            <Page size="A4" style={styles.page}>
              <PageHeader title="Fall Returns" year={data.year} />
              
              <Text style={styles.sectionTitle}>Returns – Fall Migration</Text>
              
              <Text style={styles.paragraph}>
                List of returns captured during the {data.year} fall migration monitoring, sorted by time elapsed.
              </Text>

              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'left' }]}>Band #</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'left' }]}>Species</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Age/Sex {data.year}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Age/Sex Band</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Banding</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Prev. Cap</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>{data.year}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Time Elapsed</Text>
                </View>
                {analysis.returnsBySeason['Fall Migration'].slice(0, 35).map((ret: any, idx: number) => (
                  <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'left', fontSize: 6 }]}>{ret.bandId}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'left', fontSize: 6 }]}>{ret.species}</Text>
                    <Text style={[styles.tableCell, { flex: 0.7, fontSize: 6 }]}>{ret.ageSexNow}</Text>
                    <Text style={[styles.tableCell, { flex: 0.7, fontSize: 6 }]}>{ret.ageSexBanding}</Text>
                    <Text style={[styles.tableCell, { flex: 0.9, fontSize: 6 }]}>{ret.bandingDate}</Text>
                    <Text style={[styles.tableCell, { flex: 0.9, fontSize: 6 }]}>{ret.previousCapture}</Text>
                    <Text style={[styles.tableCell, { flex: 0.6, fontSize: 6 }]}>{ret.returnDate}</Text>
                    <Text style={[styles.tableCell, { flex: 1.2, fontSize: 5 }]}>{ret.yearsElapsed > 0 ? `${ret.yearsElapsed}y` : ''}{ret.monthsElapsed > 0 ? ` ${ret.monthsElapsed}m` : ''}{ret.daysElapsed > 0 ? ` ${ret.daysElapsed}d` : ''}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.tableNote}>
                Total fall returns: {analysis.returnsBySeason['Fall Migration'].length} birds. 
                Longest return: {analysis.returnsBySeason['Fall Migration'][0]?.timeElapsedText || 'N/A'}
              </Text>

              <PageFooter pageNum={13} />
            </Page>
          )}
        </>
      )}

      {/* Net Usage and Capture Rates - MBO Table 4.7 format */}
      {analysis.netUsageDetailed && (
        <Page size="A4" style={styles.page}>
          <PageHeader title="Net Usage" year={data.year} />
          
          <Text style={styles.sectionTitle}>Net Usage and Capture Rates</Text>
          
          <Text style={styles.paragraph}>
            Analysis of net efficiency and capture rates by net location. Capture rates are expressed 
            as birds per 100 net-hours. Shaded rows indicate subtotals for grouped net locations.
          </Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'left' }]}>Net</Text>
              <Text style={styles.tableHeaderCell}>Hours Open</Text>
              <Text style={styles.tableHeaderCell}>New Captures</Text>
              <Text style={styles.tableHeaderCell}>Returns + Repeats</Text>
              <Text style={styles.tableHeaderCell}>Total Captures</Text>
              <Text style={styles.tableHeaderCell}>Birds/100h New</Text>
              <Text style={styles.tableHeaderCell}>Birds/100h Total</Text>
            </View>
            {analysis.netUsageDetailed.nets?.map((net: any, idx: number) => (
              <View key={idx} style={net.isSubtotal ? styles.tableRowHighlight : (idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt)}>
                <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'left', fontSize: 6, fontFamily: net.isSubtotal ? 'Helvetica-Bold' : 'Helvetica' }]}>{net.net}</Text>
                <Text style={[styles.tableCell, { fontSize: 6, fontFamily: net.isSubtotal ? 'Helvetica-Bold' : 'Helvetica' }]}>{net.hoursOpen}</Text>
                <Text style={[styles.tableCell, { fontSize: 6, fontFamily: net.isSubtotal ? 'Helvetica-Bold' : 'Helvetica' }]}>{net.newCaptures}</Text>
                <Text style={[styles.tableCell, { fontSize: 6, fontFamily: net.isSubtotal ? 'Helvetica-Bold' : 'Helvetica' }]}>{net.returnsRepeats}</Text>
                <Text style={[styles.tableCell, { fontSize: 6, fontFamily: net.isSubtotal ? 'Helvetica-Bold' : 'Helvetica' }]}>{net.totalCaptures}</Text>
                <Text style={[styles.tableCell, { fontSize: 6, fontFamily: net.isSubtotal ? 'Helvetica-Bold' : 'Helvetica' }]}>{net.birdsPerHourNew}</Text>
                <Text style={[styles.tableCell, { fontSize: 6, fontFamily: net.isSubtotal ? 'Helvetica-Bold' : 'Helvetica' }]}>{net.birdsPerHourTotal}</Text>
              </View>
            ))}
            
            {/* Grand Total */}
            <View style={styles.tableRowHighlight}>
              <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'left', fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.netUsageDetailed.grandTotal?.net}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.netUsageDetailed.grandTotal?.hoursOpen}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.netUsageDetailed.grandTotal?.newCaptures}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.netUsageDetailed.grandTotal?.returnsRepeats}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.netUsageDetailed.grandTotal?.totalCaptures}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.netUsageDetailed.grandTotal?.birdsPerHourNew}</Text>
              <Text style={[styles.tableCell, { fontSize: 6, fontFamily: 'Helvetica-Bold' }]}>{analysis.netUsageDetailed.grandTotal?.birdsPerHourTotal}</Text>
            </View>
          </View>

          <Text style={styles.tableNote}>
            ¹ – Total captures include new captures, returns, repeats, and foreign recaptures.
            Net hours estimated at 6 hours per active day per net.
          </Text>

          <PageFooter pageNum={14} />
        </Page>
      )}

      {/* Biometrics and Morphometrics Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Biometrics" year={data.year} />
        
        <Text style={styles.sectionTitle}>Morphometric Measurements</Text>
        
        <Text style={styles.paragraph}>
          Average weight and wing chord measurements for species with adequate sample sizes (n≥10). 
          Standard deviation (SD) indicates variation within each species.
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Species</Text>
            <Text style={styles.tableHeaderCell}>Avg Wt (g)</Text>
            <Text style={styles.tableHeaderCell}>Wt SD</Text>
            <Text style={styles.tableHeaderCell}>Wt Range</Text>
            <Text style={styles.tableHeaderCell}>Avg Wing</Text>
            <Text style={styles.tableHeaderCell}>Wing SD</Text>
            <Text style={styles.tableHeaderCell}>Wing Range</Text>
            <Text style={styles.tableHeaderCell}>n</Text>
          </View>
          {analysis.morphometrics?.slice(0, 20).map((m: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 2, textAlign: 'left', fontSize: 6 }]}>{m.species}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.avgWeight}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.weightSD}</Text>
              <Text style={[styles.tableCell, { fontSize: 5 }]}>{m.weightRange}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.avgWing}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.wingSD}</Text>
              <Text style={[styles.tableCell, { fontSize: 5 }]}>{m.wingRange}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{m.count}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.subsectionTitle}>Weight by Age and Sex (n≥20)</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Species</Text>
            <Text style={styles.tableHeaderCell}>Male</Text>
            <Text style={styles.tableHeaderCell}>Female</Text>
            <Text style={styles.tableHeaderCell}>HY</Text>
            <Text style={styles.tableHeaderCell}>AHY+</Text>
            <Text style={styles.tableHeaderCell}>n</Text>
          </View>
          {analysis.weightPatterns?.slice(0, 12).map((w: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 2, textAlign: 'left', fontSize: 6 }]}>{w.species}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{w.male}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{w.female}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{w.young}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{w.adult}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{w.n}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.subsectionTitle}>Body Condition Index (Weight/Wing)</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>Species</Text>
            <Text style={styles.tableHeaderCell}>Avg BCI</Text>
            <Text style={styles.tableHeaderCell}>CV (%)</Text>
            <Text style={styles.tableHeaderCell}>Avg Wt</Text>
            <Text style={styles.tableHeaderCell}>Avg Wing</Text>
            <Text style={styles.tableHeaderCell}>n</Text>
          </View>
          {analysis.bodyCondition?.slice(0, 10).map((b: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 2, textAlign: 'left', fontSize: 6 }]}>{b.species}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{b.avgRatio}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{b.cv}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{b.avgWeight}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{b.avgWing}</Text>
              <Text style={[styles.tableCell, { fontSize: 6 }]}>{b.n}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.tableNote}>
          BCI = Body Condition Index (weight/wing × 100). CV = Coefficient of Variation.
        </Text>

        <PageFooter pageNum={15} />
      </Page>

      {/* Multi-Year Trends Page */}
      {data.multiYearData && (
        <>
          <Page size="A4" style={styles.page}>
            <PageHeader title="Long-term Trends" year={data.year} />
            
            <Text style={styles.sectionTitle}>Long-term Population Trends</Text>
            
            <Text style={styles.paragraph}>
              Multi-year data allows assessment of population trends and changes in species composition 
              over time. The following tables summarize key metrics across recent years of monitoring.
            </Text>

            <Text style={styles.subsectionTitle}>Annual Summary (Last 10 Years)</Text>
            
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Year</Text>
                <Text style={styles.tableHeaderCell}>Total</Text>
                <Text style={styles.tableHeaderCell}>Species</Text>
                <Text style={styles.tableHeaderCell}>New</Text>
                <Text style={styles.tableHeaderCell}>Returns</Text>
                <Text style={styles.tableHeaderCell}>Y:A</Text>
              </View>
              {data.multiYearData.yearlyMetrics?.slice(-10).map((metric: any, idx: number) => (
                <View 
                  key={metric.year} 
                  style={metric.year === data.year ? styles.tableRowHighlight : (idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt)}
                >
                  <Text style={styles.tableCellBold}>{metric.year}</Text>
                  <Text style={styles.tableCell}>{formatNumber(metric.totalCaptures)}</Text>
                  <Text style={styles.tableCell}>{metric.uniqueSpecies}</Text>
                  <Text style={styles.tableCell}>{formatNumber(metric.newBands)}</Text>
                  <Text style={styles.tableCell}>{metric.returns}</Text>
                  <Text style={styles.tableCell}>{metric.youngToAdultRatio?.toFixed(2) || '-'}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.subsectionTitle}>Capture Effort Analysis</Text>
            
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Year</Text>
                <Text style={styles.tableHeaderCell}>Days</Text>
                <Text style={styles.tableHeaderCell}>Total</Text>
                <Text style={styles.tableHeaderCell}>Per Day</Text>
                <Text style={styles.tableHeaderCell}>Spp/Day</Text>
              </View>
              {data.multiYearData.effort?.slice(-10).map((eff: any, idx: number) => (
                <View 
                  key={eff.year} 
                  style={eff.year === data.year ? styles.tableRowHighlight : (idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt)}
                >
                  <Text style={styles.tableCellBold}>{eff.year}</Text>
                  <Text style={styles.tableCell}>{eff.activeDays}</Text>
                  <Text style={styles.tableCell}>{formatNumber(eff.totalCaptures)}</Text>
                  <Text style={styles.tableCell}>{eff.capturesPerDay}</Text>
                  <Text style={styles.tableCell}>{eff.speciesPerDay}</Text>
                </View>
              ))}
            </View>

            <PageFooter pageNum={11} />
          </Page>

          <Page size="A4" style={styles.page}>
            <PageHeader title="Diversity Trends" year={data.year} />
            
            <Text style={styles.sectionTitle}>Species Diversity Analysis</Text>
            
            <Text style={styles.paragraph}>
              Species diversity indices provide quantitative measures of community structure. The Shannon 
              diversity index (H') accounts for both species richness and evenness, with higher values 
              indicating more diverse and stable communities.
            </Text>

            <Text style={styles.subsectionTitle}>Diversity Indices Over Time</Text>
            
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Year</Text>
                <Text style={styles.tableHeaderCell}>Richness</Text>
                <Text style={styles.tableHeaderCell}>Shannon H'</Text>
                <Text style={styles.tableHeaderCell}>Evenness</Text>
                <Text style={styles.tableHeaderCell}>Captures</Text>
              </View>
              {data.multiYearData.diversity?.slice(-10).map((div: any, idx: number) => (
                <View 
                  key={div.year} 
                  style={div.year === data.year ? styles.tableRowHighlight : (idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt)}
                >
                  <Text style={styles.tableCellBold}>{div.year}</Text>
                  <Text style={styles.tableCell}>{div.richness}</Text>
                  <Text style={styles.tableCell}>{div.shannon}</Text>
                  <Text style={styles.tableCell}>{div.evenness}</Text>
                  <Text style={styles.tableCell}>{formatNumber(div.totalCaptures)}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.subsectionTitle}>Top Species Trends</Text>
            
            {data.multiYearData.speciesTrends?.topSpecies?.slice(0, 3).map((species: string, idx: number) => {
              const trendData = data.multiYearData.speciesTrends.speciesTrends?.find((t: any) => t.species === species);
              if (!trendData) return null;

              return (
                <View key={species} style={{ marginBottom: 10 }}>
                  <Text style={styles.subsubsectionTitle}>{idx + 1}. {species}</Text>
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      {trendData.yearlyData?.slice(-8).map((yd: any) => (
                        <Text key={yd.year} style={styles.tableHeaderCell}>{yd.year}</Text>
                      ))}
                    </View>
                    <View style={styles.tableRow}>
                      {trendData.yearlyData?.slice(-8).map((yd: any) => (
                        <Text key={`${yd.year}-count`} style={styles.tableCell}>{yd.count}</Text>
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}

            <PageFooter pageNum={12} />
          </Page>
        </>
      )}

      {/* Complete Species List Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Species List" year={data.year} />
        
        <Text style={styles.sectionTitle}>Complete Species List ({data.year})</Text>
        
        <Text style={styles.paragraph}>
          A total of {analysis.uniqueSpecies} species were recorded during the {data.year} monitoring 
          season. The following table lists all species in order of abundance.
        </Text>

        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3, textAlign: 'left' }]}>Species</Text>
                <Text style={styles.tableHeaderCell}>n</Text>
              </View>
              {analysis.topSpecies.slice(0, Math.ceil(analysis.topSpecies.length / 2)).map((species: any, idx: number) => (
                <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.tableCell, { flex: 3, textAlign: 'left', fontSize: 8 }]}>{species.name}</Text>
                  <Text style={[styles.tableCell, { fontSize: 8 }]}>{species.count}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3, textAlign: 'left' }]}>Species</Text>
                <Text style={styles.tableHeaderCell}>n</Text>
              </View>
              {analysis.topSpecies.slice(Math.ceil(analysis.topSpecies.length / 2)).map((species: any, idx: number) => (
                <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.tableCell, { flex: 3, textAlign: 'left', fontSize: 8 }]}>{species.name}</Text>
                  <Text style={[styles.tableCell, { fontSize: 8 }]}>{species.count}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <PageFooter pageNum={13} />
      </Page>

      {/* Acknowledgements Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Acknowledgements" year={data.year} />
        
        <Text style={styles.sectionTitle}>Acknowledgements</Text>
        
        <Text style={styles.paragraph}>
          The McGill Bird Observatory's {data.year} banding operations were made possible through the 
          dedication of our staff, volunteers, and supporters. We extend our sincere gratitude to everyone 
          who contributed to this season's success.
        </Text>

        <Text style={styles.subsectionTitle}>Banding Staff</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 3, textAlign: 'left' }]}>Bander</Text>
            <Text style={styles.tableHeaderCell}>Captures</Text>
            <Text style={styles.tableHeaderCell}>Days</Text>
            <Text style={styles.tableHeaderCell}>Species</Text>
          </View>
          {analysis.banderProductivity?.slice(0, 10).map((bander: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.tableCellLeft}>{bander.bander}</Text>
              <Text style={styles.tableCell}>{bander.captures}</Text>
              <Text style={styles.tableCell}>{bander.days}</Text>
              <Text style={styles.tableCell}>{bander.species}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.subsectionTitle}>About the Observatory</Text>
        
        <Text style={styles.paragraph}>
          The McGill Bird Observatory is a project of The Migration Research Foundation Inc., a registered 
          charitable organization dedicated to the study and conservation of migratory birds. Located at 
          the western tip of the Island of Montreal, the observatory has been conducting standardized 
          migration monitoring since 2004.
        </Text>

        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
            McGill Bird Observatory{'\n'}
            A project of The Migration Research Foundation Inc.{'\n'}
            PO Box 10005{'\n'}
            Ste-Anne-de-Bellevue, QC H9X 0A6{'\n'}
            {'\n'}
            www.migrationresearch.org{'\n'}
            Registered Charity: 899163505RR0001
          </Text>
        </View>

        <Text style={styles.subsectionTitle}>Permits and Protocols</Text>
        
        <Text style={styles.paragraph}>
          Bird banding activities were conducted under federal and provincial scientific collection permits. 
          All operations followed standardized protocols established by the Canadian Wildlife Service and 
          The Institute for Bird Populations (MAPS program).
        </Text>

        <View style={{ position: 'absolute', bottom: 80, left: 50, right: 50, textAlign: 'center' }}>
          <Text style={{ fontSize: 10, color: colors.darkGray }}>
            Report generated: {new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        <PageFooter pageNum={14} />
      </Page>
    </Document>
  );
};

/**
 * Generate an annual report PDF from capture data
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

  // Add detailed analyses
  analysis.sexRatios = analyzeSexRatiosBySpecies(yearCaptures);
  analysis.ageRatios = analyzeAgeRatiosBySpecies(yearCaptures);
  analysis.morphometrics = analyzeMorphometricCorrelations(yearCaptures);
  analysis.weeklyPatterns = analyzeCaptureTimingPatterns(yearCaptures);
  analysis.recaptureIntervals = analyzeRecaptureIntervals(allCaptures, year);
  analysis.netUsage = analyzeNetUsage(yearCaptures);
  analysis.banderProductivity = analyzeBanderProductivity(yearCaptures);
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

  // Detailed returns by program
  analysis.detailedReturns = analyzeDetailedReturns(allCaptures, yearCaptures, year);
  analysis.returnsBySeason = analyzeReturnsBySeason(allCaptures, yearCaptures, year);
  analysis.netUsageDetailed = analyzeNetUsageDetailed(yearCaptures);
  
  // Detailed species totals with full breakdown
  analysis.speciesTotals = analyzeSpeciesTotalsDetailed(yearCaptures);
  analysis.effortByMonth = analyzeEffortByMonth(yearCaptures);
  analysis.notableCaptures = analyzeNotableCaptures(allCaptures, yearCaptures, year);

  // Multi-year trend analysis
  const multiYearTrends = analyzeMultiYearTrends(allCaptures, year);
  const diversity = analyzeSpeciesDiversity(allCaptures, year);
  const effort = analyzeCaptureEffort(allCaptures, year);
  const speciesTrends = analyzeTopSpeciesTrends(allCaptures, 5);

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
  const doc = (
    <AnnualReportDocument
      data={{ year, captures: yearCaptures, program, multiYearData }}
      analysis={analysis}
      chartPaths={chartPaths}
    />
  );

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
