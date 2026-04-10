import { memo, useState, useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Maximize2, ExternalLink, Map as MapIcon, CloudSun, X } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import Chip from '@components/ui/Chip';
import Modal from '@components/ui/Modal';
import WeatherParticlesLayer from '@components/dashboard/WeatherParticlesLayer';
import WeatherTimeSlider from '@components/dashboard/WeatherTimeSlider';
import WeatherDestinationPanel from '@components/dashboard/WeatherDestinationPanel';
import {
  clampForecastUnix,
  getInitialForecastUnix,
  getWeatherWindowBounds,
} from '@components/dashboard/weatherForecastUtils';
import type { Activity, Stay } from '@/types';
import { buildActivityImage, buildFallbackImage, buildPlacePhotoProxyUrl } from '@/utils/mediaImages';

import 'leaflet/dist/leaflet.css';

/* ── Category config ── */

interface CategoryMeta {
  color: string;
  icon: string;
}

const CATEGORY_MAP: Record<string, CategoryMeta> = {
  food: { color: '#ef4444', icon: '🍽️' },
  dining: { color: '#ef4444', icon: '🍽️' },
  museums: { color: '#8b5cf6', icon: '🏛️' },
  museum: { color: '#8b5cf6', icon: '🏛️' },
  nature: { color: '#22c55e', icon: '🌿' },
  landmarks: { color: '#f59e0b', icon: '🏰' },
  landmark: { color: '#f59e0b', icon: '🏰' },
  shopping: { color: '#ec4899', icon: '🛍️' },
  activity: { color: '#3b82f6', icon: '⭐' },
  transport: { color: '#6b7280', icon: '🚌' },
  nightlife: { color: '#a855f7', icon: '🌙' },
};

const DEFAULT_META: CategoryMeta = { color: '#3b82f6', icon: '📍' };
const FILTER_CATEGORIES = ['All', 'Food', 'Museums', 'Nature', 'Landmarks', 'Shopping'];

/* ── Weather map layers (OWM Weather Maps 2.0) ── */

interface WeatherLayerConfig {
  code: string;
  label: string;
  units: string;
  opacity: number;
  colors: string[];
  legendMin: string;
  legendMax: string;
  palette?: string;
  /** OWM query param; matches examples for TA2 etc. */
  fillBound?: boolean;
}

/** OWM Weather Maps 2.0 (3-hour step) layer ops — URL: /maps/2.0/weather/{op}/{z}/{x}/{y} */
const WEATHER_LAYERS: WeatherLayerConfig[] = [
  {
    code: 'TA2', label: 'Temperature', units: '°C', opacity: 0.52,
    colors: ['#5A2CA0', '#4E43BA', '#3F63D4', '#3F89E7', '#45B7E5', '#5BD093', '#A5DB5C', '#F0D84C', '#F6A13A', '#CA5A2D', '#5F1B10'],
    legendMin: '-70°', legendMax: '50°',
    palette: '-70:5A2CA0;-55:4E43BA;-40:3F63D4;-25:3F89E7;-10:45B7E5;0:5BD093;10:A5DB5C;20:F0D84C;30:F6A13A;40:CA5A2D;50:5F1B10',
    fillBound: true,
  },
  {
    code: 'PR0', label: 'Precipitation', units: 'mm/h', opacity: 0.68,
    colors: ['#E8F1F6', '#D6F5FF', '#B9EEFF', '#8DDEF7', '#66C7E4', '#66C69B', '#89C167', '#C1BA67', '#D694B3', '#B85CCF', '#8E3AB6'],
    legendMin: '0 mm/h', legendMax: '40 mm/h',
    palette: '0.000005:E8F1F6;0.000020:D6F5FF;0.000050:B9EEFF;0.000100:8DDEF7;0.000200:66C7E4;0.000400:66C69B;0.000700:89C167;0.001000:C1BA67;0.001400:D694B3;0.002000:B85CCF;0.003000:8E3AB6',
  },
  {
    code: 'CL', label: 'Clouds', units: '%', opacity: 0.5,
    colors: ['#F6F8FA', '#EFF4F7', '#E6EDF2', '#D8E3EA', '#C8D7E1', '#B5C8D5'],
    legendMin: '0%', legendMax: '100%',
    palette: '0:FFFFFF00;10:F5F8FB22;20:EEF4F844;40:E3ECF277;60:D8E3EAB3;80:C8D7E1D9;100:B5C8D5FF',
  },
  {
    code: 'WS10', label: 'Wind', units: 'm/s', opacity: 0.62,
    colors: ['#5C84C6', '#4F9FD1', '#54BFB1', '#67CE74', '#A5D84B', '#E4C948', '#F09A34', '#E35E2E', '#C8281F'],
    legendMin: '0 m/s', legendMax: '29 m/s',
    palette: '0:5C84C6;4:4F9FD1;8:54BFB1;12:67CE74;16:A5D84B;20:E4C948;24:F09A34;27:E35E2E;29:C8281F',
  },
  {
    code: 'HRD0', label: 'Humidity', units: '%', opacity: 0.62,
    colors: ['#C84531', '#D97B3E', '#E9BF57', '#A9D05E', '#5FBE8B', '#4C99CA', '#3A6ABD'],
    legendMin: '0%', legendMax: '100%',
    palette: '0:C84531;20:D97B3E;40:E9BF57;55:A9D05E;70:5FBE8B;85:4C99CA;100:3A6ABD',
  },
  {
    code: 'SD0', label: 'Snow', units: 'm', opacity: 0.62,
    colors: ['#F3FAFF', '#DDF3FF', '#BEEBFF', '#99DAFF', '#77C1F8', '#6298E6', '#6A6FD5', '#7C53C1'],
    legendMin: '0 m', legendMax: '4 m',
    palette: '0.05:F3FAFF;0.1:DDF3FF;0.2:BEEBFF;0.3:99DAFF;0.5:77C1F8;0.8:6298E6;1.2:6A6FD5;4.0:7C53C1',
  },
];

