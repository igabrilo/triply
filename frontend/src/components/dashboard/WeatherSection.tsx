import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudOff, ChevronDown, Droplets, Wind, RefreshCw,
} from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useWeather, getWeatherIcon, getWeatherIconBg, getWeatherIconColor, convertTemp } from '@/hooks/useWeather';
import type { TemperatureUnit, WeatherDay } from '@/types';

/* ─── Helpers ─── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatHour(dt: number): string {
  const d = new Date(dt * 1000);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Generate all dates between start and end (inclusive) */
function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + 'T12:00:00');
  const last = new Date(end + 'T12:00:00');
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

/* ─── Component ─── */

export default function WeatherSection() {
  const { currentTrip } = useTripStore();
  const [unit, setUnit] = useState<TemperatureUnit>('celsius');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const city = currentTrip?.formData?.destinations?.[0];
  const startDate = currentTrip?.formData?.startDate || '';
  const endDate = currentTrip?.formData?.endDate || '';

  const { weatherData, loading, error, refetch } = useWeather(city, startDate, endDate);

  const tripDates = useMemo(
    () => (startDate && endDate ? getDateRange(startDate, endDate) : []),
    [startDate, endDate],
  );

  const weatherByDate = useMemo(() => {
    const map = new Map<string, WeatherDay>();
    if (weatherData) {
      for (const day of weatherData.days) map.set(day.date, day);
    }
    return map;
  }, [weatherData]);

  const toggleExpand = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const unitLabel = unit === 'celsius' ? '°C' : '°F';

  if (!currentTrip) return null;

  /* ─── No API key state ─── */
  if (!import.meta.env?.VITE_OPENWEATHERMAP_API_KEY) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--navy-50)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <CloudOff size={24} style={{ color: 'var(--navy-400)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy-800)', marginBottom: 4 }}>
            Weather forecast unavailable
          </p>
          <p style={{ fontSize: 13, color: 'var(--navy-500)', maxWidth: 340, lineHeight: 1.5 }}>
            Add your OpenWeatherMap API key to <code style={{ fontSize: 12, background: 'var(--navy-50)', padding: '1px 6px', borderRadius: 4 }}>.env</code> as <code style={{ fontSize: 12, background: 'var(--navy-50)', padding: '1px 6px', borderRadius: 4 }}>VITE_OPENWEATHERMAP_API_KEY</code> to enable weather forecasts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Header */}
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="section-title">Weather</h2>
          {/* C / F toggle */}
          <div style={{ display: 'flex', gap: 2 }}>
            {(['celsius', 'fahrenheit'] as TemperatureUnit[]).map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                style={{
                  fontSize: 12,
                  fontWeight: unit === u ? 600 : 500,
                  color: unit === u ? 'var(--primary-700)' : 'var(--navy-500)',
                  background: unit === u ? 'var(--primary-50)' : 'transparent',
                  border: unit === u ? '1px solid var(--primary-200)' : '1px solid var(--navy-100)',
                  padding: '4px 12px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {u === 'celsius' ? '°C' : '°F'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={refetch}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: 'var(--primary-600)',
            background: 'none', border: 'none', cursor: 'pointer',
            transition: 'color 0.15s ease',
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Subtitle */}
      <p style={{ fontSize: 13, color: 'var(--navy-500)', marginBottom: 16 }}>
        {weatherData?.city || city} · {formatDate(startDate)} — {formatDate(endDate)}
      </p>

      {/* Info banner for limited forecast */}
      {tripDates.length > 0 && weatherData && weatherData.days.length < tripDates.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '10px 14px', marginBottom: 14, borderRadius: 12,
            background: 'var(--primary-50)', border: '1px solid var(--primary-100)',
            fontSize: 13, color: 'var(--primary-700)', lineHeight: 1.5,
          }}
        >
          Daily forecasts cover up to 16 days ahead. Remaining days will appear as your trip approaches.
        </motion.div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ padding: 16, border: '1px solid var(--navy-100)', borderRadius: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="gen-skeleton" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="gen-skeleton" style={{ height: 14, width: `${55 + i * 6}%`, borderRadius: 4, marginBottom: 8 }} />
                  <div className="gen-skeleton" style={{ height: 10, width: `${30 + i * 8}%`, borderRadius: 4 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '32px 24px', textAlign: 'center',
        }}>
          <CloudOff size={24} style={{ color: 'var(--navy-400)', marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: 'var(--navy-600)', marginBottom: 12 }}>{error}</p>
          <button onClick={refetch} className="btn btn-secondary btn-sm">
            Try again
          </button>
        </div>
      )}

      {/* Day cards */}
      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tripDates.map((date, idx) => {
            const day = weatherByDate.get(date);
            const expanded = expandedDays.has(date);
            const dateObj = new Date(date + 'T12:00:00');
            const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const dateLabel = formatDate(date);

            if (!day) {
              /* ─── Not-yet-available placeholder ─── */
              return (
                <motion.div
                  key={date}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  style={{
                    padding: '16px 20px',
                    border: '1px dashed var(--navy-200)',
                    borderRadius: 14,
                    opacity: 0.55,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: 'var(--navy-50)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CloudOff size={16} style={{ color: 'var(--navy-400)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-600)' }}>
                      {dayOfWeek}, {dateLabel}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>
                      Forecast not yet available
                    </p>
                  </div>
                </motion.div>
              );
            }

            const Icon = getWeatherIcon(day.weatherCode);
            const iconBg = getWeatherIconBg(day.weatherCode);
            const iconColor = getWeatherIconColor(day.weatherCode);
            const hasHourly = day.hourly.length > 0;

            return (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
              >
                {/* ─── Day summary card ─── */}
                <div
                  onClick={hasHourly ? () => toggleExpand(date) : undefined}
                  style={{
                    padding: '18px 22px',
                    border: expanded ? '1px solid var(--primary-200)' : '1px solid var(--navy-100)',
                    borderRadius: expanded ? '14px 14px 0 0' : 14,
                    background: 'var(--surface)',
                    cursor: hasHourly ? 'pointer' : 'default',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  {/* Weather icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: iconBg, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={22} style={{ color: iconColor }} />
                  </div>

                  {/* Day info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>
                        {day.dayOfWeek}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--navy-400)' }}>
                        {dateLabel}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--navy-500)', marginTop: 2, textTransform: 'capitalize' }}>
                      {day.weatherDesc}
                    </p>
                  </div>

                  {/* Temps */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy-950)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {convertTemp(day.tempMax, unit)}{unitLabel}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--navy-400)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                      {convertTemp(day.tempMin, unit)}{unitLabel}
                    </p>
                  </div>

                  {/* Precip + Wind */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }} className="hide-mobile">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--info)' }}>
                      <Droplets size={13} /> {Math.round(day.pop * 100)}%
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--navy-500)' }}>
                      <Wind size={13} /> {day.windSpeed} m/s
                    </span>
                  </div>

                  {/* Chevron — only when hourly detail available */}
                  {hasHourly && (
                    <motion.div
                      animate={{ rotate: expanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ flexShrink: 0, color: 'var(--navy-400)' }}
                    >
                      <ChevronDown size={16} />
                    </motion.div>
                  )}
                </div>

                {/* ─── Expanded hourly detail ─── */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      key={`hourly-${date}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{
                        border: '1px solid var(--primary-200)',
                        borderTop: 'none',
                        borderRadius: '0 0 14px 14px',
                        background: 'var(--surface)',
                        padding: '4px 0',
                      }}>
                        {/* Hourly header */}
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          padding: '8px 22px', gap: 8,
                          borderBottom: '1px solid var(--navy-50)',
                        }}>
                          <span style={{ width: 52, fontSize: 11, fontWeight: 600, color: 'var(--navy-400)' }}>Time</span>
                          <span style={{ width: 32 }} />
                          <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--navy-400)' }}>Condition</span>
                          <span style={{ width: 48, fontSize: 11, fontWeight: 600, color: 'var(--navy-400)', textAlign: 'right' }}>Temp</span>
                          <span style={{ width: 48, fontSize: 11, fontWeight: 600, color: 'var(--navy-400)', textAlign: 'right' }}>Feels</span>
                          <span style={{ width: 48, fontSize: 11, fontWeight: 600, color: 'var(--navy-400)', textAlign: 'right' }} className="hide-mobile">
                            <Droplets size={11} />
                          </span>
                          <span style={{ width: 56, fontSize: 11, fontWeight: 600, color: 'var(--navy-400)', textAlign: 'right' }} className="hide-mobile">
                            <Wind size={11} />
                          </span>
                        </div>

                        {/* Hourly rows */}
                        {day.hourly.map((h, hIdx) => {
                          const HIcon = getWeatherIcon(h.weatherCode, h.icon.endsWith('n'));
                          const hIconColor = getWeatherIconColor(h.weatherCode);
                          const hBg = hIdx % 2 === 0 ? 'transparent' : 'var(--navy-50)';
                          return (
                            <div
                              key={h.dt}
                              style={{
                                display: 'flex', alignItems: 'center',
                                padding: '8px 22px', gap: 8,
                                background: hBg,
                                transition: 'background 0.1s ease',
                              }}
                            >
                              <span style={{ width: 52, fontSize: 13, fontWeight: 600, color: 'var(--navy-700)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatHour(h.dt)}
                              </span>
                              <div style={{
                                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                background: getWeatherIconBg(h.weatherCode),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <HIcon size={14} style={{ color: hIconColor }} />
                              </div>
                              <span style={{ flex: 1, fontSize: 13, color: 'var(--navy-600)', textTransform: 'capitalize' }}>
                                {h.weatherDesc}
                              </span>
                              <span style={{ width: 48, fontSize: 13, fontWeight: 600, color: 'var(--navy-900)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {convertTemp(h.temp, unit)}{unitLabel}
                              </span>
                              <span style={{ width: 48, fontSize: 12, color: 'var(--navy-500)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {convertTemp(h.feelsLike, unit)}{unitLabel}
                              </span>
                              <span style={{ width: 48, fontSize: 12, color: 'var(--info)', textAlign: 'right' }} className="hide-mobile">
                                {Math.round(h.pop * 100)}%
                              </span>
                              <span style={{ width: 56, fontSize: 12, color: 'var(--navy-500)', textAlign: 'right' }} className="hide-mobile">
                                {h.windSpeed} m/s
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
