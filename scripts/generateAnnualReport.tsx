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
    padding: 50,
    fontSize: 10,
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
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginBottom: 15,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  subsectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.secondary,
    marginTop: 15,
    marginBottom: 10,
  },
  subsubsectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
    marginTop: 10,
    marginBottom: 8,
  },

  // Content styles
  paragraph: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 10,
    textAlign: 'justify',
  },
  highlightBox: {
    backgroundColor: colors.lightGray,
    padding: 15,
    marginVertical: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  highlightText: {
    fontSize: 10,
    lineHeight: 1.4,
  },

  // Statistics boxes
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 15,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.lightGray,
    padding: 12,
    marginHorizontal: 5,
    alignItems: 'center',
    borderRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 9,
    color: colors.darkGray,
    marginTop: 4,
    textAlign: 'center',
  },

  // Tables
  table: {
    marginVertical: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    color: colors.white,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: colors.lightGray,
  },
  tableRowHighlight: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: colors.highlight,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    textAlign: 'center',
  },
  tableCellLeft: {
    flex: 2,
    fontSize: 9,
    textAlign: 'left',
  },
  tableCellBold: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },

  // Charts
  chartContainer: {
    marginVertical: 15,
    alignItems: 'center',
  },
  chart: {
    width: '100%',
    height: 220,
  },
  chartCaption: {
    fontSize: 9,
    color: colors.darkGray,
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.mediumGray,
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: colors.darkGray,
  },
  pageNumber: {
    fontSize: 8,
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
    marginBottom: 15,
    padding: 10,
    backgroundColor: colors.lightGray,
    borderRadius: 4,
  },
  speciesName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginBottom: 5,
  },
  speciesStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  speciesStat: {
    fontSize: 9,
  },

  // TOC styles
  tocEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    borderBottomStyle: 'dotted',
  },
  tocTitle: {
    fontSize: 11,
  },
  tocPage: {
    fontSize: 11,
    color: colors.darkGray,
  },
  tocSection: {
    marginTop: 10,
    marginBottom: 5,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
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

          <Text style={styles.tocSection}>Long-term Trends</Text>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Multi-year Population Trends</Text>
            <Text style={styles.tocPage}>11</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Species Diversity Analysis</Text>
            <Text style={styles.tocPage}>12</Text>
          </View>

          <Text style={styles.tocSection}>Appendices</Text>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Complete Species List</Text>
            <Text style={styles.tocPage}>13</Text>
          </View>
          <View style={styles.tocEntry}>
            <Text style={styles.tocTitle}>Acknowledgements</Text>
            <Text style={styles.tocPage}>14</Text>
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

      {/* Complete Banding Totals Page */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Banding Totals" year={data.year} />
        
        <Text style={styles.sectionTitle}>Complete Banding Totals by Species</Text>
        
        {chartPaths.speciesChart && (
          <View style={styles.chartContainer}>
            <Image style={styles.chart} src={chartPaths.speciesChart} />
            <Text style={styles.chartCaption}>Figure 2. Top species by capture count in {data.year}</Text>
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 3, textAlign: 'left' }]}>Species</Text>
            <Text style={styles.tableHeaderCell}>Total</Text>
            <Text style={styles.tableHeaderCell}>New</Text>
            <Text style={styles.tableHeaderCell}>Recap</Text>
            <Text style={styles.tableHeaderCell}>Return</Text>
          </View>
          {analysis.topSpecies.slice(0, 25).map((species: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.tableCellLeft}>{species.name}</Text>
              <Text style={styles.tableCellBold}>{species.count}</Text>
              <Text style={styles.tableCell}>{species.new}</Text>
              <Text style={styles.tableCell}>{species.recaptures}</Text>
              <Text style={styles.tableCell}>{species.returns || 0}</Text>
            </View>
          ))}
        </View>

        <PageFooter pageNum={8} />
      </Page>

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
              <Image style={{ width: '100%', height: 150 }} src={chartPaths.demographicsChart} />
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
            <Text style={[styles.tableHeaderCell, { flex: 3, textAlign: 'left' }]}>Species</Text>
            <Text style={styles.tableHeaderCell}>Young</Text>
            <Text style={styles.tableHeaderCell}>Adult</Text>
            <Text style={styles.tableHeaderCell}>Y:A Ratio</Text>
            <Text style={styles.tableHeaderCell}>n</Text>
          </View>
          {analysis.ageRatios?.slice(0, 15).map((ratio: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.tableCellLeft}>{ratio.species}</Text>
              <Text style={styles.tableCell}>{ratio.young}</Text>
              <Text style={styles.tableCell}>{ratio.adult}</Text>
              <Text style={styles.tableCell}>{ratio.ratio}</Text>
              <Text style={styles.tableCell}>{ratio.total}</Text>
            </View>
          ))}
        </View>

        <PageFooter pageNum={9} />
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
            <Text style={[styles.tableHeaderCell, { flex: 3, textAlign: 'left' }]}>Species</Text>
            <Text style={styles.tableHeaderCell}>Recaps</Text>
            <Text style={styles.tableHeaderCell}>Avg Days</Text>
            <Text style={styles.tableHeaderCell}>Max Years</Text>
          </View>
          {analysis.recaptureIntervals?.slice(0, 15).map((interval: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.tableCellLeft}>{interval.species}</Text>
              <Text style={styles.tableCell}>{interval.count}</Text>
              <Text style={styles.tableCell}>{interval.avgDays}</Text>
              <Text style={styles.tableCell}>{interval.maxYears}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.subsectionTitle}>Net Location Efficiency</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'left' }]}>Net</Text>
            <Text style={styles.tableHeaderCell}>Captures</Text>
            <Text style={styles.tableHeaderCell}>Species</Text>
            <Text style={styles.tableHeaderCell}>New</Text>
            <Text style={styles.tableHeaderCell}>Recap Rate</Text>
          </View>
          {analysis.netUsage?.slice(0, 12).map((net: any, idx: number) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { textAlign: 'left' }]}>{net.net}</Text>
              <Text style={styles.tableCell}>{net.captures}</Text>
              <Text style={styles.tableCell}>{net.species}</Text>
              <Text style={styles.tableCell}>{net.newBands}</Text>
              <Text style={styles.tableCell}>{net.recaptureRate}%</Text>
            </View>
          ))}
        </View>

        <PageFooter pageNum={10} />
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
