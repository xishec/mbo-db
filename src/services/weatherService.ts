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
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${MBO_LAT}&longitude=${MBO_LON}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,windspeed_10m_max,winddirection_10m_dominant,cloudcover_mean&timezone=America/Toronto`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error("Weather API error:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (!data.daily) {
      return null;
    }

    const windDirectionDegrees = data.daily.winddirection_10m_dominant?.[0];
    const windDirection = windDirectionDegrees !== undefined ? degreesToCardinal(windDirectionDegrees) : undefined;

    return {
      temperature: data.daily.temperature_2m_mean?.[0],
      temperatureMin: data.daily.temperature_2m_min?.[0],
      temperatureMax: data.daily.temperature_2m_max?.[0],
      cloudCoverage: data.daily.cloudcover_mean?.[0],
      precipitation: data.daily.precipitation_sum?.[0],
      windSpeed: data.daily.windspeed_10m_max?.[0],
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
