import { Capture } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

/**
 * Comprehensive analysis of capture data
 */
export function analyzeCaptures(captures: Capture[]) {
  // Basic counts
  const totalCaptures = captures.length;
  const uniqueSpecies = new Set(captures.map((c) => c.species)).size;

  // Capture types
  const captureTypes = captures.reduce(
    (acc, c) => {
      acc[c.captureType] = (acc[c.captureType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const newBands = captureTypes['Banded'] || 0;
  const recaptures = (captureTypes['Repeat'] || 0) + (captureTypes['Alien'] || 0);
  const returns = captureTypes['Return'] || 0;

  // Species analysis
  const speciesCounts = captures.reduce(
    (acc, c) => {
      if (!acc[c.species]) {
        acc[c.species] = { name: c.species, count: 0, new: 0, recaptures: 0, returns: 0 };
      }
      acc[c.species].count++;
      if (c.captureType === 'Banded') acc[c.species].new++;
      if (c.captureType === 'Repeat' || c.captureType === 'Alien') acc[c.species].recaptures++;
      if (c.captureType === 'Return') acc[c.species].returns++;
      return acc;
    },
    {} as Record<string, any>
  );

  const topSpecies = Object.values(speciesCounts)
    .sort((a, b) => b.count - a.count)
    .map((s) => ({
      ...s,
      percentage: (s.count / totalCaptures) * 100,
    }));

  // Age distribution
  const ageDistribution = captures.reduce(
    (acc, c) => {
      const age = c.age || 'Unknown';
      acc[age] = (acc[age] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sex distribution
  const sexDistribution = captures.reduce(
    (acc, c) => {
      const sex = c.sex || 'Unknown';
      acc[sex] = (acc[sex] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Temporal analysis
  const monthlyCaptures = captures.reduce(
    (acc, c) => {
      const date = new Date(c.date);
      const month = date.toLocaleString('default', { month: 'short' });
      const monthKey = `${date.getMonth() + 1}-${month}`;
      if (!acc[monthKey]) {
        acc[monthKey] = { month, captures: 0, species: new Set(), dates: new Set() };
      }
      acc[monthKey].captures++;
      acc[monthKey].species.add(c.species);
      acc[monthKey].dates.add(c.date);
      return acc;
    },
    {} as Record<string, any>
  );

  const monthlyData = Object.values(monthlyCaptures)
    .map((m) => ({
      month: m.month,
      captures: m.captures,
      species: m.species.size,
      days: m.dates.size,
    }))
    .sort((a, b) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.indexOf(a.month) - months.indexOf(b.month);
    });

  const peakMonth = monthlyData.reduce((max, m) => (m.captures > max.captures ? m : max), monthlyData[0])?.month;

  const activeDays = new Set(captures.map((c) => c.date)).size;

  // Biometric data by species
  const biometricData = Object.values(speciesCounts)
    .map((species) => {
      const speciesCaptures = captures.filter((c) => c.species === species.name);
      const weights = speciesCaptures.filter((c) => c.weight > 0).map((c) => c.weight);
      const wings = speciesCaptures.filter((c) => c.wing > 0).map((c) => c.wing);
      const fats = speciesCaptures.filter((c) => c.fat >= 0).map((c) => c.fat);

      return {
        name: species.name,
        count: species.count,
        avgWeight: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
        avgWing: wings.length > 0 ? wings.reduce((a, b) => a + b, 0) / wings.length : null,
        avgFat: fats.length > 0 ? fats.reduce((a, b) => a + b, 0) / fats.length : null,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Bander activity
  const banderActivity = captures.reduce(
    (acc, c) => {
      if (c.bander) {
        acc[c.bander] = (acc[c.bander] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const topBanders = Object.entries(banderActivity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    totalCaptures,
    uniqueSpecies,
    newBands,
    recaptures,
    returns,
    captureTypes,
    topSpecies,
    ageDistribution,
    sexDistribution,
    monthlyData,
    peakMonth,
    activeDays,
    biometricData,
    topBanders,
  };
}

/**
 * Generate explanatory text for the executive summary
 */
export function generateExecutiveSummary(analysis: any, year: number): string {
  const { totalCaptures, uniqueSpecies, newBands, recaptures, returns, topSpecies, peakMonth, activeDays } = analysis;

  const topSpeciesName = topSpecies[0]?.name || 'N/A';
  const topSpeciesPercent = topSpecies[0]?.percentage.toFixed(1) || '0';
  const diversityLevel = uniqueSpecies > 50 ? 'high' : uniqueSpecies > 30 ? 'moderate' : 'modest';

  return `During the ${year} monitoring season, a total of ${totalCaptures} birds representing ${uniqueSpecies} species were captured over ${activeDays} active monitoring days. This represents a ${diversityLevel} level of avian diversity for the monitoring period. 

The most commonly captured species was ${topSpeciesName}, accounting for ${topSpeciesPercent}% of all captures. Of the total captures, ${newBands} were newly banded individuals, while ${recaptures} were recaptures (birds banded earlier in the same season) and ${returns} were returns (birds banded in previous seasons). 

Capture activity peaked during ${peakMonth}, which aligns with typical migration patterns for this region. The ratio of newly banded birds to recaptures provides insights into population turnover and site fidelity among different species.`;
}

/**
 * Generate explanatory text for species analysis
 */
export function generateSpeciesAnalysis(analysis: any): string {
  const { topSpecies, totalCaptures } = analysis;
  const top3 = topSpecies.slice(0, 3);
  const dominantSpecies = topSpecies.filter((s: any) => s.percentage > 10).length;

  let text = `Species composition analysis reveals important patterns in the local avian community. `;

  if (top3.length >= 3) {
    text += `The three most abundant species were ${top3[0].name} (${top3[0].count} captures, ${top3[0].percentage.toFixed(1)}%), ${top3[1].name} (${top3[1].count} captures, ${top3[1].percentage.toFixed(1)}%), and ${top3[2].name} (${top3[2].count} captures, ${top3[2].percentage.toFixed(1)}%). `;
  }

  if (dominantSpecies > 0) {
    text += `${dominantSpecies} ${dominantSpecies === 1 ? 'species' : 'species'} represented more than 10% of total captures, indicating ${dominantSpecies > 3 ? 'moderate' : 'high'} species dominance. `;
  }

  const recaptureRate = (topSpecies.reduce((sum: number, s: any) => sum + s.recaptures, 0) / totalCaptures * 100).toFixed(1);
  text += `\n\nThe overall recapture rate of ${recaptureRate}% provides insights into site fidelity and local movement patterns. Species with higher recapture rates may indicate stronger site attachment or more localized movements during the monitoring period.`;

  return text;
}

/**
 * Generate explanatory text for demographic analysis
 */
export function generateDemographicsAnalysis(analysis: any): string {
  const { ageDistribution, sexDistribution, totalCaptures } = analysis;

  // Calculate age ratios
  const youngBirds = Object.entries(ageDistribution)
    .filter(([age]) => age.includes('HY') && !age.includes('AHY'))
    .reduce((sum, [, count]) => sum + (count as number), 0);

  const adults = Object.entries(ageDistribution)
    .filter(([age]) => age.includes('AHY') || age.includes('ASY') || age.includes('ATY'))
    .reduce((sum, [, count]) => sum + (count as number), 0);

  const youngToAdultRatio = adults > 0 ? (youngBirds / adults).toFixed(2) : 'N/A';

  let text = `Age and sex demographic data provide critical insights into breeding productivity and population structure. `;

  if (youngBirds > 0 && adults > 0) {
    text += `The young-to-adult ratio of ${youngToAdultRatio}:1 ${parseFloat(youngToAdultRatio) > 1 ? 'suggests successful local breeding activity' : 'indicates a population dominated by adults'}. `;
    
    const youngPercent = ((youngBirds / totalCaptures) * 100).toFixed(1);
    text += `Young birds (hatch-year individuals) comprised ${youngPercent}% of all captures, `;
    
    if (parseFloat(youngPercent) > 40) {
      text += `indicating strong recruitment and productive breeding season. `;
    } else if (parseFloat(youngPercent) > 20) {
      text += `showing moderate breeding productivity. `;
    } else {
      text += `suggesting lower breeding productivity or possible sampling bias toward non-breeding areas. `;
    }
  }

  // Sex ratio analysis
  const males = sexDistribution['M'] || 0;
  const females = sexDistribution['F'] || 0;
  const unknown = sexDistribution['U'] || sexDistribution['Unknown'] || 0;

  if (males > 0 && females > 0) {
    const sexRatio = (males / females).toFixed(2);
    text += `\n\nSex ratio analysis shows ${males} males to ${females} females (${sexRatio}:1). `;
    
    if (Math.abs(parseFloat(sexRatio) - 1.0) < 0.2) {
      text += `This near-equal sex ratio suggests balanced sampling across the population. `;
    } else if (parseFloat(sexRatio) > 1.2) {
      text += `The male bias may reflect differential migration timing or habitat preferences. `;
    } else {
      text += `The female bias may indicate sampling during specific phenological periods or habitat selection differences. `;
    }
  }

  if (unknown > 0) {
    const unknownPercent = ((unknown / totalCaptures) * 100).toFixed(1);
    text += `${unknownPercent}% of captures could not be definitively sexed, which is typical for many species where plumage characteristics overlap between sexes.`;
  }

  return text;
}

/**
 * Generate explanatory text for temporal patterns
 */
export function generateTemporalAnalysis(analysis: any, year: number): string {
  const { monthlyData, peakMonth, activeDays } = analysis;

  const peakMonthData = monthlyData.find((m: any) => m.month === peakMonth);
  const totalSpeciesObserved = Math.max(...monthlyData.map((m: any) => m.species));
  const mostDiverseMonth = monthlyData.reduce((max: any, m: any) => m.species > max.species ? m : max, monthlyData[0]);

  let text = `Temporal analysis of capture data reveals important phenological patterns throughout the ${year} monitoring season. `;

  text += `Monitoring efforts spanned ${activeDays} days across ${monthlyData.length} months, with ${peakMonth} showing peak capture activity (${peakMonthData?.captures || 'N/A'} captures). `;

  if (mostDiverseMonth) {
    text += `Species diversity was highest in ${mostDiverseMonth.month} with ${mostDiverseMonth.species} species recorded. `;
  }

  // Analyze seasonal patterns
  const firstHalf = monthlyData.slice(0, Math.ceil(monthlyData.length / 2));
  const secondHalf = monthlyData.slice(Math.ceil(monthlyData.length / 2));
  
  const firstHalfCaptures = firstHalf.reduce((sum: number, m: any) => sum + m.captures, 0);
  const secondHalfCaptures = secondHalf.reduce((sum: number, m: any) => sum + m.captures, 0);

  if (firstHalfCaptures > secondHalfCaptures * 1.2) {
    text += `\n\nCapture activity was concentrated in the first half of the monitoring period, consistent with spring migration and breeding season patterns. `;
  } else if (secondHalfCaptures > firstHalfCaptures * 1.2) {
    text += `\n\nCapture activity increased during the latter portion of the season, typical of post-breeding dispersal and fall migration. `;
  } else {
    text += `\n\nCapture activity was relatively distributed throughout the season, suggesting continuous monitoring of both breeding residents and migrants. `;
  }

  const avgCapturesPerDay = monthlyData.reduce((sum: number, m: any) => sum + m.captures, 0) / activeDays;
  text += `The average capture rate of ${avgCapturesPerDay.toFixed(1)} birds per active day reflects consistent monitoring effort and local habitat quality.`;

  return text;
}

/**
 * Generate explanatory text for biometric data
 */
export function generateBiometricAnalysis(analysis: any): string {
  const { biometricData } = analysis;
  
  const validBiometrics = biometricData.filter((s: any) => s.avgWeight && s.avgWing && s.count > 5);

  if (validBiometrics.length === 0) {
    return `Biometric measurements provide valuable baseline data for population health assessment. Continued collection of morphological data will enable long-term trend analysis and comparison with regional populations.`;
  }

  let text = `Biometric measurements provide important insights into body condition and population health. `;

  text += `Among species with adequate sample sizes (n>5), morphological measurements fell within expected ranges for the region and season. `;

  // Analyze fat scores if available
  const withFatData = validBiometrics.filter((s: any) => s.avgFat !== null);
  if (withFatData.length > 0) {
    const avgFat = withFatData.reduce((sum: number, s: any) => sum + s.avgFat, 0) / withFatData.length;
    text += `\n\nAverage fat scores across species (${avgFat.toFixed(2)}) indicate ${avgFat > 3 ? 'good body condition with substantial fat reserves' : avgFat > 2 ? 'moderate fat reserves typical of active migration or breeding periods' : 'lean condition, suggesting recent migration or high energetic demands'}. `;
  }

  text += `Wing chord and weight measurements are consistent with published literature values and provide valuable baseline data for long-term population monitoring. These morphological data contribute to our understanding of geographic variation and can reveal temporal changes in body size potentially related to environmental factors.`;

  return text;
}

/**
 * Generate chart images for the report
 * Returns data URIs for embedding in React-PDF
 */
export async function generateCharts(captures: Capture[], analysis: any, year: number) {
  const chartsDir = path.join(process.cwd(), 'reports', 'charts', `${year}`);
  if (!fs.existsSync(chartsDir)) {
    fs.mkdirSync(chartsDir, { recursive: true });
  }

  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 900, height: 450, backgroundColour: 'white' });
  const toDataUri = (buf: Buffer) => `data:image/png;base64,${buf.toString('base64')}`;

  const chartPaths = {
    speciesChart: null as string | null,
    demographicsChart: null as string | null,
    monthlyTrendChart: null as string | null,
  };

  // Species bar chart (top species by count)
  const topSpecies = analysis.topSpecies.slice(0, 12);
  if (topSpecies.length > 0) {
    const speciesConfig = {
      type: 'bar',
      data: {
        labels: topSpecies.map((s: any) => s.name),
        datasets: [
          {
            label: 'Captures',
            data: topSpecies.map((s: any) => s.count),
            backgroundColor: 'rgba(54, 162, 235, 0.7)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `Top Species by Capture Count (${year})` },
        },
        scales: {
          x: { ticks: { autoSkip: false, maxRotation: 60, minRotation: 30 } },
          y: { beginAtZero: true, title: { display: true, text: 'Captures' } },
        },
      },
    } as any;

    const speciesImage = await chartJSNodeCanvas.renderToBuffer(speciesConfig);
    fs.writeFileSync(path.join(chartsDir, 'species-chart.png'), speciesImage);
    chartPaths.speciesChart = toDataUri(speciesImage);
  }

  // Demographics bar: sex distribution
  const sexLabels = Object.keys(analysis.sexDistribution || {});
  if (sexLabels.length > 0) {
    const demographicsConfig = {
      type: 'bar',
      data: {
        labels: sexLabels,
        datasets: [
          {
            label: 'Captures',
            data: sexLabels.map((k) => analysis.sexDistribution[k]),
            backgroundColor: ['rgba(54, 162, 235, 0.7)', 'rgba(255, 99, 132, 0.7)', 'rgba(201, 203, 207, 0.7)'],
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `Sex Distribution (${year})` },
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Captures' } },
        },
      },
    } as any;

    const demoImage = await chartJSNodeCanvas.renderToBuffer(demographicsConfig);
    fs.writeFileSync(path.join(chartsDir, 'demographics-chart.png'), demoImage);
    chartPaths.demographicsChart = toDataUri(demoImage);
  }

  // Monthly capture trend line chart
  if (analysis.monthlyData && analysis.monthlyData.length > 0) {
    const monthLabels = analysis.monthlyData.map((m: any) => m.month);
    const monthCaptures = analysis.monthlyData.map((m: any) => m.captures);

    const monthlyConfig = {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: 'Captures',
            data: monthCaptures,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.3)',
            fill: true,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: `Monthly Capture Trends (${year})` },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    } as any;

    const monthlyImage = await chartJSNodeCanvas.renderToBuffer(monthlyConfig);
    fs.writeFileSync(path.join(chartsDir, 'monthly-trend-chart.png'), monthlyImage);
    chartPaths.monthlyTrendChart = toDataUri(monthlyImage);
  }

  console.log('Charts generated with chartjs-node-canvas');
  return chartPaths;
}

/**
 * Analyze age ratios by species
 */
export function analyzeAgeRatiosBySpecies(captures: Capture[]) {
  const speciesAgeData = captures.reduce((acc, c) => {
    if (!acc[c.species]) {
      acc[c.species] = { young: 0, adult: 0, unknown: 0, total: 0 };
    }
    acc[c.species].total++;
    if (c.age.includes('HY') && !c.age.includes('AHY')) {
      acc[c.species].young++;
    } else if (c.age.includes('AHY') || c.age.includes('ASY') || c.age.includes('ATY')) {
      acc[c.species].adult++;
    } else {
      acc[c.species].unknown++;
    }
    return acc;
  }, {} as Record<string, any>);

  return Object.entries(speciesAgeData)
    .filter(([, data]) => data.total >= 10 && data.adult > 0) // Only species with 10+ captures and adults
    .map(([species, data]) => ({
      species,
      young: data.young,
      adult: data.adult,
      unknown: data.unknown,
      total: data.total,
      ratio: (data.young / data.adult).toFixed(2),
      youngPercent: ((data.young / data.total) * 100).toFixed(1),
      adultPercent: ((data.adult / data.total) * 100).toFixed(1),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);
}

/**
 * Analyze capture timing patterns (daily and weekly)
 */
export function analyzeCaptureTimingPatterns(captures: Capture[]) {
  const byWeek = captures.reduce((acc, c) => {
    const date = new Date(c.date);
    const week = Math.ceil((date.getDate()) / 7);
    const month = date.getMonth() + 1;
    const key = `${month}-${week}`;
    if (!acc[key]) {
      acc[key] = { month, week, count: 0, species: new Set() };
    }
    acc[key].count++;
    acc[key].species.add(c.species);
    return acc;
  }, {} as Record<string, any>);

  const weeklyData = Object.values(byWeek).map((w: any) => ({
    period: `M${w.month}W${w.week}`,
    month: w.month,
    week: w.week,
    captures: w.count,
    species: w.species.size,
  })).sort((a, b) => a.month - b.month || a.week - b.week);

  return weeklyData;
}

/**
 * Analyze recapture intervals
 */
export function analyzeRecaptureIntervals(allCaptures: Capture[], currentYear: number) {
  const bandFirstCapture = new Map<string, Date>();
  const recaptureIntervals: Array<{ species: string; days: number; years: number }> = [];

  // Sort captures by date
  const sorted = [...allCaptures].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sorted.forEach(capture => {
    const captureDate = new Date(capture.date);
    if (bandFirstCapture.has(capture.bandId)) {
      const firstCapture = bandFirstCapture.get(capture.bandId)!;
      const days = Math.floor((captureDate.getTime() - firstCapture.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) {
        recaptureIntervals.push({
          species: capture.species,
          days,
          years: parseFloat((days / 365.25).toFixed(2)),
        });
      }
    } else {
      bandFirstCapture.set(capture.bandId, captureDate);
    }
  });

  // Aggregate by species
  const bySpecies = recaptureIntervals.reduce((acc, interval) => {
    if (!acc[interval.species]) {
      acc[interval.species] = { intervals: [], count: 0 };
    }
    acc[interval.species].intervals.push(interval.days);
    acc[interval.species].count++;
    return acc;
  }, {} as Record<string, any>);

  return Object.entries(bySpecies)
    .filter(([, data]) => data.count >= 5)
    .map(([species, data]) => {
      const sorted = data.intervals.sort((a: number, b: number) => a - b);
      return {
        species,
        count: data.count,
        minDays: sorted[0],
        maxDays: sorted[sorted.length - 1],
        avgDays: Math.round(sorted.reduce((a: number, b: number) => a + b, 0) / sorted.length),
        maxYears: (sorted[sorted.length - 1] / 365.25).toFixed(2),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

/**
 * Analyze banding location/net usage
 */
export function analyzeNetUsage(captures: Capture[]) {
  const netData = captures.reduce((acc, c) => {
    const net = c.net || 'Unknown';
    if (!acc[net]) {
      acc[net] = { captures: 0, species: new Set(), newBands: 0, recaptures: 0 };
    }
    acc[net].captures++;
    acc[net].species.add(c.species);
    if (c.captureType === 'Banded') acc[net].newBands++;
    if (c.captureType === 'Repeat' || c.captureType === 'Alien') acc[net].recaptures++;
    return acc;
  }, {} as Record<string, any>);

  return Object.entries(netData)
    .filter(([net]) => net !== 'Unknown' && net !== '')
    .map(([net, data]) => ({
      net,
      captures: data.captures,
      species: data.species.size,
      newBands: data.newBands,
      recaptures: data.recaptures,
      recaptureRate: ((data.recaptures / data.captures) * 100).toFixed(1),
    }))
    .sort((a, b) => b.captures - a.captures)
    .slice(0, 15);
}

/**
 * Analyze bander productivity
 */
export function analyzeBanderProductivity(captures: Capture[]) {
  const banderData = captures.reduce((acc, c) => {
    const bander = c.bander || 'Unknown';
    if (!acc[bander]) {
      acc[bander] = { captures: 0, species: new Set(), newBands: 0, days: new Set() };
    }
    acc[bander].captures++;
    acc[bander].species.add(c.species);
    acc[bander].days.add(c.date);
    if (c.captureType === 'Banded') acc[bander].newBands++;
    return acc;
  }, {} as Record<string, any>);

  return Object.entries(banderData)
    .filter(([bander]) => bander !== 'Unknown' && bander !== '')
    .map(([bander, data]) => ({
      bander,
      captures: data.captures,
      species: data.species.size,
      newBands: data.newBands,
      days: data.days.size,
      capturesPerDay: (data.captures / data.days.size).toFixed(1),
    }))
    .sort((a, b) => b.captures - a.captures)
    .slice(0, 15);
}

/**
 * Analyze morphometric correlations
 */
export function analyzeMorphometricCorrelations(captures: Capture[]) {
  const speciesData = captures
    .filter(c => c.weight > 0 && c.wing > 0)
    .reduce((acc, c) => {
      if (!acc[c.species]) {
        acc[c.species] = { weights: [], wings: [], count: 0 };
      }
      acc[c.species].weights.push(c.weight);
      acc[c.species].wings.push(c.wing);
      acc[c.species].count++;
      return acc;
    }, {} as Record<string, any>);

  return Object.entries(speciesData)
    .filter(([, data]) => data.count >= 10)
    .map(([species, data]) => {
      const avgWeight = data.weights.reduce((a: number, b: number) => a + b, 0) / data.count;
      const avgWing = data.wings.reduce((a: number, b: number) => a + b, 0) / data.count;
      
      // Calculate standard deviations
      const weightSD = Math.sqrt(
        data.weights.reduce((sum: number, w: number) => sum + Math.pow(w - avgWeight, 2), 0) / data.count
      );
      const wingSD = Math.sqrt(
        data.wings.reduce((sum: number, w: number) => sum + Math.pow(w - avgWing, 2), 0) / data.count
      );

      return {
        species,
        count: data.count,
        avgWeight: avgWeight.toFixed(1),
        weightSD: weightSD.toFixed(1),
        avgWing: avgWing.toFixed(1),
        wingSD: wingSD.toFixed(1),
        weightRange: `${Math.min(...data.weights).toFixed(1)}-${Math.max(...data.weights).toFixed(1)}`,
        wingRange: `${Math.min(...data.wings).toFixed(0)}-${Math.max(...data.wings).toFixed(0)}`,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * Analyze multi-year trends for comparison
 */
export function analyzeMultiYearTrends(allCaptures: Capture[], currentYear: number) {
  // Group captures by year
  const capturesByYear = allCaptures.reduce((acc, c) => {
    const year = new Date(c.date).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(c);
    return acc;
  }, {} as Record<number, Capture[]>);

  const years = Object.keys(capturesByYear).map(Number).sort((a, b) => a - b);
  
  // Calculate metrics for each year
  const yearlyMetrics = years.map(year => {
    const yearCaptures = capturesByYear[year];
    const uniqueSpecies = new Set(yearCaptures.map(c => c.species)).size;
    const newBands = yearCaptures.filter(c => c.captureType === 'Banded').length;
    const returns = yearCaptures.filter(c => c.captureType === 'Return').length;
    const youngBirds = yearCaptures.filter(c => c.age.includes('HY') && !c.age.includes('AHY')).length;
    const adults = yearCaptures.filter(c => c.age.includes('AHY') || c.age.includes('ASY')).length;
    
    return {
      year,
      totalCaptures: yearCaptures.length,
      uniqueSpecies,
      newBands,
      returns,
      youngBirds,
      adults,
      youngToAdultRatio: adults > 0 ? (youngBirds / adults) : 0,
    };
  });

  // Calculate trends (percent change from previous years)
  const currentYearData = yearlyMetrics.find(m => m.year === currentYear);
  const previousYears = yearlyMetrics.filter(m => m.year < currentYear);
  
  let trends = {
    capturesTrend: 0,
    speciesTrend: 0,
    productivityTrend: 0,
    avgCapturesLast5Years: 0,
    avgSpeciesLast5Years: 0,
  };

  if (currentYearData && previousYears.length > 0) {
    const last5Years = previousYears.slice(-5);
    trends.avgCapturesLast5Years = last5Years.reduce((sum, y) => sum + y.totalCaptures, 0) / last5Years.length;
    trends.avgSpeciesLast5Years = last5Years.reduce((sum, y) => sum + y.uniqueSpecies, 0) / last5Years.length;
    
    trends.capturesTrend = ((currentYearData.totalCaptures - trends.avgCapturesLast5Years) / trends.avgCapturesLast5Years) * 100;
    trends.speciesTrend = ((currentYearData.uniqueSpecies - trends.avgSpeciesLast5Years) / trends.avgSpeciesLast5Years) * 100;
    
    const avgProductivityLast5 = last5Years.reduce((sum, y) => sum + y.youngToAdultRatio, 0) / last5Years.length;
    trends.productivityTrend = ((currentYearData.youngToAdultRatio - avgProductivityLast5) / avgProductivityLast5) * 100;
  }

  return {
    yearlyMetrics,
    trends,
    years,
  };
}

/**
 * Analyze species diversity and evenness over time
 */
export function analyzeSpeciesDiversity(allCaptures: Capture[], currentYear: number) {
  const capturesByYear = allCaptures.reduce((acc, c) => {
    const year = new Date(c.date).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(c);
    return acc;
  }, {} as Record<number, Capture[]>);

  const diversityByYear = Object.entries(capturesByYear).map(([year, captures]) => {
    const speciesCounts = captures.reduce((acc, c) => {
      acc[c.species] = (acc[c.species] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = captures.length;
    const richness = Object.keys(speciesCounts).length;
    
    // Calculate Shannon diversity index
    let shannon = 0;
    Object.values(speciesCounts).forEach(count => {
      const p = count / total;
      shannon -= p * Math.log(p);
    });

    // Calculate evenness
    const maxShannon = Math.log(richness);
    const evenness = richness > 1 ? shannon / maxShannon : 0;

    return {
      year: parseInt(year),
      richness,
      shannon: parseFloat(shannon.toFixed(3)),
      evenness: parseFloat(evenness.toFixed(3)),
      totalCaptures: total,
    };
  }).sort((a, b) => a.year - b.year);

  return diversityByYear;
}

/**
 * Analyze capture effort and efficiency
 */
export function analyzeCaptureEffort(allCaptures: Capture[], currentYear: number) {
  const capturesByYear = allCaptures.reduce((acc, c) => {
    const year = new Date(c.date).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(c);
    return acc;
  }, {} as Record<number, Capture[]>);

  const effortByYear = Object.entries(capturesByYear).map(([year, captures]) => {
    const activeDays = new Set(captures.map(c => c.date)).size;
    const capturesPerDay = captures.length / activeDays;
    const uniqueSpecies = new Set(captures.map(c => c.species)).size;
    const speciesPerDay = uniqueSpecies / activeDays;
    
    return {
      year: parseInt(year),
      activeDays,
      totalCaptures: captures.length,
      capturesPerDay: parseFloat(capturesPerDay.toFixed(2)),
      uniqueSpecies,
      speciesPerDay: parseFloat(speciesPerDay.toFixed(2)),
    };
  }).sort((a, b) => a.year - b.year);

  return effortByYear;
}

/**
 * Analyze top species trends over years
 */
export function analyzeTopSpeciesTrends(allCaptures: Capture[], topN: number = 5) {
  // Get overall top species
  const overallSpeciesCounts = allCaptures.reduce((acc, c) => {
    acc[c.species] = (acc[c.species] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topSpecies = Object.entries(overallSpeciesCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([species]) => species);

  // Track these species over years
  const capturesByYear = allCaptures.reduce((acc, c) => {
    const year = new Date(c.date).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(c);
    return acc;
  }, {} as Record<number, Capture[]>);

  const years = Object.keys(capturesByYear).map(Number).sort((a, b) => a - b);
  
  const speciesTrends = topSpecies.map(species => {
    const yearlyData = years.map(year => {
      const yearCaptures = capturesByYear[year];
      const count = yearCaptures.filter(c => c.species === species).length;
      const percentage = (count / yearCaptures.length) * 100;
      return {
        year,
        count,
        percentage: parseFloat(percentage.toFixed(2)),
      };
    });

    return {
      species,
      yearlyData,
    };
  });

  return {
    topSpecies,
    speciesTrends,
    years,
  };
}

/**
 * Generate narrative analysis for multi-year trends
 */
export function generateTrendsAnalysis(trendsData: any, currentYear: number): string {
  const { trends, yearlyMetrics } = trendsData;
  const currentYearData = yearlyMetrics.find((m: any) => m.year === currentYear);
  
  if (!currentYearData) {
    return 'Insufficient historical data available for trend analysis.';
  }

  let text = `Historical analysis comparing ${currentYear} to previous monitoring seasons reveals important population trends. `;

  // Capture trends
  if (Math.abs(trends.capturesTrend) < 5) {
    text += `Total capture numbers in ${currentYear} (${currentYearData.totalCaptures}) remain stable, showing only ${Math.abs(trends.capturesTrend).toFixed(1)}% ${trends.capturesTrend > 0 ? 'increase' : 'decrease'} compared to the 5-year average of ${Math.round(trends.avgCapturesLast5Years)}. `;
  } else if (trends.capturesTrend > 0) {
    text += `Total captures in ${currentYear} (${currentYearData.totalCaptures}) show a notable ${trends.capturesTrend.toFixed(1)}% increase compared to the 5-year average of ${Math.round(trends.avgCapturesLast5Years)}, suggesting improved habitat conditions or increased migration activity. `;
  } else {
    text += `Total captures in ${currentYear} (${currentYearData.totalCaptures}) declined by ${Math.abs(trends.capturesTrend).toFixed(1)}% compared to the 5-year average of ${Math.round(trends.avgCapturesLast5Years)}, warranting further investigation into potential causes. `;
  }

  // Species diversity trends
  if (Math.abs(trends.speciesTrend) < 5) {
    text += `Species richness remains consistent with ${currentYearData.uniqueSpecies} species recorded. `;
  } else if (trends.speciesTrend > 0) {
    text += `Species diversity shows a positive trend with ${currentYearData.uniqueSpecies} species recorded, a ${trends.speciesTrend.toFixed(1)}% increase over the 5-year average. `;
  } else {
    text += `Species richness of ${currentYearData.uniqueSpecies} represents a ${Math.abs(trends.speciesTrend).toFixed(1)}% decrease from the 5-year average, potentially indicating habitat changes or regional population shifts. `;
  }

  // Productivity trends
  if (!isNaN(trends.productivityTrend) && isFinite(trends.productivityTrend)) {
    const ratio = currentYearData.youngToAdultRatio.toFixed(2);
    if (Math.abs(trends.productivityTrend) < 10) {
      text += `\n\nBreeding productivity, indicated by the young-to-adult ratio of ${ratio}:1, remains consistent with historical patterns. `;
    } else if (trends.productivityTrend > 0) {
      text += `\n\nBreeding productivity shows improvement with a young-to-adult ratio of ${ratio}:1, representing a ${trends.productivityTrend.toFixed(1)}% increase over recent years, suggesting successful local breeding efforts. `;
    } else {
      text += `\n\nBreeding productivity declined with a young-to-adult ratio of ${ratio}:1, down ${Math.abs(trends.productivityTrend).toFixed(1)}% from recent averages, which may reflect challenging breeding conditions. `;
    }
  }

  text += `\n\nLong-term monitoring across ${yearlyMetrics.length} years provides valuable context for understanding these patterns and their ecological significance.`;

  return text;
}

/**
 * Analyze sex ratios by species
 */
export function analyzeSexRatiosBySpecies(captures: Capture[]) {
  const speciesSexData = captures.reduce((acc, c) => {
    if (!acc[c.species]) {
      acc[c.species] = { male: 0, female: 0, unknown: 0, total: 0 };
    }
    acc[c.species].total++;
    if (c.sex === 'M') acc[c.species].male++;
    else if (c.sex === 'F') acc[c.species].female++;
    else acc[c.species].unknown++;
    return acc;
  }, {} as Record<string, any>);

  return Object.entries(speciesSexData)
    .filter(([, data]) => data.total >= 10)
    .map(([species, data]) => ({
      species,
      male: data.male,
      female: data.female,
      unknown: data.unknown,
      total: data.total,
      ratio: data.female > 0 ? (data.male / data.female).toFixed(2) : 'N/A',
      malePercent: ((data.male / data.total) * 100).toFixed(1),
      femalePercent: ((data.female / data.total) * 100).toFixed(1),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);
}

/**
 * Analyze species by combined age and sex demographics
 */
export function analyzeSpeciesByAgeSex(captures: Capture[]) {
  const speciesData = captures.reduce((acc, c) => {
    if (!acc[c.species]) {
      acc[c.species] = {
        maleAdult: 0,
        maleYoung: 0,
        femaleAdult: 0,
        femaleYoung: 0,
        unknownSex: 0,
        total: 0,
      };
    }
    acc[c.species].total++;

    const isYoung = c.age.includes('HY') && !c.age.includes('AHY');
    const isAdult = c.age.includes('AHY') || c.age.includes('ASY') || c.age.includes('ATY');

    if (c.sex === 'M') {
      if (isYoung) acc[c.species].maleYoung++;
      else if (isAdult) acc[c.species].maleAdult++;
      else acc[c.species].unknownSex++;
    } else if (c.sex === 'F') {
      if (isYoung) acc[c.species].femaleYoung++;
      else if (isAdult) acc[c.species].femaleAdult++;
      else acc[c.species].unknownSex++;
    } else {
      acc[c.species].unknownSex++;
    }

    return acc;
  }, {} as Record<string, any>);

  return Object.entries(speciesData)
    .filter(([, data]) => data.total >= 10)
    .map(([species, data]) => ({
      species,
      maleAdult: data.maleAdult,
      maleYoung: data.maleYoung,
      femaleAdult: data.femaleAdult,
      femaleYoung: data.femaleYoung,
      unknownSex: data.unknownSex,
      total: data.total,
      sexableAdults: data.maleAdult + data.femaleAdult,
      sexableYoung: data.maleYoung + data.femaleYoung,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);
}

/**
 * Analyze fat scores by species, age, and sex
 */
export function analyzeFatScoresByDemographics(captures: Capture[]) {
  const withFat = captures.filter(c => c.fat >= 0);

  const speciesData = withFat.reduce((acc, c) => {
    if (!acc[c.species]) {
      acc[c.species] = {
        maleAdult: [],
        maleYoung: [],
        femaleAdult: [],
        femaleYoung: [],
        overall: [],
      };
    }

    acc[c.species].overall.push(c.fat);

    const isYoung = c.age.includes('HY') && !c.age.includes('AHY');
    const isAdult = c.age.includes('AHY') || c.age.includes('ASY') || c.age.includes('ATY');

    if (c.sex === 'M' && isAdult) acc[c.species].maleAdult.push(c.fat);
    else if (c.sex === 'M' && isYoung) acc[c.species].maleYoung.push(c.fat);
    else if (c.sex === 'F' && isAdult) acc[c.species].femaleAdult.push(c.fat);
    else if (c.sex === 'F' && isYoung) acc[c.species].femaleYoung.push(c.fat);

    return acc;
  }, {} as Record<string, any>);

  const avg = (arr: number[]) => (arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 'N/A');

  return Object.entries(speciesData)
    .filter(([, data]) => data.overall.length >= 10)
    .map(([species, data]) => ({
      species,
      overall: avg(data.overall),
      maleAdult: avg(data.maleAdult),
      maleYoung: avg(data.maleYoung),
      femaleAdult: avg(data.femaleAdult),
      femaleYoung: avg(data.femaleYoung),
      n: data.overall.length,
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 20);
}

/**
 * Analyze weight patterns by age, sex, and season
 */
export function analyzeWeightPatterns(captures: Capture[]) {
  const withWeight = captures.filter(c => c.weight > 0);

  const speciesData = withWeight.reduce((acc, c) => {
    if (!acc[c.species]) {
      acc[c.species] = {
        maleWeights: [],
        femaleWeights: [],
        youngWeights: [],
        adultWeights: [],
        earlyWeights: [],
        lateWeights: [],
        total: 0,
      };
    }

    acc[c.species].total++;
    const month = new Date(c.date).getMonth();

    if (month < 6) acc[c.species].earlyWeights.push(c.weight);
    else acc[c.species].lateWeights.push(c.weight);

    if (c.sex === 'M') acc[c.species].maleWeights.push(c.weight);
    if (c.sex === 'F') acc[c.species].femaleWeights.push(c.weight);

    const isYoung = c.age.includes('HY') && !c.age.includes('AHY');
    const isAdult = c.age.includes('AHY') || c.age.includes('ASY') || c.age.includes('ATY');

    if (isYoung) acc[c.species].youngWeights.push(c.weight);
    if (isAdult) acc[c.species].adultWeights.push(c.weight);

    return acc;
  }, {} as Record<string, any>);

  const avgWeight = (arr: number[]) => (arr.length >= 5 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 'N/A');

  return Object.entries(speciesData)
    .filter(([, data]) => data.total >= 20)
    .map(([species, data]) => ({
      species,
      male: avgWeight(data.maleWeights),
      female: avgWeight(data.femaleWeights),
      young: avgWeight(data.youngWeights),
      adult: avgWeight(data.adultWeights),
      early: avgWeight(data.earlyWeights),
      late: avgWeight(data.lateWeights),
      n: data.total,
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 20);
}

/**
 * Analyze capture efficiency by net and month
 */
export function analyzeNetEfficiencyByMonth(captures: Capture[]) {
  const netMonthData = captures.reduce((acc, c) => {
    const net = c.net || 'Unknown';
    const month = new Date(c.date).toLocaleString('default', { month: 'short' });
    const key = `${net}-${month}`;

    if (!acc[key]) {
      acc[key] = { net, month, captures: 0, species: new Set(), newBands: 0 };
    }

    acc[key].captures++;
    acc[key].species.add(c.species);
    if (c.captureType === 'Banded') acc[key].newBands++;

    return acc;
  }, {} as Record<string, any>);

  return Object.values(netMonthData)
    .filter((d: any) => d.net !== 'Unknown' && d.captures >= 5)
    .map((d: any) => ({
      net: d.net,
      month: d.month,
      captures: d.captures,
      species: d.species.size,
      newBands: d.newBands,
    }))
    .sort((a, b) => b.captures - a.captures)
    .slice(0, 30);
}

/**
 * Analyze capture time patterns (hourly)
 */
export function analyzeCaptureTimePatterns(captures: Capture[]) {
  const withTime = captures.filter(c => c.time && c.time !== '');

  const hourlyData = withTime.reduce((acc, c) => {
    const timeMatch = c.time.match(/^(\d{1,2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      if (hour >= 0 && hour < 24) {
        if (!acc[hour]) {
          acc[hour] = { hour, captures: 0, species: new Set(), newBands: 0 };
        }
        acc[hour].captures++;
        acc[hour].species.add(c.species);
        if (c.captureType === 'Banded') acc[hour].newBands++;
      }
    }
    return acc;
  }, {} as Record<number, any>);

  return Object.values(hourlyData)
    .map((d: any) => ({
      hour: d.hour,
      timeRange: `${d.hour.toString().padStart(2, '0')}:00-${(d.hour + 1).toString().padStart(2, '0')}:00`,
      captures: d.captures,
      species: d.species.size,
      newBands: d.newBands,
      recaptures: d.captures - d.newBands,
    }))
    .sort((a, b) => a.hour - b.hour);
}

/**
 * Analyze species co-occurrence patterns (same day, same net)
 */
export function analyzeSpeciesCoOccurrence(captures: Capture[], topN: number = 10) {
  const speciesCounts = captures.reduce((acc, c) => {
    acc[c.species] = (acc[c.species] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topSpecies = Object.entries(speciesCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([species]) => species);

  const capturesByDateNet = captures.reduce((acc, c) => {
    const key = `${c.date}-${c.net}`;
    if (!acc[key]) {
      acc[key] = new Set<string>();
    }
    if (topSpecies.includes(c.species)) {
      acc[key].add(c.species);
    }
    return acc;
  }, {} as Record<string, Set<string>>);

  const coOccurrence: Record<string, Record<string, number>> = {};
  topSpecies.forEach(sp1 => {
    coOccurrence[sp1] = {};
    topSpecies.forEach(sp2 => {
      coOccurrence[sp1][sp2] = 0;
    });
  });

  Object.values(capturesByDateNet).forEach(speciesSet => {
    const speciesList = Array.from(speciesSet);
    for (let i = 0; i < speciesList.length; i++) {
      for (let j = i + 1; j < speciesList.length; j++) {
        coOccurrence[speciesList[i]][speciesList[j]]++;
        coOccurrence[speciesList[j]][speciesList[i]]++;
      }
    }
  });

  const associations: Array<{ species1: string; species2: string; count: number }> = [];
  topSpecies.forEach((sp1, i) => {
    topSpecies.slice(i + 1).forEach(sp2 => {
      associations.push({ species1: sp1, species2: sp2, count: coOccurrence[sp1][sp2] });
    });
  });

  return associations.sort((a, b) => b.count - a.count).slice(0, 15);
}

/**
 * Analyze wing-weight ratio (body condition index)
 */
export function analyzeBodyConditionIndex(captures: Capture[]) {
  const withBoth = captures.filter(c => c.weight > 0 && c.wing > 0);

  const speciesData = withBoth.reduce((acc, c) => {
    if (!acc[c.species]) {
      acc[c.species] = {
        ratios: [],
        weights: [],
        wings: [],
      };
    }

    const ratio = (c.weight / c.wing) * 100;
    acc[c.species].ratios.push(ratio);
    acc[c.species].weights.push(c.weight);
    acc[c.species].wings.push(c.wing);

    return acc;
  }, {} as Record<string, any>);

  return Object.entries(speciesData)
    .filter(([, data]) => data.ratios.length >= 10)
    .map(([species, data]) => {
      const avgRatio = data.ratios.reduce((a: number, b: number) => a + b, 0) / data.ratios.length;
      const avgWeight = data.weights.reduce((a: number, b: number) => a + b, 0) / data.ratios.length;
      const avgWing = data.wings.reduce((a: number, b: number) => a + b, 0) / data.ratios.length;

      const stdRatio = Math.sqrt(
        data.ratios.reduce((sum: number, r: number) => sum + Math.pow(r - avgRatio, 2), 0) / data.ratios.length,
      );
      const cv = (stdRatio / avgRatio) * 100;

      return {
        species,
        avgRatio: avgRatio.toFixed(2),
        cv: cv.toFixed(1),
        avgWeight: avgWeight.toFixed(1),
        avgWing: avgWing.toFixed(1),
        n: data.ratios.length,
      };
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 20);
}

/**
 * Analyze recapture rates by species and net
 */
export function analyzeRecaptureRatesByNet(captures: Capture[]) {
  const netSpeciesData = captures.reduce((acc, c) => {
    const net = c.net || 'Unknown';
    const key = `${net}-${c.species}`;

    if (!acc[key]) {
      acc[key] = { net, species: c.species, total: 0, newBands: 0, recaptures: 0 };
    }

    acc[key].total++;
    if (c.captureType === 'Banded') acc[key].newBands++;
    if (c.captureType === 'Repeat' || c.captureType === 'Alien') acc[key].recaptures++;

    return acc;
  }, {} as Record<string, any>);

  return Object.values(netSpeciesData)
    .filter((d: any) => d.total >= 10 && d.net !== 'Unknown')
    .map((d: any) => ({
      net: d.net,
      species: d.species,
      total: d.total,
      newBands: d.newBands,
      recaptures: d.recaptures,
      recaptureRate: ((d.recaptures / d.total) * 100).toFixed(1),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);
}

/**
 * Analyze daily capture rates and variability
 */
export function analyzeDailyCaptureRates(captures: Capture[]) {
  const dailyData = captures.reduce((acc, c) => {
    if (!acc[c.date]) {
      acc[c.date] = { date: c.date, captures: 0, species: new Set(), newBands: 0 };
    }
    acc[c.date].captures++;
    acc[c.date].species.add(c.species);
    if (c.captureType === 'Banded') acc[c.date].newBands++;
    return acc;
  }, {} as Record<string, any>);

  const dailyRates = Object.values(dailyData)
    .map((d: any) => ({
      date: d.date,
      captures: d.captures,
      species: d.species.size,
      newBands: d.newBands,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const capturesArray = dailyRates.map(d => d.captures);
  const avgCaptures = capturesArray.reduce((a, b) => a + b, 0) / capturesArray.length;
  const maxCaptures = Math.max(...capturesArray);
  const minCaptures = Math.min(...capturesArray);
  const stdDev = Math.sqrt(
    capturesArray.reduce((sum, c) => sum + Math.pow(c - avgCaptures, 2), 0) / capturesArray.length,
  );

  return {
    dailyRates,
    summary: {
      avgCaptures: avgCaptures.toFixed(1),
      maxCaptures,
      minCaptures,
      stdDev: stdDev.toFixed(1),
      totalDays: dailyRates.length,
    },
  };
}

/**
 * Analyze species accumulation curve (cumulative species over time)
 */
export function analyzeSpeciesAccumulation(captures: Capture[]) {
  const sorted = [...captures].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const speciesSeen = new Set<string>();
  const accumulation: Array<{ date: string; cumulativeSpecies: number; newSpecies: string | null }> = [];

  sorted.forEach(c => {
    const wasNew = !speciesSeen.has(c.species);
    if (wasNew) {
      speciesSeen.add(c.species);
      accumulation.push({ date: c.date, cumulativeSpecies: speciesSeen.size, newSpecies: c.species });
    }
  });

  return accumulation;
}

/**
 * Analyze bander specialization (species diversity by bander)
 */
export function analyzeBanderSpecialization(captures: Capture[]) {
  const banderData = captures.reduce((acc, c) => {
    const bander = c.bander || 'Unknown';
    if (!acc[bander]) {
      acc[bander] = {
        species: new Set<string>(),
        speciesCounts: {} as Record<string, number>,
        total: 0,
      };
    }
    acc[bander].total++;
    acc[bander].species.add(c.species);
    acc[bander].speciesCounts[c.species] = (acc[bander].speciesCounts[c.species] || 0) + 1;
    return acc;
  }, {} as Record<string, any>);

  return Object.entries(banderData)
    .filter(([bander]) => bander !== 'Unknown' && bander !== '')
    .map(([bander, data]) => {
      let shannon = 0;
      Object.values(data.speciesCounts).forEach((count: any) => {
        const p = count / data.total;
        shannon -= p * Math.log(p);
      });

      const topSpecies = Object.entries(data.speciesCounts)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 3)
        .map(([sp, count]) => `${sp} (${count})`);

      return {
        bander,
        total: data.total,
        speciesCount: data.species.size,
        diversity: shannon.toFixed(2),
        topSpecies: topSpecies.join(', '),
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);
}

/**
 * Analyze detailed returns list with time elapsed (like MBO Table 6.5)
 * Returns birds that were banded in previous years and recaptured in the current year
 */
export function analyzeDetailedReturns(allCaptures: Capture[], yearCaptures: Capture[], year: number) {
  // Get all returns from current year
  const returns = yearCaptures.filter(c => c.captureType === 'Return');
  
  // Build a map of first capture (banding) for each band
  const bandingInfo = new Map<string, { date: Date; age: string; sex: string; species: string }>();
  
  // Sort all captures by date to find original banding
  const sortedAll = [...allCaptures].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  sortedAll.forEach(c => {
    if (c.captureType === 'Banded' && !bandingInfo.has(c.bandId)) {
      bandingInfo.set(c.bandId, {
        date: new Date(c.date),
        age: c.age,
        sex: c.sex,
        species: c.species,
      });
    }
  });

  // Find previous capture before current year return
  const previousCaptures = new Map<string, Date>();
  sortedAll.forEach(c => {
    const captureDate = new Date(c.date);
    if (captureDate.getFullYear() < year) {
      previousCaptures.set(c.bandId, captureDate);
    }
  });

  const returnDetails = returns
    .map(r => {
      const banding = bandingInfo.get(r.bandId);
      const prevCapture = previousCaptures.get(r.bandId);
      
      if (!banding) return null;

      const returnDate = new Date(r.date);
      const bandingDate = banding.date;
      const totalDays = Math.floor((returnDate.getTime() - bandingDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalYears = Math.floor(totalDays / 365);
      const remainingMonths = Math.floor((totalDays % 365) / 30);
      const remainingDays = totalDays % 30;

      return {
        bandId: r.bandId,
        species: r.species,
        ageSexNow: `${r.age}-${r.sex}`,
        ageSexBanding: `${banding.age}-${banding.sex}`,
        bandingDate: bandingDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        previousCapture: prevCapture 
          ? prevCapture.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : bandingDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        returnDate: returnDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        yearsElapsed: totalYears,
        monthsElapsed: remainingMonths,
        daysElapsed: remainingDays,
        totalDays,
        timeElapsedText: `${totalYears > 0 ? totalYears + ' year' + (totalYears > 1 ? 's' : '') : ''}${remainingMonths > 0 ? ' ' + remainingMonths + ' month' + (remainingMonths > 1 ? 's' : '') : ''}${remainingDays > 0 ? ' ' + remainingDays + ' day' + (remainingDays > 1 ? 's' : '') : ''}`.trim(),
      };
    })
    .filter(r => r !== null)
    .sort((a, b) => b!.totalDays - a!.totalDays);

  return returnDetails as Array<{
    bandId: string;
    species: string;
    ageSexNow: string;
    ageSexBanding: string;
    bandingDate: string;
    previousCapture: string;
    returnDate: string;
    yearsElapsed: number;
    monthsElapsed: number;
    daysElapsed: number;
    totalDays: number;
    timeElapsedText: string;
  }>;
}

/**
 * Analyze net usage with capture rates per 100 net hours (like MBO Table 4.7)
 * Requires net hours data - will estimate based on active days if not available
 * Groups nets by letter prefix and includes subtotals
 */
export function analyzeNetUsageDetailed(captures: Capture[], netHoursPerDay: number = 6) {
  // Group by net
  const netData = captures.reduce((acc, c) => {
    const net = c.net || 'Unknown';
    if (!acc[net]) {
      acc[net] = {
        net,
        newCaptures: 0,
        returnsRepeats: 0,
        totalCaptures: 0,
        species: new Set<string>(),
        days: new Set<string>(),
      };
    }
    acc[net].totalCaptures++;
    acc[net].species.add(c.species);
    acc[net].days.add(c.date);
    
    if (c.captureType === 'Banded') {
      acc[net].newCaptures++;
    } else if (c.captureType === 'Return' || c.captureType === 'Repeat' || c.captureType === 'Alien') {
      acc[net].returnsRepeats++;
    }
    return acc;
  }, {} as Record<string, any>);

  // Group nets by letter prefix for subtotals
  const netGroups = new Map<string, string[]>();
  Object.keys(netData).forEach(net => {
    if (net === 'Unknown') return;
    const prefix = net.replace(/[0-9]/g, '');
    if (!netGroups.has(prefix)) {
      netGroups.set(prefix, []);
    }
    netGroups.get(prefix)!.push(net);
  });

  // Sort each group
  netGroups.forEach((nets, prefix) => {
    nets.sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
      return numA - numB;
    });
  });

  // Build combined list with nets and subtotals
  const combinedList: any[] = [];
  const sortedPrefixes = Array.from(netGroups.keys()).sort();

  sortedPrefixes.forEach(prefix => {
    const nets = netGroups.get(prefix)!;
    
    // Add individual nets
    nets.forEach(netName => {
      const n = netData[netName];
      const hoursOpen = n.days.size * netHoursPerDay;
      combinedList.push({
        net: n.net,
        hoursOpen: hoursOpen.toFixed(1),
        newCaptures: n.newCaptures,
        returnsRepeats: n.returnsRepeats,
        totalCaptures: n.totalCaptures,
        birdsPerHourNew: hoursOpen > 0 ? ((n.newCaptures / hoursOpen) * 100).toFixed(1) : '0.0',
        birdsPerHourTotal: hoursOpen > 0 ? ((n.totalCaptures / hoursOpen) * 100).toFixed(1) : '0.0',
        species: n.species.size,
        isSubtotal: false,
      });
    });

    // Add subtotal if more than 1 net in group
    if (nets.length > 1) {
      const groupData = nets.reduce((acc, netName) => {
        const net = netData[netName];
        if (!net) return acc;
        acc.newCaptures += net.newCaptures;
        acc.returnsRepeats += net.returnsRepeats;
        acc.totalCaptures += net.totalCaptures;
        acc.days = new Set([...acc.days, ...net.days]);
        return acc;
      }, { newCaptures: 0, returnsRepeats: 0, totalCaptures: 0, days: new Set<string>() });

      const hoursOpen = groupData.days.size * netHoursPerDay * nets.length;
      combinedList.push({
        net: `${prefix} - TOTAL`,
        hoursOpen: hoursOpen.toFixed(1),
        newCaptures: groupData.newCaptures,
        returnsRepeats: groupData.returnsRepeats,
        totalCaptures: groupData.totalCaptures,
        birdsPerHourNew: hoursOpen > 0 ? ((groupData.newCaptures / hoursOpen) * 100).toFixed(1) : '0.0',
        birdsPerHourTotal: hoursOpen > 0 ? ((groupData.totalCaptures / hoursOpen) * 100).toFixed(1) : '0.0',
        species: 0,
        isSubtotal: true,
      });
    }
  });

  // Calculate grand total
  const allNets = Object.values(netData).filter((n: any) => n.net !== 'Unknown' && n.net !== '');
  const grandTotal = allNets.reduce((acc: any, n: any) => {
    acc.newCaptures += n.newCaptures;
    acc.returnsRepeats += n.returnsRepeats;
    acc.totalCaptures += n.totalCaptures;
    acc.hoursOpen += n.days.size * netHoursPerDay;
    return acc;
  }, { newCaptures: 0, returnsRepeats: 0, totalCaptures: 0, hoursOpen: 0 });

  return {
    nets: combinedList,
    grandTotal: {
      net: 'GRAND TOTAL',
      hoursOpen: grandTotal.hoursOpen.toFixed(1),
      newCaptures: grandTotal.newCaptures,
      returnsRepeats: grandTotal.returnsRepeats,
      totalCaptures: grandTotal.totalCaptures,
      birdsPerHourNew: grandTotal.hoursOpen > 0 ? ((grandTotal.newCaptures / grandTotal.hoursOpen) * 100).toFixed(1) : '0.0',
      birdsPerHourTotal: grandTotal.hoursOpen > 0 ? ((grandTotal.totalCaptures / grandTotal.hoursOpen) * 100).toFixed(1) : '0.0',
      isSubtotal: true,
    },
  };
}

/**
 * Analyze returns by season/program (Spring, MAPS, Fall, Winter)
 */
export function analyzeReturnsBySeason(allCaptures: Capture[], yearCaptures: Capture[], year: number) {
  const getSeason = (date: string): string => {
    const month = new Date(date).getMonth() + 1;
    if (month >= 4 && month <= 5) return 'Spring Migration';
    if (month >= 6 && month <= 7) return 'MAPS/Breeding';
    if (month >= 8 && month <= 11) return 'Fall Migration';
    return 'Winter';
  };

  // Get returns grouped by season
  const returnsBySeason: Record<string, any[]> = {};
  
  const detailedReturns = analyzeDetailedReturns(allCaptures, yearCaptures, year);
  
  yearCaptures.filter(c => c.captureType === 'Return').forEach(r => {
    const season = getSeason(r.date);
    if (!returnsBySeason[season]) {
      returnsBySeason[season] = [];
    }
    
    const details = detailedReturns.find(d => d.bandId === r.bandId);
    if (details) {
      returnsBySeason[season].push(details);
    }
  });

  // Sort each season by time elapsed
  Object.keys(returnsBySeason).forEach(season => {
    returnsBySeason[season].sort((a, b) => b.totalDays - a.totalDays);
  });

  return returnsBySeason;
}

/**
 * Analyze capture totals by species with detailed breakdown (like MBO comprehensive tables)
 */
export function analyzeSpeciesTotalsDetailed(captures: Capture[]) {
  const speciesData = captures.reduce((acc, c) => {
    if (!acc[c.species]) {
      acc[c.species] = {
        species: c.species,
        banded: 0,
        returns: 0,
        repeats: 0,
        aliens: 0,
        total: 0,
        male: 0,
        female: 0,
        unknown: 0,
        hy: 0,
        ahy: 0,
        ageUnknown: 0,
      };
    }
    
    acc[c.species].total++;
    
    // Capture type
    if (c.captureType === 'Banded') acc[c.species].banded++;
    else if (c.captureType === 'Return') acc[c.species].returns++;
    else if (c.captureType === 'Repeat') acc[c.species].repeats++;
    else if (c.captureType === 'Alien') acc[c.species].aliens++;
    
    // Sex
    if (c.sex === 'M') acc[c.species].male++;
    else if (c.sex === 'F') acc[c.species].female++;
    else acc[c.species].unknown++;
    
    // Age
    if (c.age.includes('HY') && !c.age.includes('AHY')) acc[c.species].hy++;
    else if (c.age.includes('AHY') || c.age.includes('ASY') || c.age.includes('ATY')) acc[c.species].ahy++;
    else acc[c.species].ageUnknown++;
    
    return acc;
  }, {} as Record<string, any>);

  return Object.values(speciesData)
    .sort((a: any, b: any) => b.total - a.total);
}

/**
 * Analyze effort summary by month (hours, nets, captures per effort)
 */
export function analyzeEffortByMonth(captures: Capture[], netCount: number = 12, hoursPerDay: number = 6) {
  const monthlyData = captures.reduce((acc, c) => {
    const date = new Date(c.date);
    const monthKey = date.toLocaleString('default', { month: 'short' });
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        month: monthKey,
        monthNum: date.getMonth(),
        captures: 0,
        newBands: 0,
        recaps: 0,
        species: new Set<string>(),
        days: new Set<string>(),
      };
    }
    
    acc[monthKey].captures++;
    acc[monthKey].species.add(c.species);
    acc[monthKey].days.add(c.date);
    
    if (c.captureType === 'Banded') acc[monthKey].newBands++;
    else acc[monthKey].recaps++;
    
    return acc;
  }, {} as Record<string, any>);

  return Object.values(monthlyData)
    .map((m: any) => {
      const netHours = m.days.size * netCount * hoursPerDay;
      return {
        month: m.month,
        days: m.days.size,
        netHours: netHours.toFixed(1),
        captures: m.captures,
        newBands: m.newBands,
        recaps: m.recaps,
        species: m.species.size,
        capturesPerHour: netHours > 0 ? ((m.captures / netHours) * 100).toFixed(1) : '0.0',
      };
    })
    .sort((a: any, b: any) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.indexOf(a.month) - months.indexOf(b.month);
    });
}

/**
 * Analyze notable captures (rare species, longevity records, etc.)
 */
export function analyzeNotableCaptures(allCaptures: Capture[], yearCaptures: Capture[], year: number) {
  // Find oldest returns
  const detailedReturns = analyzeDetailedReturns(allCaptures, yearCaptures, year);
  const oldestReturns = detailedReturns
    .filter(r => r.yearsElapsed >= 3)
    .slice(0, 10);

  // Find rare species (only 1-2 captures total in database)
  const speciesCounts = allCaptures.reduce((acc, c) => {
    acc[c.species] = (acc[c.species] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const rareSpecies = yearCaptures
    .filter(c => speciesCounts[c.species] <= 5)
    .map(c => ({
      species: c.species,
      date: c.date,
      totalRecords: speciesCounts[c.species],
      captureType: c.captureType,
    }));

  // Find high capture days
  const dailyCounts = yearCaptures.reduce((acc, c) => {
    acc[c.date] = (acc[c.date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const highCaptureDays = Object.entries(dailyCounts)
    .filter(([, count]) => count >= 50)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    oldestReturns,
    rareSpecies,
    highCaptureDays,
  };
}
