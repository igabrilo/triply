import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2, MapPin, ExternalLink, Map as MapIcon, Loader, CloudSun } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { geocodeAPI, tripAPI } from '@/services/api';
import Modal from '@components/ui/Modal';
import Chip from '@components/ui/Chip';
import WeatherParticlesLayer from '@components/dashboard/WeatherParticlesLayer';
import WeatherTimeSlider from '@components/dashboard/WeatherTimeSlider';
import WeatherDestinationPanel from '@components/dashboard/WeatherDestinationPanel';
import {
  clampForecastUnix,
  getInitialForecastUnix,
  getWeatherWindowBounds,
} from '@components/dashboard/weatherForecastUtils';
import type { Activity } from '@/types';
import { buildActivityImage, buildFallbackImage, buildPlacePhotoProxyUrl } from '@/utils/mediaImages';

import 'leaflet/dist/leaflet.css';

/* ── Category config (shared with MapSection) ── */

interface CategoryMeta { color: string; icon: string; }

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
  fillBound?: boolean;
}

const WEATHER_LAYERS: WeatherLayerConfig[] = [
  {
    code: 'TA2', label: 'Temperature', units: '°C', opacity: 0.5,
    colors: ['#4A2C7A', '#375ECC', '#4C96E2', '#7DD9FF', '#C7ED6D', '#F6DF45', '#F49533', '#DD4B2B'],
    legendMin: '-30°', legendMax: '40°',
    fillBound: true,
  },
  {
    code: 'PR0', label: 'Precipitation', units: 'mm/s', opacity: 0.66,
    colors: ['#D7F7FF', '#9EE8FF', '#66D9C6', '#39C46C', '#9CCF43', '#F2D34A', '#F39A35', '#E95A29', '#B82121'],
    legendMin: 'Light', legendMax: 'Heavy',
  },
  {
    code: 'CL', label: 'Clouds', units: '%', opacity: 0.46,
    colors: ['#F8FCFF', '#DCE7F2', '#BAC8D7', '#93A1B2', '#667689'],
    legendMin: '0%', legendMax: '100%',
  },
  {
    code: 'WS10', label: 'Wind', units: 'm/s', opacity: 0.58,
    colors: ['#F1F7FF', '#D7E9FF', '#B3D5FF', '#84B5FF', '#5C92E8', '#3D6CBF'],
    legendMin: '0', legendMax: '30 m/s',
  },
  {
    code: 'HRD0', label: 'Humidity', units: '%', opacity: 0.6,
    colors: ['#B6412C', '#D07A2D', '#E8B740', '#A0CF52', '#4AB485', '#338CC2'],
    legendMin: '0%', legendMax: '100%',
  },
  {
    code: 'SD0', label: 'Snow', units: 'm', opacity: 0.58,
    colors: ['#F1F7FF', '#C7E7F7', '#8ED2F1', '#5BAAF0', '#5578D8', '#7A5FC6'],
    legendMin: '0', legendMax: '4m',
  },
];

const OWM_RAW_KEY = (import.meta.env.VITE_OPENWEATHERMAP_API_KEY as string | undefined)?.trim();
const OWM_API_KEY =
  OWM_RAW_KEY && OWM_RAW_KEY !== 'your_key_here' && OWM_RAW_KEY.length > 0 ? OWM_RAW_KEY : undefined;

function owmWeather2TileUrl(
  op: string,
  appId: string,
  tileOpacity: number,
  fillBound?: boolean,
  forecastDateUnix?: number,
): string {
  const q = new URLSearchParams();
  q.set('appid', appId);
  q.set('opacity', String(Math.min(1, Math.max(0, tileOpacity))));
  if (fillBound) q.set('fill_bound', 'true');
  if (typeof forecastDateUnix === 'number') q.set('date', String(forecastDateUnix));
  return `https://maps.openweathermap.org/maps/2.0/weather/${op}/{z}/{x}/{y}?${q.toString()}`;
}

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

    const url = owmWeather2TileUrl(layerOp, appId, opacity, fillBound, forecastDateUnix);
    layer.setUrl(url);
  }, [layerOp, appId, opacity, fillBound, forecastDateUnix]);

  return null;
}

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

function getCategoryMeta(category?: string | null): CategoryMeta {
  if (!category) return DEFAULT_META;
  return CATEGORY_MAP[category.toLowerCase()] ?? DEFAULT_META;
}

