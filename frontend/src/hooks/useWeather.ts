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

/** 16-day daily forecast entry (Developer plan) */
interface OWMDailyEntry {
  dt: number;
  temp: { day: number; min: number; max: number; night: number; eve: number; morn: number };
  feels_like: { day: number; night: number; eve: number; morn: number };
  pressure: number;
  humidity: number;
  weather: { id: number; main: string; description: string; icon: string }[];
  speed: number;
  deg: number;
  gust: number;
  clouds: number;
  pop: number;
  rain?: number;
  snow?: number;
}

interface OWMDailyResponse {
  list: OWMDailyEntry[];
  city: { name: string; coord: { lat: number; lon: number } };
}

/** Hourly / 3-hour forecast entry */
interface OWMHourlyEntry {
  dt: number;
  main: { temp: number; feels_like: number; temp_min: number; temp_max: number; humidity: number };
  weather: { id: number; main: string; description: string; icon: string }[];
  wind: { speed: number; deg: number };
  pop: number;
}

interface OWMHourlyResponse {
  list: OWMHourlyEntry[];
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

/* ─── Transform helpers ─── */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Build WeatherDay[] from the Developer plan 16-day daily + 4-day hourly responses. */
function transformDaily(
  daily: OWMDailyResponse,
  hourlyByDate: Map<string, WeatherHourly[]>,
  startDate: string,
  endDate: string,
): WeatherDay[] {
  const days: WeatherDay[] = [];

  for (const entry of daily.list) {
    const date = new Date(entry.dt * 1000).toISOString().slice(0, 10);
    if (date < startDate || date > endDate) continue;

    days.push({
      date,
      dayOfWeek: WEEKDAYS[new Date(date + 'T12:00:00').getDay()],
      tempMin: entry.temp.min,
      tempMax: entry.temp.max,
      weatherCode: entry.weather[0].id,
      weatherMain: entry.weather[0].main,
      weatherDesc: entry.weather[0].description,
      icon: entry.weather[0].icon,
      pop: entry.pop,
      humidity: entry.humidity,
      windSpeed: Math.round(entry.speed * 10) / 10,
      hourly: hourlyByDate.get(date) || [],
    });
  }

  return days.sort((a, b) => a.date.localeCompare(b.date));
}

/** Fallback: build WeatherDay[] from the free 5-day/3-hour forecast. */
function transformForecastFallback(raw: OWMHourlyResponse, startDate: string, endDate: string): WeatherDay[] {
  const grouped = new Map<string, OWMHourlyEntry[]>();

  for (const entry of raw.list) {
    const date = new Date(entry.dt * 1000).toISOString().slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(entry);
  }

  const days: WeatherDay[] = [];

  for (const [date, entries] of grouped) {
    if (date < startDate || date > endDate) continue;

    const tempMins = entries.map(e => e.main.temp_min);
    const tempMaxs = entries.map(e => e.main.temp_max);
    const midday = entries.filter(e => { const h = new Date(e.dt * 1000).getUTCHours(); return h >= 9 && h <= 15; });
    const rep = midday.length > 0 ? midday[0] : entries[Math.floor(entries.length / 2)];

    days.push({
      date,
      dayOfWeek: WEEKDAYS[new Date(date + 'T12:00:00').getDay()],
      tempMin: Math.min(...tempMins),
      tempMax: Math.max(...tempMaxs),
      weatherCode: rep.weather[0].id,
      weatherMain: rep.weather[0].main,
      weatherDesc: rep.weather[0].description,
      icon: rep.weather[0].icon,
      pop: Math.max(...entries.map(e => e.pop)),
      humidity: Math.round(entries.reduce((s, e) => s + e.main.humidity, 0) / entries.length),
      windSpeed: Math.round((entries.reduce((s, e) => s + e.wind.speed, 0) / entries.length) * 10) / 10,
      hourly: entries.map(e => ({
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
      })),
    });
  }

  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function groupHourlyByDate(raw: OWMHourlyResponse): Map<string, WeatherHourly[]> {
  const grouped = new Map<string, WeatherHourly[]>();

  for (const entry of raw.list) {
    const date = new Date(entry.dt * 1000).toISOString().slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push({
      dt: entry.dt,
      temp: entry.main.temp,
      feelsLike: entry.main.feels_like,
      humidity: entry.main.humidity,
      windSpeed: entry.wind.speed,
      windDeg: entry.wind.deg,
      pop: entry.pop,
      weatherCode: entry.weather[0].id,
      weatherMain: entry.weather[0].main,
      weatherDesc: entry.weather[0].description,
      icon: entry.weather[0].icon,
    });
  }

  return grouped;
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
  if (code >= 200 && code < 300) return '#7c3aed';
  if (code >= 300 && code < 500) return '#3b82f6';
  if (code >= 500 && code < 600) return '#2563eb';
  if (code >= 600 && code < 700) return '#6366f1';
  if (code >= 700 && code < 800) return '#94a3b8';
  if (code === 800) return '#f59e0b';
  if (code === 801) return '#f59e0b';
  return '#64748b';
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
  const cacheRef = useRef<{ city: string; startDate: string; endDate: string; fetchedAt: number; data: WeatherData } | null>(null);

  const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY as string | undefined;

  const fetchWeather = useCallback(async () => {
    if (!city || !apiKey) {
      if (!apiKey) setError('OpenWeatherMap API key not configured. Add VITE_OPENWEATHERMAP_API_KEY to your .env file.');
      return;
    }

    // Check cache
    const cached = cacheRef.current;
    if (cached && cached.city === city && cached.startDate === startDate && cached.endDate === endDate && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setWeatherData(cached.data);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { lat, lon } = await geocodeCity(city, apiKey);
      const base = `https://api.openweathermap.org/data/2.5`;
      const coords = `lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

      // Fetch Developer plan endpoints + free 5-day/3-hour in parallel
      const [dailyRes, hourlyRes, freeRes] = await Promise.all([
        fetch(`${base}/forecast/daily?${coords}&cnt=16`),
        fetch(`${base}/forecast/hourly?${coords}`),
        fetch(`${base}/forecast?${coords}`),
      ]);

      let days: WeatherDay[];
      let cityName: string;

      if (dailyRes.ok && hourlyRes.ok) {
        // Developer plan active — merge developer hourly (4-day) with free 3-hour (day 5)
        const jsonPromises: [Promise<OWMDailyResponse>, Promise<OWMHourlyResponse>] = [
          dailyRes.json(),
          hourlyRes.json(),
        ];
        const [dailyRaw, hourlyRaw] = await Promise.all(jsonPromises);
        const hourlyByDate = groupHourlyByDate(hourlyRaw);

        // Backfill days missing developer hourly data with free 3-hour data
        if (freeRes.ok) {
          const freeRaw: OWMHourlyResponse = await freeRes.json();
          const freeByDate = groupHourlyByDate(freeRaw);
          for (const [date, entries] of freeByDate) {
            if (!hourlyByDate.has(date)) {
              hourlyByDate.set(date, entries);
            }
          }
        }

        days = transformDaily(dailyRaw, hourlyByDate, startDate, endDate);
        cityName = dailyRaw.city.name;
      } else {
        // Fall back to free 5-day/3-hour endpoint
        if (!freeRes.ok) throw new Error('Failed to fetch weather forecast');
        const fallbackRaw: OWMHourlyResponse = await freeRes.json();
        days = transformForecastFallback(fallbackRaw, startDate, endDate);
        cityName = fallbackRaw.city.name;
      }

      const data: WeatherData = {
        city: cityName,
        lat,
        lon,
        days,
        fetchedAt: Date.now(),
      };

      cacheRef.current = { city, startDate, endDate, fetchedAt: Date.now(), data };
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
