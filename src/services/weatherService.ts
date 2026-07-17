import type { Weather } from "../types/DET";

const MBO_LAT = 45.43075783523065;
const MBO_LON = -73.93855172247436;

type HourlyWeatherResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    relative_humidity_2m?: Array<number | null>;
    precipitation?: Array<number | null>;
    snowfall?: Array<number | null>;
    snow_depth?: Array<number | null>;
    cloudcover?: Array<number | null>;
    windspeed_10m?: Array<number | null>;
    winddirection_10m?: Array<number | null>;
  };
};

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

    const [dailyResponse, hourlyResponse] = await Promise.all([fetch(dailyUrl), fetch(hourlyUrl)]);

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
        const depths = hourlyData.hourly.snow_depth.filter(
          (d: number | null) => d !== null && d !== undefined
        ) as number[];
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

export async function fetchWeatherForDateTimeRange(
  date: string,
  startTime: string,
  endTime: string
): Promise<Weather | null> {
  try {
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return null;
    }

    const startHour = Math.floor(startMinutes / 60) * 60;
    const endHour = Math.floor(endMinutes / 60) * 60;
    const hourlyUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${MBO_LAT}&longitude=${MBO_LON}&start_date=${date}&end_date=${date}&hourly=temperature_2m,relative_humidity_2m,precipitation,snowfall,snow_depth,cloudcover,windspeed_10m,winddirection_10m&timezone=America/Toronto`;

    const response = await fetch(hourlyUrl);
    if (!response.ok) {
      console.error("Weather API error:", response.status);
      return null;
    }

    const data = (await response.json()) as HourlyWeatherResponse;
    const times = data.hourly?.time;
    if (!times?.length) return null;

    const indexes = times
      .map((time, index) => ({ index, minutes: parseTimeToMinutes(time.slice(11, 16)) }))
      .filter(({ minutes }) => minutes !== null && minutes >= startHour && minutes <= endHour)
      .map(({ index }) => index);

    if (indexes.length === 0) return null;

    const temperatures = valuesAt(data.hourly?.temperature_2m, indexes);
    const precipitation = valuesAt(data.hourly?.precipitation, indexes);
    const snowfall = valuesAt(data.hourly?.snowfall, indexes);
    const snowDepth = valuesAt(data.hourly?.snow_depth, indexes).map((depthMeters) => depthMeters * 100);
    const cloudCover = valuesAt(data.hourly?.cloudcover, indexes);
    const windSpeeds = valuesAt(data.hourly?.windspeed_10m, indexes);
    const windDirections = valuesAt(data.hourly?.winddirection_10m, indexes);
    const humidity = valuesAt(data.hourly?.relative_humidity_2m, indexes);

    return {
      dailyHighTemp: max(temperatures),
      dailyLowTemp: min(temperatures),
      dailyMeanTemp: mean(temperatures),
      cloudCoverage: mean(cloudCover),
      totalRainfallMm: sum(precipitation),
      totalSnowCm: sum(snowfall),
      meanSnowDepthCm: mean(snowDepth),
      maxSnowDepthCm: max(snowDepth),
      windSpeed: max(windSpeeds),
      windDirection: meanWindDirection(windDirections),
      humidity: mean(humidity),
    };
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    return null;
  }
}

export async function fetchWeatherForDateRange(startDate: string, endDate: string): Promise<Map<string, Weather>> {
  const results = new Map<string, Weather>();

  try {
    const dailyUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${MBO_LAT}&longitude=${MBO_LON}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,snowfall_sum,windspeed_10m_max,winddirection_10m_dominant,cloudcover_mean&timezone=America/Toronto`;
    const hourlyUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${MBO_LAT}&longitude=${MBO_LON}&start_date=${startDate}&end_date=${endDate}&hourly=snow_depth&timezone=America/Toronto`;

    const [dailyResponse, hourlyResponse] = await Promise.all([fetch(dailyUrl), fetch(hourlyUrl)]);

    if (!dailyResponse.ok) {
      console.error("Weather API error:", dailyResponse.status);
      return results;
    }

    const dailyData = await dailyResponse.json();
    if (!dailyData.daily?.time?.length) {
      return results;
    }

    const snowDepthByDate = new Map<string, { sum: number; count: number; max: number }>();
    if (hourlyResponse.ok) {
      const hourlyData = await hourlyResponse.json();
      const times: string[] | undefined = hourlyData.hourly?.time;
      const depths: Array<number | null> | undefined = hourlyData.hourly?.snow_depth;

      if (times && depths && times.length === depths.length) {
        for (let i = 0; i < times.length; i++) {
          const depth = depths[i];
          if (depth === null || depth === undefined) continue;
          const date = times[i].slice(0, 10);
          const depthCm = depth * 100;
          const existing = snowDepthByDate.get(date) || { sum: 0, count: 0, max: -Infinity };
          existing.sum += depthCm;
          existing.count += 1;
          existing.max = Math.max(existing.max, depthCm);
          snowDepthByDate.set(date, existing);
        }
      }
    }

    for (let i = 0; i < dailyData.daily.time.length; i++) {
      const date = dailyData.daily.time[i];
      const windDirectionDegrees = dailyData.daily.winddirection_10m_dominant?.[i];
      const windDirection = windDirectionDegrees !== undefined ? degreesToCardinal(windDirectionDegrees) : undefined;

      const snowDepthStats = snowDepthByDate.get(date);
      const meanSnowDepthCm =
        snowDepthStats && snowDepthStats.count > 0 ? snowDepthStats.sum / snowDepthStats.count : undefined;
      const maxSnowDepthCm = snowDepthStats && snowDepthStats.count > 0 ? snowDepthStats.max : undefined;

      results.set(date, {
        dailyHighTemp: dailyData.daily.temperature_2m_max?.[i],
        dailyLowTemp: dailyData.daily.temperature_2m_min?.[i],
        dailyMeanTemp: dailyData.daily.temperature_2m_mean?.[i],
        cloudCoverage: dailyData.daily.cloudcover_mean?.[i],
        totalRainfallMm: dailyData.daily.precipitation_sum?.[i],
        totalSnowCm: dailyData.daily.snowfall_sum?.[i],
        meanSnowDepthCm,
        maxSnowDepthCm,
        windSpeed: dailyData.daily.windspeed_10m_max?.[i],
        windDirection,
      });
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    return results;
  }
}

function degreesToCardinal(degrees: number): string {
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function parseTimeToMinutes(time: string): number | null {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function valuesAt(values: Array<number | null> | undefined, indexes: number[]): number[] {
  if (!values) return [];
  return indexes.flatMap((index) => {
    const value = values[index];
    return value === null || value === undefined ? [] : [value];
  });
}

function sum(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return sum(values)! / values.length;
}

function max(values: number[]): number | undefined {
  return values.length > 0 ? Math.max(...values) : undefined;
}

function min(values: number[]): number | undefined {
  return values.length > 0 ? Math.min(...values) : undefined;
}

function meanWindDirection(values: number[]): string | undefined {
  if (values.length === 0) return undefined;

  const vector = values.reduce(
    (acc, degrees) => {
      const radians = (degrees * Math.PI) / 180;
      return {
        x: acc.x + Math.sin(radians),
        y: acc.y + Math.cos(radians),
      };
    },
    { x: 0, y: 0 }
  );
  const degrees = (Math.atan2(vector.x, vector.y) * 180) / Math.PI;
  return degreesToCardinal((degrees + 360) % 360);
}
