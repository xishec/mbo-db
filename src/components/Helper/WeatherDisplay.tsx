import type { Weather } from "../../types/DET";

interface WeatherDisplayProps {
  weather: Weather | undefined;
  isLoading?: boolean;
}

export default function WeatherDisplay({ weather, isLoading = false }: WeatherDisplayProps) {
  if (isLoading) {
    return <p className="text-sm text-gray-600">Loading weather data...</p>;
  }

  if (!weather) {
    return <p className="text-sm text-gray-600">No weather data available</p>;
  }

  const hasAnyData =
    weather.dailyHighTemp !== undefined ||
    weather.dailyLowTemp !== undefined ||
    weather.dailyMeanTemp !== undefined ||
    weather.cloudCoverage !== undefined ||
    weather.totalRainfallMm !== undefined ||
    weather.windSpeed !== undefined ||
    weather.totalSnowCm !== undefined ||
    weather.meanSnowDepthCm !== undefined ||
    weather.maxSnowDepthCm !== undefined ||
    weather.humidity !== undefined;

  return (
    <div className="text-sm text-gray-600 space-y-2">
      {/* Temperature Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {weather.dailyMeanTemp !== undefined && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Mean Temp</p>
            <p className="font-medium">{weather.dailyMeanTemp.toFixed(1)}°C</p>
          </div>
        )}
        {weather.dailyHighTemp !== undefined && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">High Temp</p>
            <p className="font-medium">{weather.dailyHighTemp.toFixed(1)}°C</p>
          </div>
        )}
        {weather.dailyLowTemp !== undefined && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Low Temp</p>
            <p className="font-medium">{weather.dailyLowTemp.toFixed(1)}°C</p>
          </div>
        )}
      </div>

      {/* Precipitation Section */}
      <div className="border-t border-default-100 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {weather.totalRainfallMm !== undefined && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Total Rain</p>
              <p className="font-medium">{weather.totalRainfallMm.toFixed(1)} mm</p>
            </div>
          )}
          {weather.totalSnowCm !== undefined && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Total Snow</p>
              <p className="font-medium">{weather.totalSnowCm.toFixed(1)} cm</p>
            </div>
          )}
          {weather.daysWithRainfall !== undefined && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Days with Rainfall</p>
              <p className="font-medium">{weather.daysWithRainfall}</p>
            </div>
          )}
          {weather.daysWithSnowfall !== undefined && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Days with Snowfall</p>
              <p className="font-medium">{weather.daysWithSnowfall}</p>
            </div>
          )}
        </div>
      </div>

      {/* Snow Depth Section */}
      {(weather.meanSnowDepthCm !== undefined || weather.maxSnowDepthCm !== undefined) && (
        <div className="border-t border-default-100 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {weather.meanSnowDepthCm !== undefined && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Mean Snow Depth</p>
                <p className="font-medium">{weather.meanSnowDepthCm.toFixed(1)} cm</p>
              </div>
            )}
            {weather.maxSnowDepthCm !== undefined && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Max Snow Depth</p>
                <p className="font-medium">{weather.maxSnowDepthCm.toFixed(1)} cm</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wind & Cloud Section */}
      <div className="border-t border-default-100 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {weather.windSpeed !== undefined && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Wind Speed</p>
              <p className="font-medium">
                {weather.windSpeed.toFixed(1)} km/h
                {weather.windDirection && ` ${weather.windDirection}`}
              </p>
            </div>
          )}
          {weather.cloudCoverage !== undefined && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Cloud Coverage</p>
              <p className="font-medium">{weather.cloudCoverage.toFixed(0)}%</p>
            </div>
          )}
          {weather.humidity !== undefined && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Humidity</p>
              <p className="font-medium">{weather.humidity.toFixed(0)}%</p>
            </div>
          )}
          {weather.description && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Conditions</p>
              <p className="font-medium">{weather.description}</p>
            </div>
          )}
        </div>
      </div>

      {!hasAnyData && <p className="text-gray-400">No weather data available</p>}
    </div>
  );
}
