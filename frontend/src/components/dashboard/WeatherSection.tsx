import { useState } from 'react';
import { CloudSun, Droplets, Thermometer } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { buildFallbackImage, buildWeatherImage } from '@/utils/mediaImages';

function formatWeatherDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function WeatherSection() {
  const { currentTrip, refreshWeather } = useTripStore();
  const [refreshing, setRefreshing] = useState(false);
  const [imageErrorByDate, setImageErrorByDate] = useState<Record<string, boolean>>({});
  if (!currentTrip) return null;

  const destination = currentTrip.formData.destinations[0] || 'destination';

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div>
          <h2 className="section-title">Weather</h2>
          <p style={{ fontSize: 13, color: 'var(--navy-500)', marginTop: 4 }}>
            Informational forecast. Read-only for users.
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true);
            try {
              await refreshWeather();
            } finally {
              setRefreshing(false);
            }
          }}
        >
          {refreshing ? 'Refreshing...' : 'Refresh weather'}
        </button>
      </div>

      {currentTrip.weather.length === 0 ? (
        <div className="item-card" style={{ textAlign: 'center', color: 'var(--navy-500)' }}>
          No forecast yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
          {currentTrip.weather.map((day) => {
            const weatherSeed = `weather-${currentTrip.id}-${day.date}`;
            const weatherPrompt = `${day.condition || ''} ${day.icon || ''}`.trim() || 'forecast';
            const showImageFallback = imageErrorByDate[day.date];

            return (
              <div key={day.date} className="item-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'relative', height: 118, background: 'var(--navy-100)' }}>
                  {showImageFallback ? (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'grid',
                        placeItems: 'center',
                        background: 'linear-gradient(135deg, #dbeafe, #e2e8f0)',
                      }}
                    >
                      <CloudSun size={22} style={{ color: 'var(--navy-500)' }} />
                    </div>
                  ) : (
                    <img
                      src={buildWeatherImage(weatherPrompt, destination, 620, 360, weatherSeed)}
                      alt={`${day.condition || 'Forecast'} in ${destination}`}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallback === '1') {
                          setImageErrorByDate((prev) => ({ ...prev, [day.date]: true }));
                          return;
                        }
                        img.dataset.fallback = '1';
                        img.src = buildFallbackImage(weatherSeed, 620, 360);
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0.05))',
                      pointerEvents: 'none',
                    }}
                  />
                  <div style={{ position: 'absolute', left: 10, bottom: 8, color: 'white' }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>{formatWeatherDate(day.date)}</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                      {day.highTempC ?? '-'} C / {day.lowTempC ?? '-'} C
                    </p>
                  </div>
                </div>

                <div style={{ padding: 10, display: 'grid', gap: 4 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>
                    {day.icon ? `${day.icon} ` : ''}{day.condition || 'Forecast'}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Thermometer size={12} />
                    Feels seasonal for this date.
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Droplets size={12} />
                    Humidity: {day.humidityPct ?? '-'}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
