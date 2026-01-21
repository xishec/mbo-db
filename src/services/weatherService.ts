import type { Weather } from "../types/DET";

const MBO_LAT = 45.43075783523065;
const MBO_LON = -73.93855172247436;

/**
 * Fetch historical weather data for MBO location on a specific date
 * Uses Open-Meteo API (free, no API key required)
 */
export async function fetchWeatherForDate(date: string): Promise<Weather | null> {
  try {
    // Format: YYYY-MM-DD
    // Fetch daily data for temperature, precipitation, snowfall, and wind
    const dailyUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${MBO_LAT}&longitude=${MBO_LON}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,snowfall_sum,windspeed_10m_max,winddirection_10m_dominant,cloudcover_mean&timezone=America/Toronto`;
    
    // Fetch hourly data for snow depth (mean and max)
    const hourlyUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${MBO_LAT}&longitude=${MBO_LON}&start_date=${date}&end_date=${date}&hourly=snow_depth&timezone=America/Toronto`;

    const [dailyResponse, hourlyResponse] = await Promise.all([
      fetch(dailyUrl),
      fetch(hourlyUrl),
    ]);

    if (!dailyResponse.ok) {
      console.error("Weather API error:", dailyResponse.status);
      return null;
    }

    const dailyData = await dailyResponse.json();
    
    if (!dailyData.daily) {
      return null;
    }

    // Process hourly snow depth data if available
    let meanSnowDepthCm: number | undefined;
    let maxSnowDepthCm: number | undefined;

    if (hourlyResponse.ok) {
      const hourlyData = await hourlyResponse.json();
      if (hourlyData.hourly?.snow_depth) {
        const depths = hourlyData.hourly.snow_depth.filter((d: number | null) => d !== null && d !== undefined) as number[];
        if (depths.length > 0) {
          // Convert from meters to cm
          const depthsCm = depths.map((d) => d * 100);
          meanSnowDepthCm = depthsCm.reduce((sum, d) => sum + d, 0) / depthsCm.length;
          maxSnowDepthCm = Math.max(...depthsCm);
        }
      }
    }

    const windDirectionDegrees = dailyData.daily.winddirection_10m_dominant?.[0];
    const windDirection = windDirectionDegrees !== undefined ? degreesToCardinal(windDirectionDegrees) : undefined;

    const temperatureMax = dailyData.daily.temperature_2m_max?.[0];
    const temperatureMin = dailyData.daily.temperature_2m_min?.[0];
    const temperatureMean = dailyData.daily.temperature_2m_mean?.[0];
    const snowfall = dailyData.daily.snowfall_sum?.[0]; // Already in cm

    return {
      // Daily temperature values (for aggregation)
      dailyHighTemp: temperatureMax,
      dailyLowTemp: temperatureMin,
      dailyMeanTemp: temperatureMean,
      cloudCoverage: dailyData.daily.cloudcover_mean?.[0],
      totalRainfallMm: dailyData.daily.precipitation_sum?.[0],
      totalSnowCm: snowfall,
      meanSnowDepthCm,
      maxSnowDepthCm,
      windSpeed: dailyData.daily.windspeed_10m_max?.[0],
      windDirection,
    };
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    return null;
  }
}

function degreesToCardinal(degrees: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}
