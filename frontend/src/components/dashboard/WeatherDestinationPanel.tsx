import { useEffect, useMemo, useState } from 'react';
import {
   Cloud,
   CloudDrizzle,
   CloudFog,
   CloudLightning,
   CloudRain,
   CloudSnow,
   CloudSun,
   Sun,
} from 'lucide-react';

type WeatherIconType =
   | typeof Sun
   | typeof Cloud
   | typeof CloudDrizzle
   | typeof CloudRain
   | typeof CloudSnow
   | typeof CloudLightning
   | typeof CloudFog
   | typeof CloudSun;

interface OwmForecastItem {
   dt: number;
   main: {
      temp: number;
      feels_like: number;
      humidity: number;
      pressure: number;
   };
   weather: Array<{
      id: number;
      main: string;
      description: string;
   }>;
   wind: {
      speed: number;
      deg: number;
   };
   clouds?: {
      all: number;
   };
}

interface OwmForecastResponse {
   city: {
      name: string;
      coord: {
         lat: number;
         lon: number;
      };
   };
   list: OwmForecastItem[];
}

interface WeatherDestinationPanelProps {
   destinationLabel: string;
   lat: number | null;
   lng: number | null;
   forecastUnix: number;
   apiKey?: string;
}

const FORECAST_CACHE_TTL_MS = 10 * 60 * 1000;
const forecastCache = new Map<string, { fetchedAt: number; data: OwmForecastResponse }>();

function getCacheKey(lat: number, lng: number): string {
   return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function normalizeDestinationLabel(value: string): string {
   return value.trim().replace(/\s+/g, ' ');
}

function getDestinationCacheKey(destinationLabel: string): string {
   return `destination:${normalizeDestinationLabel(destinationLabel).toLowerCase()}`;
}

function getWindDirectionLabel(deg: number | undefined): string {
   if (typeof deg !== 'number' || !Number.isFinite(deg)) return '-';
   const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
   const normalized = ((deg % 360) + 360) % 360;
   const index = Math.round(normalized / 22.5) % 16;
   return directions[index];
}

function getWeatherIcon(code: number | undefined): WeatherIconType {
   if (typeof code !== 'number') return Cloud;
   if (code >= 200 && code < 300) return CloudLightning;
   if (code >= 300 && code < 400) return CloudDrizzle;
   if (code >= 500 && code < 600) return CloudRain;
   if (code >= 600 && code < 700) return CloudSnow;
   if (code >= 700 && code < 800) return CloudFog;
   if (code === 800) return Sun;
   if (code === 801) return CloudSun;
   return Cloud;
}

function formatForecastDate(unixSeconds: number): string {
   return new Date(unixSeconds * 1000).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
   });
}

function formatTemp(value: number | undefined): string {
   if (typeof value !== 'number' || !Number.isFinite(value)) return '-- °C';
   return `${Math.round(value)} °C`;
}

function formatNumber(value: number | undefined, suffix = ''): string {
   if (typeof value !== 'number' || !Number.isFinite(value)) return `--${suffix ? ` ${suffix}` : ''}`;
   return `${value.toFixed(1)}${suffix ? ` ${suffix}` : ''}`;
}