function createPhotoMarkerIcon(color: string, emoji: string, step?: string, imageUrl?: string): L.DivIcon {
  const size = 34;
  const badge = step
    ? `<div style="
        position: absolute; top: -4px; right: -4px;
        width: 16px; height: 16px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 8px; font-weight: 700; color: white;
        line-height: 1; z-index: 2;
      ">${step}</div>`
    : '';

  const imgContent = imageUrl
    ? `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
       <div class="triply-photo-marker-emoji" style="display:none;background:${color};font-size:12px;">${emoji}</div>`
    : `<div class="triply-photo-marker-emoji" style="background:${color};font-size:12px;">${emoji}</div>`;

  return L.divIcon({
    className: 'triply-marker',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div class="triply-photo-marker" style="
          width:${size}px;height:${size}px;
          border:2.5px solid ${color};
        ">${imgContent}</div>
        ${badge}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

interface MapActivityEntry {
  activity: Activity;
  day: number;
  dayTitle: string;
}

interface FallbackStayPoint {
  lat: number;
  lng: number;
  locationName: string;
  mapsUrl: string;
}

function FitBounds({
  entries,
  zoomOutForWeather = false,
}: {
  entries: MapActivityEntry[];
  zoomOutForWeather?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    const points = entries
      .filter((e) => e.activity.lat != null && e.activity.lng != null)
      .map((e) => [e.activity.lat!, e.activity.lng!] as [number, number]);

    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], zoomOutForWeather ? 5 : 13, { animate: true });
    } else {
      const fitOptions: L.FitBoundsOptions = {
        padding: zoomOutForWeather ? [120, 120] : [20, 20],
        animate: true,
      };
      if (zoomOutForWeather) {
        fitOptions.maxZoom = 5;
      }
      map.fitBounds(L.latLngBounds(points), fitOptions);
    }
  }, [entries, map, zoomOutForWeather]);

  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16, { animate: true, duration: 0.8 });
  }, [lat, lng, map]);
  return null;
}

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

