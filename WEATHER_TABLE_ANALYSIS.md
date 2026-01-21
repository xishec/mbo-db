# Weather Table Analysis

## Table Structure
The table shows weather conditions aggregated by month/period with a "Season" aggregate column.

## Required Properties for Weather Interface

To generate a table like Table 3.1, you need to store **daily** weather values that can then be **aggregated** by period (month/season).

### Current Issue
The current `Weather` interface stores:
- `highestTemp` / `lowestTemp` - These are extremes for a single day
- But to calculate "Mean daily high" and "Mean daily low" for a period, you need to store the daily high/low for each day, then average them

### Required Properties

#### Temperature (Daily values needed for aggregation)
1. **`dailyHighTemp`** - Daily high temperature (°C)
   - Used to calculate: "Mean daily high (°C)" = average of all dailyHighTemp in period
   - Used to calculate: "Highest temp (°C)" = max of all dailyHighTemp in period

2. **`dailyLowTemp`** - Daily low temperature (°C)
   - Used to calculate: "Mean daily low (°C)" = average of all dailyLowTemp in period
   - Used to calculate: "Lowest temp (°C)" = min of all dailyLowTemp in period

3. **`dailyMeanTemp`** - Daily mean temperature (°C)
   - Used to calculate: "Mean daily temp (°C)" = average of all dailyMeanTemp in period

#### Precipitation (Already have, but need to track counts)
4. **`totalRainfallMm`** ✅ (already have)
   - Used to calculate: "Total rain (mm)" = sum of all totalRainfallMm in period
   - Used to calculate: "# days with rainfall" = count of days where totalRainfallMm > 0

5. **`totalSnowCm`** ✅ (already have)
   - Used to calculate: "Total snow (cm)" = sum of all totalSnowCm in period
   - Used to calculate: "# days with snowfall" = count of days where totalSnowCm > 0

#### Snow Depth (Already have)
6. **`meanSnowDepthCm`** ✅ (already have)
   - Used to calculate: "Mean snow depth (cm)" = average of all meanSnowDepthCm in period

7. **`maxSnowDepthCm`** ✅ (already have)
   - Used to calculate: "Max. snow depth (cm)" = max of all maxSnowDepthCm in period

## Aggregation Logic

For each period (e.g., "Nov 7-30", "Dec 1-31", "Season"):

```typescript
interface PeriodWeatherSummary {
  // Temperature aggregates
  meanDailyHigh: number;      // Average of all dailyHighTemp
  meanDailyLow: number;        // Average of all dailyLowTemp
  meanDailyTemp: number;       // Average of all dailyMeanTemp
  highestTemp: number;         // Max of all dailyHighTemp
  lowestTemp: number;          // Min of all dailyLowTemp
  
  // Precipitation aggregates
  daysWithRainfall: number;    // Count of days where totalRainfallMm > 0
  totalRainMm: number;         // Sum of all totalRainfallMm
  daysWithSnowfall: number;    // Count of days where totalSnowCm > 0
  totalSnowCm: number;         // Sum of all totalSnowCm
  
  // Snow depth aggregates
  meanSnowDepthCm: number;     // Average of all meanSnowDepthCm
  maxSnowDepthCm: number;      // Max of all maxSnowDepthCm
}
```

## Updated Weather Interface Recommendation

```typescript
export interface Weather {
  // Daily temperature values (for aggregation)
  dailyHighTemp?: number;    // Daily high temp (°C) - for calculating "Mean daily high"
  dailyLowTemp?: number;      // Daily low temp (°C) - for calculating "Mean daily low"
  dailyMeanTemp?: number;     // Daily mean temp (°C) - for calculating "Mean daily temp"
  
  // Temperature extremes (can be same as daily values for single day, but useful for clarity)
  highestTemp?: number;        // Highest temp (°C) - for period max
  lowestTemp?: number;         // Lowest temp (°C) - for period min
  
  // Precipitation
  totalRainfallMm?: number;   // Total rain (mm) - for period sum
  totalSnowCm?: number;        // Total snow (cm) - for period sum
  
  // Snow depth
  meanSnowDepthCm?: number;    // Mean snow depth (cm) - for period average
  maxSnowDepthCm?: number;     // Max snow depth (cm) - for period max
  
  // Other (optional)
  cloudCoverage?: number;
  windSpeed?: number;
  windDirection?: string;
  humidity?: number;
  description?: string;
}
```

## Implementation Notes

1. The API provides `temperature_2m_max`, `temperature_2m_min`, and `temperature_2m_mean` - these should be stored as `dailyHighTemp`, `dailyLowTemp`, and `dailyMeanTemp`

2. For a single day, `highestTemp` = `dailyHighTemp` and `lowestTemp` = `dailyLowTemp`, but storing them separately makes the aggregation logic clearer

3. The `daysWithRainfall` and `daysWithSnowfall` are **derived** during aggregation by counting days where the values > 0, not stored per day