export default function WeatherDestinationPanel({
   destinationLabel,
   lat,
   lng,
   forecastUnix,
   apiKey,
}: WeatherDestinationPanelProps) {
   const [forecast, setForecast] = useState<OwmForecastResponse | null>(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      let cancelled = false;

      const fetchForecast = async () => {
         const normalizedDestination = normalizeDestinationLabel(destinationLabel);
         const hasDestinationQuery =
            normalizedDestination.length > 0 && normalizedDestination.toLowerCase() !== 'destination';
         const hasCoordinateFallback =
            lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

         if (!apiKey) {
            setForecast(null);
            setError('OpenWeather API key is missing.');
            return;
         }
         if (!hasDestinationQuery && !hasCoordinateFallback) {
            setForecast(null);
            setError('Weather location unavailable.');
            return;
         }

         setLoading(true);
         setError(null);
         try {
            const attempts: Array<{ cacheKey: string; query: URLSearchParams }> = [];

            if (hasDestinationQuery) {
               const q = new URLSearchParams();
               q.set('q', normalizedDestination);
               q.set('units', 'metric');
               q.set('appid', apiKey);
               attempts.push({
                  cacheKey: getDestinationCacheKey(normalizedDestination),
                  query: q,
               });
            }

            if (hasCoordinateFallback) {
               const q = new URLSearchParams();
               q.set('lat', String(lat));
               q.set('lon', String(lng));
               q.set('units', 'metric');
               q.set('appid', apiKey);
               attempts.push({
                  cacheKey: `coords:${getCacheKey(lat, lng)}`,
                  query: q,
               });
            }

            for (const attempt of attempts) {
               const cached = forecastCache.get(attempt.cacheKey);
               if (cached && Date.now() - cached.fetchedAt < FORECAST_CACHE_TTL_MS) {
                  setForecast(cached.data);
                  setError(null);
                  return;
               }

               const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?${attempt.query.toString()}`);
               if (!res.ok) {
                  continue;
               }

               const data = (await res.json()) as OwmForecastResponse;
               if (cancelled) return;

               forecastCache.set(attempt.cacheKey, { fetchedAt: Date.now(), data });
               setForecast(data);
               setError(null);
               return;
            }

            throw new Error('Could not find a forecast for the selected destination.');
         } catch {
            if (!cancelled) {
               setForecast(null);
               setError('Could not load weather details right now.');
            }
         } finally {
            if (!cancelled) {
               setLoading(false);
            }
         }
      };

      fetchForecast();
      return () => {
         cancelled = true;
      };
   }, [apiKey, destinationLabel, lat, lng]);

   const forecastEntry = useMemo(() => {
      if (!forecast?.list?.length) return null;
      let best = forecast.list[0];
      let bestDelta = Math.abs(best.dt - forecastUnix);

      for (let i = 1; i < forecast.list.length; i += 1) {
         const candidate = forecast.list[i];
         const delta = Math.abs(candidate.dt - forecastUnix);
         if (delta < bestDelta) {
            best = candidate;
            bestDelta = delta;
         }
      }

      return best;
   }, [forecast, forecastUnix]);

   const weatherCode = forecastEntry?.weather?.[0]?.id;
   const weatherDescription = forecastEntry?.weather?.[0]?.description || '-';
   const WeatherIcon = getWeatherIcon(weatherCode);
   const normalizedDestination = normalizeDestinationLabel(destinationLabel);
   const hasNamedDestination = normalizedDestination.length > 0 && normalizedDestination.toLowerCase() !== 'destination';
   const cityName = hasNamedDestination ? normalizedDestination : (forecast?.city?.name || 'Destination');
   const latLabel = (forecast?.city?.coord?.lat ?? lat ?? 0).toFixed(2);
   const lngLabel = (forecast?.city?.coord?.lon ?? lng ?? 0).toFixed(2);

   return (
      <div className="weather-destination-card">
         <div className="weather-destination-head">
            <h4>{cityName}</h4>
            <p>{latLabel}, {lngLabel}</p>
         </div>

         {loading && <p className="weather-destination-note">Loading weather details...</p>}
         {error && !loading && <p className="weather-destination-note weather-destination-note-error">{error}</p>}

         {!loading && !error && forecastEntry && (
            <>
               <div className="weather-destination-main">
                  <div>
                     <p className="weather-destination-temp">{formatTemp(forecastEntry.main.temp)}</p>
                     <p className="weather-destination-desc">{weatherDescription}</p>
                  </div>
                  <div className="weather-destination-icon" aria-hidden="true">
                     <WeatherIcon size={34} />
                  </div>
               </div>

               <div className="weather-destination-stats">
                  <p><span>Feels like</span><strong>{formatTemp(forecastEntry.main.feels_like)}</strong></p>
                  <p><span>Wind speed</span><strong>{formatNumber(forecastEntry.wind?.speed, 'm/s')}</strong></p>
                  <p><span>Wind direction</span><strong>{forecastEntry.wind?.deg ?? '--'}° {getWindDirectionLabel(forecastEntry.wind?.deg)}</strong></p>
                  <p><span>Humidity</span><strong>{typeof forecastEntry.main.humidity === 'number' ? `${Math.round(forecastEntry.main.humidity)} %` : '-- %'}</strong></p>
                  <p><span>Clouds</span><strong>{typeof forecastEntry.clouds?.all === 'number' ? `${Math.round(forecastEntry.clouds.all)} %` : '-- %'}</strong></p>
                  <p><span>Pressure</span><strong>{typeof forecastEntry.main.pressure === 'number' ? `${Math.round(forecastEntry.main.pressure)} hPa` : '-- hPa'}</strong></p>
               </div>

               <p className="weather-destination-updated">{formatForecastDate(forecastEntry.dt)}</p>
            </>
         )}
      </div>
   );
}