function createActivePhotoMarkerIcon(color: string, emoji: string, step?: string, imageUrl?: string): L.DivIcon {
  const size = 46;
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
       <div class="triply-photo-marker-emoji" style="display:none;background:${color};font-size:16px;">${emoji}</div>`
    : `<div class="triply-photo-marker-emoji" style="background:${color};font-size:16px;">${emoji}</div>`;

  return L.divIcon({
    className: 'triply-marker triply-marker-active',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div class="triply-photo-marker" style="
          width:${size}px;height:${size}px;
          border:3px solid ${color};
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

/* ── Main component ── */

export default function SidebarMap() {
  const { currentTrip, selectedDay, setSelectedDay, loadTrip } = useTripStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isAutoGeocoding, setIsAutoGeocoding] = useState(false);
  const [imageErrorByActivityId, setImageErrorByActivityId] = useState<Record<string, boolean>>({});
  const [fallbackStayPoint, setFallbackStayPoint] = useState<FallbackStayPoint | null>(null);
  const [weatherLayer, setWeatherLayer] = useState<string | null>(null);
  const autoGeocodeAttemptedRef = useRef<Record<string, boolean>>({});

  const allEntries = useMemo<MapActivityEntry[]>(() => {
    if (!currentTrip) return [];
    return currentTrip.plan.flatMap((day) =>
      day.activities.map((a) => ({ activity: a, day: day.day, dayTitle: day.title }))
    );
  }, [currentTrip]);

  const hasPlanActivities = allEntries.length > 0;

  useEffect(() => {
    let cancelled = false;

    const autoGeocode = async () => {
      if (!currentTrip) return;
      if (!hasPlanActivities) return;

      const hasMissingCoords = allEntries.some(
        (entry) => entry.activity.lat == null || entry.activity.lng == null
      );
      if (!hasMissingCoords) return;

      const tripKey = String(currentTrip.id);
      if (autoGeocodeAttemptedRef.current[tripKey]) return;
      autoGeocodeAttemptedRef.current[tripKey] = true;

      setIsAutoGeocoding(true);
      try {
        await tripAPI.geocodeTrip(currentTrip.id);
        if (!cancelled) {
          await loadTrip(currentTrip.id);
        }
      } catch {
        // Keep map usable even if background geocoding fails.
      } finally {
        if (!cancelled) {
          setIsAutoGeocoding(false);
        }
      }
    };

    autoGeocode();
    return () => {
      cancelled = true;
    };
  }, [currentTrip, allEntries, hasPlanActivities, loadTrip]);

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

  const primaryStay = useMemo(() => {
    if (!currentTrip) return null;
    return (
      currentTrip.stays.find((s) => s.id === currentTrip.selectedStayId) ||
      currentTrip.stays.find((s) => s.saved) ||
      currentTrip.stays[0] ||
      null
    );
  }, [currentTrip]);

  useEffect(() => {
    let cancelled = false;

    const resolveStayPoint = async () => {
      if (!currentTrip || !primaryStay) {
        if (!cancelled) setFallbackStayPoint(null);
        return;
      }

      if (primaryStay.lat != null && primaryStay.lng != null) {
        if (!cancelled) {
          const stayLat = Number(primaryStay.lat);
          const stayLng = Number(primaryStay.lng);
          setFallbackStayPoint({
            lat: stayLat,
            lng: stayLng,
            locationName: primaryStay.neighborhood || primaryStay.type || 'Primary stay',
            mapsUrl: primaryStay.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${stayLat},${stayLng}`,
          });
        }
        return;
      }

      const destinationHint = currentTrip.formData.destinations[0] || '';
      const query = [primaryStay.name, primaryStay.neighborhood, destinationHint].filter(Boolean).join(', ');
      if (!query.trim()) {
        if (!cancelled) setFallbackStayPoint(null);
        return;
      }

      try {
        const res = await geocodeAPI.searchPlace(query);
        const geo = res?.result;
        if (!cancelled && geo?.lat != null && geo?.lng != null) {
          const lat = Number(geo.lat);
          const lng = Number(geo.lng);
          setFallbackStayPoint({
            lat,
            lng,
            locationName: geo.location_name || geo.address || primaryStay.neighborhood || primaryStay.type || 'Primary stay',
            mapsUrl: primaryStay.mapsUrl || geo.maps_url || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          });
        }
      } catch {
        if (!cancelled) setFallbackStayPoint(null);
      }
    };

    resolveStayPoint();
    return () => {
      cancelled = true;
    };
  }, [
    currentTrip,
    primaryStay?.id,
    primaryStay?.name,
    primaryStay?.neighborhood,
    primaryStay?.type,
    primaryStay?.lat,
    primaryStay?.lng,
    primaryStay?.mapsUrl,
  ]);

  const fallbackEntry = useMemo<MapActivityEntry | null>(() => {
    if (!currentTrip || !primaryStay || !fallbackStayPoint) return null;
    return {
      day: selectedDay ?? currentTrip.plan[0]?.day ?? 1,
      dayTitle: 'Primary stay',
      activity: {
        id: `stay-${primaryStay.id}`,
        name: primaryStay.name || 'Primary stay',
        description: primaryStay.whyItFits || 'Your base location for this trip.',
        timeOfDay: 'Base location',
        duration: '',
        links: fallbackStayPoint.mapsUrl
          ? [{ label: 'Map', url: fallbackStayPoint.mapsUrl, type: 'map' }]
          : [],
        status: 'planned',
        tags: ['stay'],
        category: 'stay',
        lat: fallbackStayPoint.lat,
        lng: fallbackStayPoint.lng,
        locationName: fallbackStayPoint.locationName,
        address: '',
      },
    };
  }, [currentTrip, primaryStay, fallbackStayPoint, selectedDay]);

  const displayEntries = useMemo<MapActivityEntry[]>(() => {
    if (filteredEntries.length > 0) return filteredEntries;
    return fallbackEntry ? [fallbackEntry] : [];
  }, [filteredEntries, fallbackEntry]);

  const mappableEntries = useMemo(
    () => displayEntries.filter((e) => e.activity.lat != null && e.activity.lng != null),
    [displayEntries]
  );

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

  const weatherLayerConfig = useMemo(
    () => (weatherLayer ? WEATHER_LAYERS.find((l) => l.code === weatherLayer) ?? null : null),
    [weatherLayer],
  );

  const weatherWindow = useMemo(() => getWeatherWindowBounds(), []);
  const [weatherForecastUnix, setWeatherForecastUnix] = useState<number>(() => getInitialForecastUnix(undefined));

  useEffect(() => {
    setWeatherForecastUnix(getInitialForecastUnix(currentTrip?.formData?.startDate));
  }, [currentTrip?.id, currentTrip?.formData?.startDate]);

  const handleWeatherTimeChange = (nextUnix: number) => {
    setWeatherForecastUnix(
      clampForecastUnix(nextUnix, weatherWindow.startUnix, weatherWindow.endUnix),
    );
  };

  const hasWeatherApi = Boolean(OWM_API_KEY);
  const handleToggleWeather = () => {
    if (!hasWeatherApi) return;
    setFocusedId(null);
    setWeatherLayer((prev) => (prev ? null : 'TA2'));
  };

  const focusedEntry = focusedId
    ? mappableEntries.find((e) => e.activity.id === focusedId)
    : null;

  if (!currentTrip) return null;
  if (mappableEntries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="card"
        style={{ padding: 16 }}
      >
        <div className="section-header" style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-800)' }}>Map</h3>
        </div>
        <div className="map-empty-state" style={{ minHeight: 132 }}>
          {isAutoGeocoding ? (
            <Loader size={28} style={{ color: 'var(--primary-500)', marginBottom: 8, animation: 'spin 1s linear infinite' }} />
          ) : (
            <MapPin size={28} style={{ color: 'var(--primary-400)', marginBottom: 8 }} />
          )}
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-700)', margin: 0 }}>
            {isAutoGeocoding ? 'Preparing map locations' : 'Map locations unavailable'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--navy-500)', margin: '6px 0 0', textAlign: 'center' }}>
            {hasPlanActivities
              ? 'Syncing activity coordinates so all planned activities appear on map.'
              : 'Add activities to your plan and map will appear here.'}
          </p>
        </div>
      </motion.div>
    );
  }
  const destination = currentTrip.formData.destinations[0] || 'destination';

  const defaultCenter: [number, number] = [
    mappableEntries[0].activity.lat!,
    mappableEntries[0].activity.lng!,
  ];

  const weatherDestinationLat = mappableEntries.length > 0 ? mappableEntries[0].activity.lat! : null;
  const weatherDestinationLng = mappableEntries.length > 0 ? mappableEntries[0].activity.lng! : null;

  return (
    <>
      {!isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card"
          style={{ padding: 16 }}
        >
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-800)' }}>Map</h3>
            <button
              className="icon-btn"
              title="Expand map"
              onClick={() => setIsExpanded(true)}
            >
              <Maximize2 size={14} />
            </button>
          </div>

          <div
            style={{ height: 180, borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', isolation: 'isolate' }}
            onClick={() => setIsExpanded(true)}
          >
            <MapContainer
              center={defaultCenter}
              zoom={13}
              scrollWheelZoom={false}
              dragging={false}
              zoomControl={false}
              attributionControl={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                maxZoom={20}
              />
              <FitBounds entries={mappableEntries} />
              {mappableEntries.map((entry) => {
                const meta = getCategoryMeta(entry.activity.category);
                const stepNum = String(stepNumbers.get(entry.activity.id) ?? '');
                const markerImgUrl = buildPlacePhotoProxyUrl(
                  [entry.activity.locationName, entry.activity.name].filter(Boolean).join(', ') || entry.activity.name,
                  120, 120, destination,
                );
                return (
                  <Marker
                    key={entry.activity.id}
                    position={[entry.activity.lat!, entry.activity.lng!]}
                    icon={createPhotoMarkerIcon(meta.color, meta.icon, stepNum, markerImgUrl)}
                    interactive={false}
                  />
                );
              })}
            </MapContainer>
          </div>

          <p style={{ fontSize: 11, color: 'var(--navy-400)', marginTop: 6, textAlign: 'center' }}>
            {mappableEntries.length} location{mappableEntries.length !== 1 ? 's' : ''} · Click to expand
          </p>
        </motion.div>
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
            {isExpanded && mappableEntries.length > 0 && (
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
                  <FitBounds entries={mappableEntries} zoomOutForWeather={Boolean(weatherLayer)} />
                )}
                {focusedEntry && !weatherLayer && (
                  <FlyTo lat={focusedEntry.activity.lat!} lng={focusedEntry.activity.lng!} />
                )}

                {mappableEntries.map((entry) => {
                  const { activity } = entry;
                  const meta = getCategoryMeta(activity.category);
                  const isActive = hoveredId === activity.id || focusedId === activity.id;
                  const stepNum = String(stepNumbers.get(activity.id) ?? '');
                  const markerImgUrl = buildPlacePhotoProxyUrl(
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
                              src={buildActivityImage(
                                [activity.locationName, activity.address, activity.name].filter(Boolean).join(', ') || activity.name,
                                destination,
                                activity.category || 'activity',
                                560, 320,
                                `sidebar-map-popup-${currentTrip.id}-${activity.id}`,
                              )}
                              alt={activity.name}
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback === '1') return;
                                img.dataset.fallback = '1';
                                img.src = buildFallbackImage(`sidebar-map-popup-${currentTrip.id}-${activity.id}`, 560, 320);
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
                  {displayEntries.length} {displayEntries.length === 1 ? 'Activity' : 'Activities'}
                </p>

                {/* Activity list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
                  {displayEntries.map((entry) => {
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
                          {imageErrorByActivityId[activity.id] ? (
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
                                `sidebar-map-${currentTrip.id}-${activity.id}`,
                              )}
                              alt={activity.name}
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback === '1') {
                                  setImageErrorByActivityId((prev) => ({ ...prev, [activity.id]: true }));
                                  return;
                                }
                                img.dataset.fallback = '1';
                                img.src = buildFallbackImage(`sidebar-map-${currentTrip.id}-${activity.id}`, 320, 240);
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
    </>
  );
}