const OWM_RAW_KEY = (import.meta.env.VITE_OPENWEATHERMAP_API_KEY as string | undefined)?.trim();
const OWM_API_KEY =
  OWM_RAW_KEY && OWM_RAW_KEY !== 'your_key_here' && OWM_RAW_KEY.length > 0 ? OWM_RAW_KEY : undefined;

/** Standard WM 2.0 tiles: https://maps.openweathermap.org/maps/2.0/weather/{op}/{z}/{x}/{y}?appid=… */
function owmWeather2TileUrl(
  op: string,
  appId: string,
  tileOpacity: number,
  fillBound?: boolean,
  palette?: string,
  forecastDateUnix?: number,
): string {
  const q = new URLSearchParams();
  q.set('appid', appId);
  q.set('opacity', String(Math.min(1, Math.max(0, tileOpacity))));
  if (fillBound) q.set('fill_bound', 'true');
  if (palette) q.set('palette', palette);
  if (typeof forecastDateUnix === 'number') q.set('date', String(forecastDateUnix));
  return `https://maps.openweathermap.org/maps/2.0/weather/${op}/{z}/{x}/{y}?${q.toString()}`;
}

/** Imperative Leaflet layer — avoids react-leaflet TileLayer edge cases with OWM URLs. */
function OwmWeatherTileLayer({
  layerOp,
  appId,
  forecastDateUnix,
}: {
  layerOp: string;
  appId: string;
  forecastDateUnix?: number;
}) {
  const map = useMap();
  const layerCfg = WEATHER_LAYERS.find((l) => l.code === layerOp);
  const opacity = layerCfg?.opacity ?? 0.65;
  const fillBound = layerCfg?.fillBound;
  const palette = layerCfg?.palette;
  const layerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    const layer = L.tileLayer('', {
      attribution: '<span class="leaflet-attribution-weather">Weather</span> © <a href="https://openweathermap.org/">OpenWeather</a>',
      opacity: 1,
      maxZoom: 20,
      maxNativeZoom: 18,
    });
    layerRef.current = layer;
    layer.addTo(map);

    const onTileError = () => {
      console.warn(
        '[Triply] OpenWeatherMap tile failed (check VITE_OPENWEATHERMAP_API_KEY and Weather Maps 2.0 access).',
      );
    };
    layer.on('tileerror', onTileError);

    return () => {
      layer.off('tileerror', onTileError);
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const url = owmWeather2TileUrl(layerOp, appId, opacity, fillBound, palette, forecastDateUnix);
    layer.setUrl(url);
  }, [layerOp, appId, opacity, fillBound, palette, forecastDateUnix]);

  return null;
}

function getCategoryMeta(category?: string | null): CategoryMeta {
  if (!category) return DEFAULT_META;
  return CATEGORY_MAP[category.toLowerCase()] ?? DEFAULT_META;
}

/* ── Photo marker factory ── */

