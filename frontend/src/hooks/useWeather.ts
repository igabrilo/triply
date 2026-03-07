import { useState, useEffect, useRef, useCallback } from 'react';
import type { WeatherData, WeatherDay, WeatherHourly } from '@/types';
import {
  Sun, Cloud, CloudRain, CloudSnow, CloudDrizzle,
  CloudLightning, CloudFog, CloudSun,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ─── OWM raw response types ─── */

interface OWMGeoResult {
  lat: number;
  lon: number;
  name: string;
  country: string;
}

interface OWMForecastEntry {
  dt: number;
  main: { temp: number; feels_like: number; temp_min: number; temp_max: number; humidity: number };
  weather: { id: number; main: string; description: string; icon: string }[];
  wind: { speed: number; deg: number };
  pop: number;
}

interface OWMForecastResponse {
  list: OWMForecastEntry[];
  city: { name: string; coord: { lat: number; lon: number } };
}

/* ─── Geocoding cache ─── */

const geoCache = new Map<string, { lat: number; lon: number }>();

async function geocodeCity(city: string, apiKey: string): Promise<{ lat: number; lon: number }> {
  const key = city.toLowerCase().trim();
  if (geoCache.has(key)) return geoCache.get(key)!;

  const res = await fetch(
    `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`
  );
  if (!res.ok) throw new Error('Geocoding request failed');

  const data: OWMGeoResult[] = await res.json();
  if (!data.length) throw new Error(`Could not find location "${city}"`);

  const coords = { lat: data[0].lat, lon: data[0].lon };
  geoCache.set(key, coords);
  return coords;
}

/* ─── Forecast fetch + transform ─── */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function transformForecast(raw: OWMForecastResponse, startDate: string, endDate: string): WeatherDay[] {
  // Group 3-hour entries by date
  const grouped = new Map<string, OWMForecastEntry[]>();

  for (const entry of raw.list) {
    const date = new Date(entry.dt * 1000).toISOString().slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(entry);
  }

  const days: WeatherDay[] = [];

  for (const [date, entries] of grouped) {
    // Filter to trip date range
    if (date < startDate || date > endDate) continue;

    const tempMins = entries.map(e => e.main.temp_min);
    const tempMaxs = entries.map(e => e.main.temp_max);

    // Pick the most representative weather (prefer midday entries 9-15h)
    const middayEntries = entries.filter(e => {
      const h = new Date(e.dt * 1000).getUTCHours();
      return h >= 9 && h <= 15;
    });
    const representative = middayEntries.length > 0 ? middayEntries[0] : entries[Math.floor(entries.length / 2)];

    const dateObj = new Date(date + 'T12:00:00');

    const hourly: WeatherHourly[] = entries.map(e => ({
      dt: e.dt,
      temp: e.main.temp,
      feelsLike: e.main.feels_like,
      humidity: e.main.humidity,
      windSpeed: e.wind.speed,
      windDeg: e.wind.deg,
      pop: e.pop,
      weatherCode: e.weather[0].id,
      weatherMain: e.weather[0].main,
      weatherDesc: e.weather[0].description,
      icon: e.weather[0].icon,
    }));

    days.push({
      date,
      dayOfWeek: WEEKDAYS[dateObj.getDay()],
      tempMin: Math.min(...tempMins),
      tempMax: Math.max(...tempMaxs),
      weatherCode: representative.weather[0].id,
      weatherMain: representative.weather[0].main,
      weatherDesc: representative.weather[0].description,
      icon: representative.weather[0].icon,
      pop: Math.max(...entries.map(e => e.pop)),
      humidity: Math.round(entries.reduce((s, e) => s + e.main.humidity, 0) / entries.length),
      windSpeed: Math.round((entries.reduce((s, e) => s + e.wind.speed, 0) / entries.length) * 10) / 10,
      hourly,
    });
  }

  return days.sort((a, b) => a.date.localeCompare(b.date));
}

/* ─── Icon mapper ─── */

export function getWeatherIcon(code: number, isNight = false): LucideIcon {
  if (code >= 200 && code < 300) return CloudLightning;
  if (code >= 300 && code < 400) return CloudDrizzle;
  if (code >= 500 && code < 600) return CloudRain;
  if (code >= 600 && code < 700) return CloudSnow;
  if (code >= 700 && code < 800) return CloudFog;
  if (code === 800) return isNight ? Cloud : Sun;
  if (code === 801) return CloudSun;
  if (code >= 802) return Cloud;
  return Cloud;
}

export function getWeatherIconBg(code: number): string {
  if (code >= 200 && code < 300) return 'linear-gradient(135deg, #ede9fe, #c4b5fd)';
  if (code >= 300 && code < 500) return 'linear-gradient(135deg, #dbeafe, #bfdbfe)';
  if (code >= 500 && code < 600) return 'linear-gradient(135deg, #dbeafe, #93c5fd)';
  if (code >= 600 && code < 700) return 'linear-gradient(135deg, #e0e7ff, #c7d2fe)';
  if (code >= 700 && code < 800) return 'linear-gradient(135deg, var(--navy-100), var(--navy-50))';
  if (code === 800) return 'linear-gradient(135deg, #fef3c7, #fde68a)';
  if (code === 801) return 'linear-gradient(135deg, #fef9c3, #e0e7ff)';
  return 'linear-gradient(135deg, var(--navy-100), var(--navy-50))';
}

export function getWeatherIconColor(code: number): string {
  if (code >= 200 && code < 300) return '#7c3aed'; // purple for thunderstorm
  if (code >= 300 && code < 500) return '#3b82f6'; // blue for drizzle
  if (code >= 500 && code < 600) return '#2563eb'; // darker blue for rain
  if (code >= 600 && code < 700) return '#6366f1'; // indigo for snow
  if (code >= 700 && code < 800) return '#94a3b8'; // slate for fog
  if (code === 800) return '#f59e0b';               // amber for clear sun
  if (code === 801) return '#f59e0b';               // amber for partly cloudy
  return '#64748b';                                  // gray for clouds
}

/* ─── Temperature helper ─── */

export function convertTemp(celsius: number, unit: 'celsius' | 'fahrenheit'): number {
  if (unit === 'fahrenheit') return Math.round(celsius * 9 / 5 + 32);
  return Math.round(celsius);
}

/* ─── Hook ─── */

interface UseWeatherResult {
  weatherData: WeatherData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function useWeather(city: string | undefined, startDate: string, endDate: string): UseWeatherResult {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<{ city: string; fetchedAt: number; data: WeatherData } | null>(null);

  const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY as string | undefined;

  const fetchWeather = useCallback(async () => {
    if (!city || !apiKey) {
      if (!apiKey) setError('OpenWeatherMap API key not configured. Add VITE_OPENWEATHERMAP_API_KEY to your .env file.');
      return;
    }

    // Check cache
    const cached = cacheRef.current;
    if (cached && cached.city === city && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setWeatherData(cached.data);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { lat, lon } = await geocodeCity(city, apiKey);

      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
      );
      if (!res.ok) throw new Error('Failed to fetch weather forecast');

      const raw: OWMForecastResponse = await res.json();
      const days = transformForecast(raw, startDate, endDate);

      const data: WeatherData = {
        city: raw.city.name,
        lat,
        lon,
        days,
        fetchedAt: Date.now(),
      };

      cacheRef.current = { city, fetchedAt: Date.now(), data };
      setWeatherData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load weather data');
    } finally {
      setLoading(false);
    }
  }, [city, apiKey, startDate, endDate]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  return { weatherData, loading, error, refetch: fetchWeather };
}