function createPhotoMarkerIcon(color: string, emoji: string, step?: string, imageUrl?: string): L.DivIcon {
  const size = 38;
  const badge = step
    ? `<div style="
        position: absolute; top: -4px; right: -4px;
        width: 18px; height: 18px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 9px; font-weight: 700; color: white;
        line-height: 1; z-index: 2;
      ">${step}</div>`
    : '';

  const imgContent = imageUrl
    ? `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
       <div class="triply-photo-marker-emoji" style="display:none;background:${color};font-size:14px;">${emoji}</div>`
    : `<div class="triply-photo-marker-emoji" style="background:${color};font-size:14px;">${emoji}</div>`;

  return L.divIcon({
    className: 'triply-marker',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div class="triply-photo-marker" style="
          width:${size}px;height:${size}px;
          border:3px solid ${color};
        ">${imgContent}</div>
        ${badge}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

function createActivePhotoMarkerIcon(color: string, emoji: string, step?: string, imageUrl?: string): L.DivIcon {
  const size = 48;
  const badge = step
    ? `<div style="
        position: absolute; top: -4px; right: -4px;
        width: 20px; height: 20px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; font-weight: 700; color: white;
        line-height: 1; z-index: 2;
      ">${step}</div>`
    : '';

  const imgContent = imageUrl
    ? `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
       <div class="triply-photo-marker-emoji" style="display:none;background:${color};font-size:18px;">${emoji}</div>`
    : `<div class="triply-photo-marker-emoji" style="background:${color};font-size:18px;">${emoji}</div>`;

  return L.divIcon({
    className: 'triply-marker triply-marker-active',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div class="triply-photo-marker" style="
          width:${size}px;height:${size}px;
          border:3.5px solid ${color};
          box-shadow:0 0 0 3px ${color}33, 0 4px 14px rgba(0,0,0,0.3);
        ">${imgContent}</div>
        ${badge}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

function createSimpleMarkerIcon(color: string, emoji: string): L.DivIcon {
  return L.divIcon({
    className: 'triply-marker',
    html: `
      <div style="
        position:relative;width:32px;height:32px;
      ">
        <div class="triply-photo-marker" style="
          width:32px;height:32px;border:3px solid ${color};
        ">
          <div class="triply-photo-marker-emoji" style="background:${color};font-size:14px;">${emoji}</div>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}

/* ── Map controller: fit bounds or fly to ── */

interface MapActivityEntry {
  activity: Activity;
  day: number;
  dayTitle: string;
}

interface StaticMapPoint {
  id: string;
  lat: number;
  lng: number;
  type: 'airport-origin' | 'airport-destination' | 'stay';
  label: string;
  subtitle?: string;
  mapsUrl?: string;
}

function FitBoundsPoints({
  points,
  zoomOutForWeather = false,
}: {
  points: Array<[number, number]>;
  zoomOutForWeather?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], zoomOutForWeather ? 5 : 13, { animate: true });
    } else {
      const fitOptions: L.FitBoundsOptions = {
        padding: zoomOutForWeather ? [140, 140] : [50, 50],
        animate: true,
      };
      if (zoomOutForWeather) {
        fitOptions.maxZoom = 5;
      }
      map.fitBounds(L.latLngBounds(points), fitOptions);
    }
  }, [points, map, zoomOutForWeather]);

  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([lat, lng], 16, { animate: true, duration: 0.8 });
  }, [lat, lng, map]);

  return null;
}

/* ── Category matching for filter ── */

function matchesCategory(activity: Activity, filter: string): boolean {
  if (filter === 'All') return true;
  const cat = (activity.category || '').toLowerCase();
  const filterLower = filter.toLowerCase();

  const aliases: Record<string, string[]> = {
    food: ['food', 'dining'],
    museums: ['museum', 'museums'],
    nature: ['nature'],
    landmarks: ['landmark', 'landmarks'],
    shopping: ['shopping'],
  };

  const matches = aliases[filterLower] || [filterLower];
  return matches.includes(cat);
}

/* ── Weather legend overlay ── */

function WeatherLegend({ layer }: { layer: WeatherLayerConfig }) {
  return (
    <div className="weather-legend">
      <p className="weather-legend-title">{layer.label} <span>({layer.units})</span></p>
      <div
        className="weather-legend-gradient"
        style={{ background: `linear-gradient(to right, ${layer.colors.join(', ')})` }}
      />
      <div className="weather-legend-labels">
        <span>{layer.legendMin}</span>
        <span>{layer.legendMax}</span>
      </div>
    </div>
  );
}

function WeatherLayerSelector({
  weatherLayer,
  setWeatherLayer,
}: {
  weatherLayer: string | null;
  setWeatherLayer: (layer: string | null) => void;
}) {
  if (!weatherLayer) return null;
  return (
    <div className="weather-layer-bar">
      {WEATHER_LAYERS.map((l) => (
        <button
          key={l.code}
          className={`weather-layer-chip ${weatherLayer === l.code ? 'weather-layer-chip-active' : ''}`}
          onClick={() => setWeatherLayer(l.code)}
        >
          {l.label}
        </button>
      ))}
      <button
        className="weather-layer-chip weather-layer-chip-off"
        onClick={() => setWeatherLayer(null)}
      >
        <X size={11} /> Off
      </button>
    </div>
  );
}

/* ── Main component ── */

function MapSection() {
  const currentTrip = useTripStore((s) => s.currentTrip);
  const selectedDay = useTripStore((s) => s.selectedDay);
  const setSelectedDay = useTripStore((s) => s.setSelectedDay);
  const [activeCategory, setActiveCategory] = useState('All');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [stayPoint, setStayPoint] = useState<StaticMapPoint | null>(null);
  const [activityImageErrorById, setActivityImageErrorById] = useState<Record<string, boolean>>({});
  const [weatherLayer, setWeatherLayer] = useState<string | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const allEntries = useMemo<MapActivityEntry[]>(() => {
    if (!currentTrip) return [];
    return currentTrip.plan.flatMap((day) =>
      day.activities.map((a) => ({ activity: a, day: day.day, dayTitle: day.title }))
    );
  }, [currentTrip]);

  const filteredEntries = useMemo(() => {
    let entries = allEntries;
    if (selectedDay !== null) {
      entries = entries.filter((e) => e.day === selectedDay);
    }
    if (activeCategory !== 'All') {
      entries = entries.filter((e) => matchesCategory(e.activity, activeCategory));
    }
    return entries;
  }, [allEntries, selectedDay, activeCategory]);

  const mappableEntries = useMemo(
    () => filteredEntries.filter((e) => e.activity.lat != null && e.activity.lng != null),
    [filteredEntries]
  );

  const primaryStay = useMemo<Stay | null>(() => {
    if (!currentTrip) return null;
    return (
      currentTrip.stays.find((s) => s.id === currentTrip.selectedStayId) ||
      currentTrip.stays.find((s) => s.saved) ||
      currentTrip.stays[0] ||
      null
    );
  }, [currentTrip]);

  useEffect(() => {
    if (!primaryStay || primaryStay.lat == null || primaryStay.lng == null) {
      setStayPoint(null);
      return;
    }

    const stayLat = Number(primaryStay.lat);
    const stayLng = Number(primaryStay.lng);
    setStayPoint({
      id: `stay-${primaryStay.id}`,
      lat: stayLat,
      lng: stayLng,
      type: 'stay',
      label: primaryStay.name || 'Primary stay',
      subtitle: primaryStay.neighborhood || primaryStay.type || '',
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${stayLat},${stayLng}`,
    });
  }, [
    primaryStay?.id,
    primaryStay?.lat,
    primaryStay?.lng,
    primaryStay?.name,
    primaryStay?.neighborhood,
    primaryStay?.type,
    primaryStay?.bookingUrl,
  ]);

  // Map activity.id → 1-based step number within its day (stable regardless of filters)
  const stepNumbers = useMemo(() => {
    const map = new Map<string, number>();
    if (!currentTrip) return map;
    for (const day of currentTrip.plan) {
      day.activities.forEach((a, i) => {
        map.set(a.id, i + 1);
      });
    }
    return map;
  }, [currentTrip]);

  const focusedEntry = focusedId
    ? mappableEntries.find((e) => e.activity.id === focusedId)
    : null;

  const staticPoints = useMemo(() => {
    const points: StaticMapPoint[] = [];
    if (stayPoint) points.push(stayPoint);
    return points;
  }, [stayPoint]);

  const allMapPoints = useMemo(() => {
    const activityPoints = mappableEntries.map((entry) => ({
      id: entry.activity.id,
      lat: entry.activity.lat as number,
      lng: entry.activity.lng as number,
    }));
    const extra = staticPoints.map((point) => ({ id: point.id, lat: point.lat, lng: point.lng }));
    return [...activityPoints, ...extra];
  }, [mappableEntries, staticPoints]);

  const weatherLayerConfig = useMemo(
    () => (weatherLayer ? WEATHER_LAYERS.find((l) => l.code === weatherLayer) ?? null : null),
    [weatherLayer],
  );

  const weatherWindow = useMemo(() => getWeatherWindowBounds(), []);
  const [weatherForecastUnix, setWeatherForecastUnix] = useState<number>(() => getInitialForecastUnix(undefined));

  useEffect(() => {
    setWeatherForecastUnix(getInitialForecastUnix(currentTrip?.formData?.startDate));
  }, [currentTrip?.id, currentTrip?.formData?.startDate]);

  const hasWeatherApi = Boolean(OWM_API_KEY);
  const handleToggleWeather = () => {
    if (!hasWeatherApi) return;
    setFocusedId(null);
    setWeatherLayer((prev) => (prev ? null : 'TA2'));
  };

  const handleWeatherTimeChange = (nextUnix: number) => {
    setWeatherForecastUnix(
      clampForecastUnix(nextUnix, weatherWindow.startUnix, weatherWindow.endUnix),
    );
  };

  if (!currentTrip) return null;
  const destination = currentTrip.formData.destinations[0] || 'destination';

  const defaultCenter: [number, number] =
    allMapPoints.length > 0
      ? [allMapPoints[0].lat, allMapPoints[0].lng]
      : [48.8566, 2.3522]; // Paris fallback

  const weatherDestinationLat = allMapPoints.length > 0 ? allMapPoints[0].lat : null;
  const weatherDestinationLng = allMapPoints.length > 0 ? allMapPoints[0].lng : null;

  const handleListItemClick = (entry: MapActivityEntry) => {
    if (entry.activity.lat == null || entry.activity.lng == null) return;
    setFocusedId(entry.activity.id);
    const marker = markerRefs.current[entry.activity.id];
    if (marker) marker.openPopup();
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFitAll = () => {
    setFocusedId(null);
  };

  return (
    <div ref={mapContainerRef} className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <h2 className="section-title">Map</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" title="Center on trip" onClick={handleFitAll}>
            <Navigation size={16} />
          </button>
          <button className="icon-btn" title="Expand map" onClick={() => setIsExpanded(true)}>
            <Maximize2 size={16} />
          </button>
          <button
            className="icon-btn"
            title={weatherLayer ? 'Hide weather layer' : 'Show weather layer'}
            onClick={handleToggleWeather}
            style={weatherLayer ? { background: 'var(--primary-50)', color: 'var(--primary-600)' } : undefined}
          >
            <CloudSun size={16} />
          </button>
        </div>
      </div>

      {!isExpanded && (
        <>
          {/* Day Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
            <button
              onClick={() => { setSelectedDay(null); setFocusedId(null); }}
              className={`tab-item tab-sm ${selectedDay === null ? 'tab-active' : ''}`}
            >
              All days
            </button>
            {currentTrip.plan.map((day) => (
              <button
                key={day.day}
                onClick={() => { setSelectedDay(day.day); setFocusedId(null); }}
                className={`tab-item tab-sm ${selectedDay === day.day ? 'tab-active' : ''}`}
              >
                Day {day.day}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          {!weatherLayer && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {FILTER_CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  size="sm"
                  selected={activeCategory === cat}
                  onToggle={() => { setActiveCategory(cat); setFocusedId(null); }}
                />
              ))}
            </div>
          )}

          <WeatherLayerSelector weatherLayer={weatherLayer} setWeatherLayer={setWeatherLayer} />
          {hasWeatherApi && weatherLayer && (
            <WeatherTimeSlider
              valueUnix={weatherForecastUnix}
              startUnix={weatherWindow.startUnix}
              endUnix={weatherWindow.endUnix}
              onChange={handleWeatherTimeChange}
            />
          )}
          {weatherLayer && !OWM_API_KEY && (
            <p className="form-hint" style={{ marginBottom: 12 }}>
              Set <code style={{ fontSize: 12 }}>VITE_OPENWEATHERMAP_API_KEY</code> in{' '}
              <code style={{ fontSize: 12 }}>frontend/.env</code> and restart the dev server. Weather Maps 2.0 must be enabled for your OpenWeather key.
            </p>
          )}

          {/* Leaflet Map */}
          {allMapPoints.length > 0 ? (
            <div className="map-container">
              <MapContainer
                center={defaultCenter}
                zoom={13}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%', borderRadius: 'var(--radius-lg)' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  maxZoom={20}
                />
                {weatherLayer && OWM_API_KEY && (
                  <OwmWeatherTileLayer
                    layerOp={weatherLayer}
                    appId={OWM_API_KEY}
                    forecastDateUnix={weatherForecastUnix}
                  />
                )}
                <WeatherParticlesLayer
                  weatherLayerCode={weatherLayer}
                  enabled={Boolean((weatherLayer === 'PR0' || weatherLayer === 'WS10') && OWM_API_KEY)}
                />

                {(!focusedEntry || weatherLayer) && (
                  <FitBoundsPoints
                    points={allMapPoints.map((p) => [p.lat, p.lng] as [number, number])}
                    zoomOutForWeather={Boolean(weatherLayer)}
                  />
                )}
                {focusedEntry && !weatherLayer && (
                  <FlyTo lat={focusedEntry.activity.lat!} lng={focusedEntry.activity.lng!} />
                )}

                {mappableEntries.map((entry) => {
                  const { activity } = entry;
                  const meta = getCategoryMeta(activity.category);
                  const isActive = hoveredId === activity.id || focusedId === activity.id;
                  const stepNum = String(stepNumbers.get(activity.id) ?? '');
                  const markerImgUrl = activity.cachedImageUrl || buildPlacePhotoProxyUrl(
                    [activity.locationName, activity.name].filter(Boolean).join(', ') || activity.name,
                    120, 120, destination,
                  );
                  const icon = isActive
                    ? createActivePhotoMarkerIcon(meta.color, meta.icon, stepNum, markerImgUrl)
                    : createPhotoMarkerIcon(meta.color, meta.icon, stepNum, markerImgUrl);
                  const mapsLink = activity.links.find((l) => l.type === 'map');

                  return (
                    <Marker
                      key={activity.id}
                      position={[activity.lat!, activity.lng!]}
                      icon={icon}
                      ref={(ref) => {
                        if (ref) markerRefs.current[activity.id] = ref;
                      }}
                      eventHandlers={{
                        click: () => setFocusedId(activity.id),
                      }}
                    >
                      <Popup>
                        <div className="map-popup">
                          <div className="map-popup-image">
                            <img
                              src={activity.cachedImageUrl || buildActivityImage(
                                [activity.locationName, activity.address, activity.name].filter(Boolean).join(', ') || activity.name,
                                destination,
                                activity.category || 'activity',
                                560, 320,
                                `map-popup-${currentTrip.id}-${activity.id}`,
                              )}
                              alt={activity.name}
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback === '1') return;
                                img.dataset.fallback = '1';
                                img.src = buildFallbackImage(`map-popup-${currentTrip.id}-${activity.id}`, 560, 320);
                              }}
                            />
                            {activity.duration && (
                              <div className="map-popup-image-badge" style={{ background: `${meta.color}dd` }}>
                                {activity.duration}
                              </div>
                            )}
                          </div>
                          <div className="map-popup-body">
                            {(activity.locationName || activity.address) && (
                              <p className="map-popup-location">
                                <MapPin size={11} style={{ flexShrink: 0 }} />
                                {activity.locationName || activity.address}
                              </p>
                            )}
                            <strong>{activity.name}</strong>
                            <p className="map-popup-meta">
                              Day {entry.day} · {activity.timeOfDay || 'Anytime'}
                            </p>
                            {mapsLink && (
                              <a href={mapsLink.url} target="_blank" rel="noopener noreferrer" className="map-popup-cta map-popup-cta-maps">
                                <MapIcon size={12} />
                                View on Google Maps
                              </a>
                            )}
                            {activity.links.filter((l) => l.type !== 'map').length > 0 && (
                              <div className="map-popup-links">
                                {activity.links.filter((l) => l.type !== 'map').map((link, i) => (
                                  <a key={`other-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className="map-popup-link">
                                    <ExternalLink size={11} />
                                    {link.label === 'Link' ? 'Website' : link.label}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {staticPoints.map((point) => {
                  const pointStyle =
                    point.type === 'airport-origin'
                      ? { color: '#0ea5e9', icon: '🛫' }
                      : point.type === 'airport-destination'
                        ? { color: '#f97316', icon: '🛬' }
                        : { color: '#22c55e', icon: '🏨' };
                  return (
                    <Marker
                      key={point.id}
                      position={[point.lat, point.lng]}
                      icon={createSimpleMarkerIcon(pointStyle.color, pointStyle.icon)}
                    >
                      <Popup>
                        <div className="map-popup">
                          <div className="map-popup-image">
                            <img
                              src={buildActivityImage(
                                [point.label, point.subtitle].filter(Boolean).join(', ') || point.label,
                                destination,
                                point.type === 'stay' ? 'stay' : 'transport',
                                560, 320,
                                `map-static-${currentTrip.id}-${point.id}`,
                              )}
                              alt={point.label}
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback === '1') return;
                                img.dataset.fallback = '1';
                                img.src = buildFallbackImage(`map-static-${currentTrip.id}-${point.id}`, 560, 320);
                              }}
                            />
                          </div>
                          <div className="map-popup-body">
                            {point.subtitle && (
                              <p className="map-popup-location">
                                <MapPin size={11} style={{ flexShrink: 0 }} />
                                {point.subtitle}
                              </p>
                            )}
                            <strong>{point.label}</strong>
                            {point.mapsUrl && (
                              <a href={point.mapsUrl} target="_blank" rel="noopener noreferrer" className="map-popup-cta map-popup-cta-maps">
                                <MapIcon size={12} />
                                View on Google Maps
                              </a>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
              {weatherLayer && weatherLayerConfig ? (
                <WeatherLegend layer={weatherLayerConfig} />
              ) : null}
            </div>
          ) : (
            <div className="map-empty-state">
              <MapPin size={32} style={{ color: 'var(--primary-400)', marginBottom: 8 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-700)' }}>
                No locations to display
              </p>
              <p style={{ fontSize: 13, color: 'var(--navy-400)', marginTop: 4, marginBottom: 16 }}>
                {filteredEntries.length > 0
                  ? 'Coordinates for these activities are not available yet'
                  : 'Try selecting a different day or category'}
              </p>
            </div>
          )}

          {/* Activity List */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredEntries.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--navy-400)', padding: '8px 0', textAlign: 'center' }}>
                No activities match the current filters
              </p>
            )}
            {filteredEntries.map((entry) => {
              const { activity } = entry;
              const meta = getCategoryMeta(activity.category);
              const hasCoords = activity.lat != null && activity.lng != null;
              const isActive = focusedId === activity.id;

              return (
                <div
                  key={activity.id}
                  className={`map-list-item ${isActive ? 'map-list-item-active' : ''}`}
                  onClick={() => handleListItemClick(entry)}
                  onMouseEnter={() => setHoveredId(activity.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ cursor: hasCoords ? 'pointer' : 'default' }}
                >
                  <div
                    className="map-list-item-image"
                    style={{
                      border: `1.5px solid ${isActive ? `${meta.color}44` : 'var(--navy-100)'}`,
                      background: 'var(--navy-50)',
                    }}
                  >
                    {activityImageErrorById[activity.id] ? (
                      <div
                        className="map-list-item-image-fallback"
                        style={{
                          background: `${meta.color}12`,
                          color: meta.color,
                        }}
                      >
                        {meta.icon}
                      </div>
                    ) : (
                      <img
                        src={activity.cachedImageUrl || buildActivityImage(
                          [activity.locationName, activity.address, activity.name].filter(Boolean).join(', ') || activity.name,
                          destination,
                          activity.category || 'activity',
                          320,
                          240,
                          `map-list-${currentTrip.id}-${activity.id}`,
                        )}
                        alt={activity.name}
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.dataset.fallback === '1') {
                            setActivityImageErrorById((prev) => ({ ...prev, [activity.id]: true }));
                            return;
                          }
                          img.dataset.fallback = '1';
                          img.src = buildFallbackImage(`map-list-${currentTrip.id}-${activity.id}`, 320, 240);
                        }}
                      />
                    )}
                  </div>
                  <div className="map-list-item-content">
                    <p className="map-list-item-title">{activity.name}</p>
                    <p className="map-list-item-subtitle">
                      <span className="map-list-item-cat-dot" style={{ background: meta.color }} />
                      Day {entry.day} · {activity.timeOfDay || 'Anytime'}
                      {activity.locationName ? ` · ${activity.locationName}` : ''}
                    </p>
                  </div>
                  {hasCoords ? (
                    <MapPin size={14} style={{ color: meta.color, flexShrink: 0 }} />
                  ) : (
                    <MapPin size={14} style={{ color: 'var(--navy-200)', flexShrink: 0 }} />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Expanded Map Modal */}
      <Modal isOpen={isExpanded} onClose={() => setIsExpanded(false)} title="Map" size="xl">
        <div className="map-expanded">
          <div className="map-expanded-map">
            <div className="map-expanded-toolbar">
              <div className="map-expanded-toolbar-label">
                <span>Trip map</span>
                <p>{selectedDay === null ? 'All days' : `Day ${selectedDay}`}</p>
              </div>
              <button
                className={`map-expanded-weather-toggle ${weatherLayer ? 'map-expanded-weather-toggle-active' : ''}`}
                onClick={handleToggleWeather}
                disabled={!hasWeatherApi}
                title={!hasWeatherApi ? 'Set VITE_OPENWEATHERMAP_API_KEY to enable weather tiles' : undefined}
              >
                <CloudSun size={14} />
                {!hasWeatherApi ? 'Weather unavailable' : weatherLayer ? 'Weather on' : 'Weather off'}
              </button>
            </div>
            {isExpanded && allMapPoints.length > 0 && (
              <MapContainer
                center={defaultCenter}
                zoom={13}
                scrollWheelZoom={true}
                zoomControl={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  maxZoom={20}
                />
                {weatherLayer && OWM_API_KEY && (
                  <OwmWeatherTileLayer
                    layerOp={weatherLayer}
                    appId={OWM_API_KEY}
                    forecastDateUnix={weatherForecastUnix}
                  />
                )}
                <WeatherParticlesLayer
                  weatherLayerCode={weatherLayer}
                  enabled={Boolean((weatherLayer === 'PR0' || weatherLayer === 'WS10') && OWM_API_KEY)}
                />

                {(!focusedEntry || weatherLayer) && (
                  <FitBoundsPoints
                    points={allMapPoints.map((p) => [p.lat, p.lng] as [number, number])}
                    zoomOutForWeather={Boolean(weatherLayer)}
                  />
                )}
                {focusedEntry && !weatherLayer && (
                  <FlyTo lat={focusedEntry.activity.lat!} lng={focusedEntry.activity.lng!} />
                )}

                {mappableEntries.map((entry) => {
                  const { activity } = entry;
                  const meta = getCategoryMeta(activity.category);
                  const isActive = hoveredId === activity.id || focusedId === activity.id;
                  const stepNum = String(stepNumbers.get(activity.id) ?? '');
                  const markerImgUrl = activity.cachedImageUrl || buildPlacePhotoProxyUrl(
                    [activity.locationName, activity.name].filter(Boolean).join(', ') || activity.name,
                    120, 120, destination,
                  );
                  const icon = isActive
                    ? createActivePhotoMarkerIcon(meta.color, meta.icon, stepNum, markerImgUrl)
                    : createPhotoMarkerIcon(meta.color, meta.icon, stepNum, markerImgUrl);
                  const mapsLink = activity.links.find((l) => l.type === 'map');

                  return (
                    <Marker
                      key={activity.id}
                      position={[activity.lat!, activity.lng!]}
                      icon={icon}
                      eventHandlers={{
                        click: () => setFocusedId(activity.id),
                      }}
                    >
                      <Popup>
                        <div className="map-popup">
                          <div className="map-popup-image">
                            <img
                              src={activity.cachedImageUrl || buildActivityImage(
                                [activity.locationName, activity.address, activity.name].filter(Boolean).join(', ') || activity.name,
                                destination,
                                activity.category || 'activity',
                                560, 320,
                                `map-popup-${currentTrip.id}-${activity.id}`,
                              )}
                              alt={activity.name}
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback === '1') return;
                                img.dataset.fallback = '1';
                                img.src = buildFallbackImage(`map-popup-${currentTrip.id}-${activity.id}`, 560, 320);
                              }}
                            />
                            {activity.duration && (
                              <div className="map-popup-image-badge" style={{ background: `${meta.color}dd` }}>
                                {activity.duration}
                              </div>
                            )}
                          </div>
                          <div className="map-popup-body">
                            {(activity.locationName || activity.address) && (
                              <p className="map-popup-location">
                                <MapPin size={11} style={{ flexShrink: 0 }} />
                                {activity.locationName || activity.address}
                              </p>
                            )}
                            <strong>{activity.name}</strong>
                            <p className="map-popup-meta">
                              Day {entry.day} · {activity.timeOfDay || 'Anytime'}
                            </p>
                            {mapsLink && (
                              <a href={mapsLink.url} target="_blank" rel="noopener noreferrer" className="map-popup-cta map-popup-cta-maps">
                                <MapIcon size={12} />
                                View on Google Maps
                              </a>
                            )}
                            {activity.links.filter((l) => l.type !== 'map').length > 0 && (
                              <div className="map-popup-links">
                                {activity.links.filter((l) => l.type !== 'map').map((link, i) => (
                                  <a key={`other-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className="map-popup-link">
                                    <ExternalLink size={11} />
                                    {link.label === 'Link' ? 'Website' : link.label}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {staticPoints.map((point) => {
                  const pointStyle =
                    point.type === 'airport-origin'
                      ? { color: '#0ea5e9', icon: '🛫' }
                      : point.type === 'airport-destination'
                        ? { color: '#f97316', icon: '🛬' }
                        : { color: '#22c55e', icon: '🏨' };
                  return (
                    <Marker
                      key={point.id}
                      position={[point.lat, point.lng]}
                      icon={createSimpleMarkerIcon(pointStyle.color, pointStyle.icon)}
                    >
                      <Popup>
                        <div className="map-popup">
                          <div className="map-popup-image">
                            <img
                              src={buildActivityImage(
                                [point.label, point.subtitle].filter(Boolean).join(', ') || point.label,
                                destination,
                                point.type === 'stay' ? 'stay' : 'transport',
                                560, 320,
                                `map-static-${currentTrip.id}-${point.id}`,
                              )}
                              alt={point.label}
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback === '1') return;
                                img.dataset.fallback = '1';
                                img.src = buildFallbackImage(`map-static-${currentTrip.id}-${point.id}`, 560, 320);
                              }}
                            />
                          </div>
                          <div className="map-popup-body">
                            {point.subtitle && (
                              <p className="map-popup-location">
                                <MapPin size={11} style={{ flexShrink: 0 }} />
                                {point.subtitle}
                              </p>
                            )}
                            <strong>{point.label}</strong>
                            {point.mapsUrl && (
                              <a href={point.mapsUrl} target="_blank" rel="noopener noreferrer" className="map-popup-cta map-popup-cta-maps">
                                <MapIcon size={12} />
                                View on Google Maps
                              </a>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            )}
            {weatherLayer && weatherLayerConfig ? (
              <WeatherLegend layer={weatherLayerConfig} />
            ) : null}
          </div>

          <div className="map-expanded-sidebar">
            {weatherLayer ? (
              <>
                <p className="map-expanded-sidebar-header">Weather</p>
                {hasWeatherApi ? (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {WEATHER_LAYERS.map((l) => (
                        <button
                          key={l.code}
                          className={`weather-layer-chip ${weatherLayer === l.code ? 'weather-layer-chip-active' : ''}`}
                          onClick={() => setWeatherLayer(l.code)}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                    <WeatherTimeSlider
                      valueUnix={weatherForecastUnix}
                      startUnix={weatherWindow.startUnix}
                      endUnix={weatherWindow.endUnix}
                      onChange={handleWeatherTimeChange}
                    />
                    <WeatherDestinationPanel
                      destinationLabel={destination}
                      lat={weatherDestinationLat}
                      lng={weatherDestinationLng}
                      forecastUnix={weatherForecastUnix}
                      apiKey={OWM_API_KEY}
                    />
                  </>
                ) : (
                  <p className="form-hint">
                    Set <code style={{ fontSize: 12 }}>VITE_OPENWEATHERMAP_API_KEY</code> in{' '}
                    <code style={{ fontSize: 12 }}>frontend/.env</code> and restart the dev server.
                  </p>
                )}
              </>
            ) : (
              <>
                {/* Filters */}
                <p className="map-expanded-sidebar-header">Filter</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setSelectedDay(null); setFocusedId(null); }}
                    className={`tab-item tab-sm ${selectedDay === null ? 'tab-active' : ''}`}
                  >
                    All days
                  </button>
                  {currentTrip.plan.map((day) => (
                    <button
                      key={day.day}
                      onClick={() => { setSelectedDay(day.day); setFocusedId(null); }}
                      className={`tab-item tab-sm ${selectedDay === day.day ? 'tab-active' : ''}`}
                    >
                      Day {day.day}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {FILTER_CATEGORIES.map((cat) => (
                    <Chip
                      key={cat}
                      label={cat}
                      size="sm"
                      selected={activeCategory === cat}
                      onToggle={() => { setActiveCategory(cat); setFocusedId(null); }}
                    />
                  ))}
                </div>

                <p className="map-expanded-sidebar-header" style={{ marginTop: 4 }}>
                  {filteredEntries.length} {filteredEntries.length === 1 ? 'Activity' : 'Activities'}
                </p>

                {/* Activity list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
                  {filteredEntries.map((entry) => {
                    const { activity } = entry;
                    const meta = getCategoryMeta(activity.category);
                    const hasCoords = activity.lat != null && activity.lng != null;
                    const isActive = focusedId === activity.id;

                    return (
                      <div
                        key={activity.id}
                        className={`map-list-item ${isActive ? 'map-list-item-active' : ''}`}
                        onClick={() => {
                          if (!hasCoords) return;
                          setFocusedId(activity.id);
                        }}
                        onMouseEnter={() => setHoveredId(activity.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        style={{ cursor: hasCoords ? 'pointer' : 'default' }}
                      >
                        <div
                          className="map-list-item-image"
                          style={{
                            border: `1.5px solid ${isActive ? `${meta.color}44` : 'var(--navy-100)'}`,
                            background: 'var(--navy-50)',
                          }}
                        >
                          {activityImageErrorById[activity.id] ? (
                            <div
                              className="map-list-item-image-fallback"
                              style={{
                                background: `${meta.color}12`,
                                color: meta.color,
                              }}
                            >
                              {meta.icon}
                            </div>
                          ) : (
                            <img
                              src={buildActivityImage(
                                [activity.locationName, activity.address, activity.name].filter(Boolean).join(', ') || activity.name,
                                destination,
                                activity.category || 'activity',
                                320,
                                240,
                                `map-list-${currentTrip.id}-${activity.id}`,
                              )}
                              alt={activity.name}
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback === '1') {
                                  setActivityImageErrorById((prev) => ({ ...prev, [activity.id]: true }));
                                  return;
                                }
                                img.dataset.fallback = '1';
                                img.src = buildFallbackImage(`map-list-${currentTrip.id}-${activity.id}`, 320, 240);
                              }}
                            />
                          )}
                        </div>
                        <div className="map-list-item-content">
                          <p className="map-list-item-title">{activity.name}</p>
                          <p className="map-list-item-subtitle">
                            <span className="map-list-item-cat-dot" style={{ background: meta.color }} />
                            Day {entry.day} · {activity.timeOfDay || 'Anytime'}
                            {activity.locationName ? ` · ${activity.locationName}` : ''}
                          </p>
                        </div>
                        {hasCoords ? (
                          <MapPin size={14} style={{ color: meta.color, flexShrink: 0 }} />
                        ) : (
                          <MapPin size={14} style={{ color: 'var(--navy-200)', flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default memo(MapSection);
