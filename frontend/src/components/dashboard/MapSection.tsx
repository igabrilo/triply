import { useState, useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Maximize2, ExternalLink, LocateFixed, Loader, Map as MapIcon } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { geocodeAPI, tripAPI } from '@/services/api';
import Chip from '@components/ui/Chip';
import Modal from '@components/ui/Modal';
import type { Activity, Stay } from '@/types';
import { buildActivityImage, buildFallbackImage } from '@/utils/mediaImages';

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

function getCategoryMeta(category?: string | null): CategoryMeta {
  if (!category) return DEFAULT_META;
  return CATEGORY_MAP[category.toLowerCase()] ?? DEFAULT_META;
}

/* ── Colored SVG marker factory ── */

function createMarkerIcon(color: string, emoji: string, step?: string): L.DivIcon {
  const badge = step
    ? `<div style="
        position: absolute; top: -4px; right: -6px;
        width: 16px; height: 16px;
        background: white;
        border: 1.5px solid ${color};
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 9px; font-weight: 700; color: ${color};
        line-height: 1;
      ">${step}</div>`
    : '';

  return L.divIcon({
    className: 'triply-marker',
    html: `
      <div style="
        position: relative;
        width: 32px; height: 32px;
        background: ${color};
        border: 2.5px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      ">${emoji}${badge}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function createActiveMarkerIcon(color: string, emoji: string, step?: string): L.DivIcon {
  const badge = step
    ? `<div style="
        position: absolute; top: -4px; right: -6px;
        width: 18px; height: 18px;
        background: white;
        border: 2px solid ${color};
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; font-weight: 700; color: ${color};
        line-height: 1;
      ">${step}</div>`
    : '';

  return L.divIcon({
    className: 'triply-marker triply-marker-active',
    html: `
      <div style="
        position: relative;
        width: 40px; height: 40px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 0 0 4px ${color}44, 0 4px 12px rgba(0,0,0,0.35);
        cursor: pointer;
        transition: all 0.2s ease;
      ">${emoji}${badge}</div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
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

function FitBoundsPoints({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13, { animate: true });
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], animate: true });
    }
  }, [points, map]);

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

/* ── Main component ── */

export default function MapSection() {
  const { currentTrip, selectedDay, setSelectedDay, loadTrip } = useTripStore();
  const [activeCategory, setActiveCategory] = useState('All');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [airportPoints, setAirportPoints] = useState<StaticMapPoint[]>([]);
  const [stayPoint, setStayPoint] = useState<StaticMapPoint | null>(null);
  const [activityImageErrorById, setActivityImageErrorById] = useState<Record<string, boolean>>({});
  const markerRefs = useRef<Record<string, L.Marker>>({});
  const airportCacheRef = useRef<Record<string, Omit<StaticMapPoint, 'id'>>>({});
  const stayCacheRef = useRef<Record<string, Omit<StaticMapPoint, 'id'>>>({});
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const autoGeocodeAttemptedRef = useRef<Record<string, boolean>>({});

  const handleFindLocations = async () => {
    if (!currentTrip) return;
    setIsGeocoding(true);
    try {
      await tripAPI.geocodeTrip(currentTrip.id);
      await loadTrip(currentTrip.id);
    } catch (err) {
      console.error('Geocoding failed:', err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const allEntries = useMemo<MapActivityEntry[]>(() => {
    if (!currentTrip) return [];
    return currentTrip.plan.flatMap((day) =>
      day.activities.map((a) => ({ activity: a, day: day.day, dayTitle: day.title }))
    );
  }, [currentTrip]);

  useEffect(() => {
    let cancelled = false;

    const autoGeocode = async () => {
      if (!currentTrip) return;
      if (allEntries.length === 0) return;

      const hasMissingCoords = allEntries.some(
        (entry) => entry.activity.lat == null || entry.activity.lng == null
      );
      if (!hasMissingCoords) return;

      const tripKey = String(currentTrip.id);
      if (autoGeocodeAttemptedRef.current[tripKey]) return;
      autoGeocodeAttemptedRef.current[tripKey] = true;

      setIsGeocoding(true);
      try {
        await tripAPI.geocodeTrip(currentTrip.id);
        if (!cancelled) {
          await loadTrip(currentTrip.id);
        }
      } catch {
        // Keep manual geocode button available as fallback.
      } finally {
        if (!cancelled) {
          setIsGeocoding(false);
        }
      }
    };

    autoGeocode();
    return () => {
      cancelled = true;
    };
  }, [currentTrip, allEntries, loadTrip]);

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

  const primaryFlight = useMemo(() => {
    if (!currentTrip) return null;
    return (
      currentTrip.flights.find((f) => f.id === currentTrip.selectedFlightId) ||
      currentTrip.flights.find((f) => f.saved) ||
      currentTrip.flights[0] ||
      null
    );
  }, [currentTrip]);

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
    let cancelled = false;

    const resolveAirports = async () => {
      if (!primaryFlight) {
        setAirportPoints([]);
        return;
      }

      const requests = [
        {
          key: `${primaryFlight.departure || ''} airport`,
          type: 'airport-origin' as const,
          label: `Departure airport: ${primaryFlight.departure || 'Origin'}`,
        },
        {
          key: `${primaryFlight.arrival || ''} airport`,
          type: 'airport-destination' as const,
          label: `Arrival airport: ${primaryFlight.arrival || 'Destination'}`,
        },
      ].filter((r) => r.key.trim().length > 0);

      const resolved: StaticMapPoint[] = [];

      for (const request of requests) {
        const cacheKey = request.key.toLowerCase();
        let point = airportCacheRef.current[cacheKey];
        if (!point) {
          try {
            const res = await geocodeAPI.searchPlace(request.key);
            const geo = res?.result;
            if (geo?.lat != null && geo?.lng != null) {
              point = {
                lat: Number(geo.lat),
                lng: Number(geo.lng),
                type: request.type,
                label: request.label,
                subtitle: geo.location_name || geo.address || request.key,
                mapsUrl: geo.maps_url || `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`,
              };
              airportCacheRef.current[cacheKey] = point;
            }
          } catch {
            // Keep map functional even if one geocode call fails.
          }
        }
        if (point) {
          resolved.push({ ...point, id: `${request.type}-${cacheKey}` });
        }
      }

      if (!cancelled) {
        setAirportPoints(resolved);
      }
    };

    resolveAirports();
    return () => {
      cancelled = true;
    };
  }, [primaryFlight?.id, primaryFlight?.departure, primaryFlight?.arrival]);

  useEffect(() => {
    let cancelled = false;

    const resolveStay = async () => {
      if (!primaryStay) {
        setStayPoint(null);
        return;
      }

      if (primaryStay.lat != null && primaryStay.lng != null) {
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
        return;
      }

      const destinationHint = currentTrip?.formData?.destinations?.[0] || '';
      const query = [primaryStay.name, primaryStay.neighborhood, destinationHint]
        .filter(Boolean)
        .join(', ');
      if (!query.trim()) {
        setStayPoint(null);
        return;
      }

      const cacheKey = query.toLowerCase();
      let point = stayCacheRef.current[cacheKey];
      if (!point) {
        try {
          const res = await geocodeAPI.searchPlace(query);
          const geo = res?.result;
          if (geo?.lat != null && geo?.lng != null) {
            point = {
              lat: Number(geo.lat),
              lng: Number(geo.lng),
              type: 'stay',
              label: primaryStay.name || 'Primary stay',
              subtitle: geo.location_name || geo.address || primaryStay.neighborhood || primaryStay.type || '',
              mapsUrl: geo.maps_url || `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`,
            };
            stayCacheRef.current[cacheKey] = point;
          }
        } catch {
          // Keep map functional if stay geocoding fails.
        }
      }

      if (!cancelled) {
        setStayPoint(point ? { ...point, id: `stay-${primaryStay.id}` } : null);
      }
    };

    resolveStay();
    return () => {
      cancelled = true;
    };
  }, [
    primaryStay?.id,
    primaryStay?.lat,
    primaryStay?.lng,
    primaryStay?.name,
    primaryStay?.neighborhood,
    primaryStay?.type,
    primaryStay?.bookingUrl,
    currentTrip?.formData?.destinations,
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
    const points = [...airportPoints];
    if (stayPoint) points.push(stayPoint);
    return points;
  }, [airportPoints, stayPoint]);

  const allMapPoints = useMemo(() => {
    const activityPoints = mappableEntries.map((entry) => ({
      id: entry.activity.id,
      lat: entry.activity.lat as number,
      lng: entry.activity.lng as number,
    }));
    const extra = staticPoints.map((point) => ({ id: point.id, lat: point.lat, lng: point.lng }));
    return [...activityPoints, ...extra];
  }, [mappableEntries, staticPoints]);

  if (!currentTrip) return null;
  const destination = currentTrip.formData.destinations[0] || 'destination';

  const defaultCenter: [number, number] =
    allMapPoints.length > 0
      ? [allMapPoints[0].lat, allMapPoints[0].lng]
      : [48.8566, 2.3522]; // Paris fallback

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

                {!focusedEntry && <FitBoundsPoints points={allMapPoints.map((p) => [p.lat, p.lng] as [number, number])} />}
                {focusedEntry && (
                  <FlyTo lat={focusedEntry.activity.lat!} lng={focusedEntry.activity.lng!} />
                )}

                {mappableEntries.map((entry) => {
                  const { activity } = entry;
                  const meta = getCategoryMeta(activity.category);
                  const isActive = hoveredId === activity.id || focusedId === activity.id;
                  const stepNum = String(stepNumbers.get(activity.id) ?? '');
                  const icon = isActive
                    ? createActiveMarkerIcon(meta.color, meta.icon, stepNum)
                    : createMarkerIcon(meta.color, meta.icon, stepNum);

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
                          <img
                            src={buildActivityImage(
                              [activity.locationName, activity.address, activity.name].filter(Boolean).join(', ') || activity.name,
                              destination,
                              activity.category || 'activity',
                              480,
                              260,
                              `map-popup-${currentTrip.id}-${activity.id}`,
                            )}
                            alt={activity.name}
                            loading="lazy"
                            style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' }}
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.dataset.fallback === '1') return;
                              img.dataset.fallback = '1';
                              img.src = buildFallbackImage(`map-popup-${currentTrip.id}-${activity.id}`, 480, 260);
                            }}
                          />
                          <strong>{activity.name}</strong>
                          {activity.locationName && (
                            <p className="map-popup-location">{activity.locationName}</p>
                          )}
                          {activity.address && (
                            <p className="map-popup-address">{activity.address}</p>
                          )}
                          <p className="map-popup-meta">
                            Day {entry.day} · {activity.timeOfDay || 'Anytime'}
                            {activity.duration ? ` · ${activity.duration}` : ''}
                          </p>
                          {activity.description && (
                            <p className="map-popup-desc">
                              {activity.description.length > 70
                                ? `${activity.description.slice(0, 70).trim()}…`
                                : activity.description}
                            </p>
                          )}
                          {activity.links.length > 0 && (
                            <div className="map-popup-links">
                              {activity.links.filter((l) => l.type === 'map').map((link, i) => (
                                <a key={`map-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className="map-popup-link map-popup-link-map">
                                  <MapIcon size={11} />
                                  Google Maps
                                </a>
                              ))}
                              {activity.links.filter((l) => l.type !== 'map').map((link, i) => (
                                <a key={`other-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className="map-popup-link">
                                  <ExternalLink size={11} />
                                  {link.label === 'Link' ? 'Website' : link.label}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {staticPoints.map((point) => {
                  const style =
                    point.type === 'airport-origin'
                      ? { color: '#0ea5e9', icon: '🛫' }
                      : point.type === 'airport-destination'
                      ? { color: '#f97316', icon: '🛬' }
                      : { color: '#22c55e', icon: '🏨' };
                  return (
                    <Marker
                      key={point.id}
                      position={[point.lat, point.lng]}
                      icon={createMarkerIcon(style.color, style.icon)}
                    >
                      <Popup>
                        <div className="map-popup">
                          <img
                            src={buildActivityImage(
                              [point.label, point.subtitle].filter(Boolean).join(', ') || point.label,
                              destination,
                              point.type === 'stay' ? 'stay' : 'transport',
                              420,
                              240,
                              `map-static-${currentTrip.id}-${point.id}`,
                            )}
                            alt={point.label}
                            loading="lazy"
                            style={{ width: '100%', height: 88, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' }}
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.dataset.fallback === '1') return;
                              img.dataset.fallback = '1';
                              img.src = buildFallbackImage(`map-static-${currentTrip.id}-${point.id}`, 420, 240);
                            }}
                          />
                          <strong>{point.label}</strong>
                          {point.subtitle && <p className="map-popup-location">{point.subtitle}</p>}
                          {point.mapsUrl && (
                            <div className="map-popup-links">
                              <a href={point.mapsUrl} target="_blank" rel="noopener noreferrer" className="map-popup-link map-popup-link-map">
                                <MapIcon size={11} />
                                Open in Maps
                              </a>
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          ) : (
            <div className="map-empty-state">
              <MapPin size={32} style={{ color: 'var(--primary-400)', marginBottom: 8 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-700)' }}>
                No locations to display
              </p>
              <p style={{ fontSize: 13, color: 'var(--navy-400)', marginTop: 4, marginBottom: 16 }}>
                {filteredEntries.length > 0
                  ? 'Coordinates for these activities haven\'t been geocoded yet'
                  : 'Try selecting a different day or category'}
              </p>
              {filteredEntries.length > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleFindLocations}
                  disabled={isGeocoding}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {isGeocoding
                    ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finding locations…</>
                    : <><LocateFixed size={14} /> Find locations</>
                  }
                </button>
              )}
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
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: `1px solid ${isActive ? `${meta.color}66` : 'var(--navy-100)'}`,
                      background: 'var(--navy-50)',
                      flexShrink: 0,
                    }}
                  >
                    {activityImageErrorById[activity.id] ? (
                      <div
                        className="map-day-badge"
                        style={{
                          width: '100%',
                          height: '100%',
                          background: `${meta.color}18`,
                          color: meta.color,
                          fontSize: 14,
                          borderRadius: 0,
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
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--navy-800)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {activity.name}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>
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
            {isExpanded && allMapPoints.length > 0 && (
              <MapContainer
                center={defaultCenter}
                zoom={13}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  maxZoom={20}
                />

                {!focusedEntry && <FitBoundsPoints points={allMapPoints.map((p) => [p.lat, p.lng] as [number, number])} />}
                {focusedEntry && (
                  <FlyTo lat={focusedEntry.activity.lat!} lng={focusedEntry.activity.lng!} />
                )}

                {mappableEntries.map((entry) => {
                  const { activity } = entry;
                  const meta = getCategoryMeta(activity.category);
                  const isActive = hoveredId === activity.id || focusedId === activity.id;
                  const stepNum = String(stepNumbers.get(activity.id) ?? '');
                  const icon = isActive
                    ? createActiveMarkerIcon(meta.color, meta.icon, stepNum)
                    : createMarkerIcon(meta.color, meta.icon, stepNum);

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
                          <img
                            src={buildActivityImage(
                              [activity.locationName, activity.address, activity.name].filter(Boolean).join(', ') || activity.name,
                              destination,
                              activity.category || 'activity',
                              480,
                              260,
                              `map-popup-${currentTrip.id}-${activity.id}`,
                            )}
                            alt={activity.name}
                            loading="lazy"
                            style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' }}
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.dataset.fallback === '1') return;
                              img.dataset.fallback = '1';
                              img.src = buildFallbackImage(`map-popup-${currentTrip.id}-${activity.id}`, 480, 260);
                            }}
                          />
                          <strong>{activity.name}</strong>
                          {activity.locationName && (
                            <p className="map-popup-location">{activity.locationName}</p>
                          )}
                          {activity.address && (
                            <p className="map-popup-address">{activity.address}</p>
                          )}
                          <p className="map-popup-meta">
                            Day {entry.day} · {activity.timeOfDay || 'Anytime'}
                            {activity.duration ? ` · ${activity.duration}` : ''}
                          </p>
                          {activity.description && (
                            <p className="map-popup-desc">
                              {activity.description.length > 70
                                ? `${activity.description.slice(0, 70).trim()}…`
                                : activity.description}
                            </p>
                          )}
                          {activity.links.length > 0 && (
                            <div className="map-popup-links">
                              {activity.links.filter((l) => l.type === 'map').map((link, i) => (
                                <a key={`map-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className="map-popup-link map-popup-link-map">
                                  <MapIcon size={11} />
                                  Google Maps
                                </a>
                              ))}
                              {activity.links.filter((l) => l.type !== 'map').map((link, i) => (
                                <a key={`other-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className="map-popup-link">
                                  <ExternalLink size={11} />
                                  {link.label === 'Link' ? 'Website' : link.label}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {staticPoints.map((point) => {
                  const style =
                    point.type === 'airport-origin'
                      ? { color: '#0ea5e9', icon: '🛫' }
                      : point.type === 'airport-destination'
                      ? { color: '#f97316', icon: '🛬' }
                      : { color: '#22c55e', icon: '🏨' };
                  return (
                    <Marker
                      key={point.id}
                      position={[point.lat, point.lng]}
                      icon={createMarkerIcon(style.color, style.icon)}
                    >
                      <Popup>
                        <div className="map-popup">
                          <img
                            src={buildActivityImage(
                              [point.label, point.subtitle].filter(Boolean).join(', ') || point.label,
                              destination,
                              point.type === 'stay' ? 'stay' : 'transport',
                              420,
                              240,
                              `map-static-${currentTrip.id}-${point.id}`,
                            )}
                            alt={point.label}
                            loading="lazy"
                            style={{ width: '100%', height: 88, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' }}
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.dataset.fallback === '1') return;
                              img.dataset.fallback = '1';
                              img.src = buildFallbackImage(`map-static-${currentTrip.id}-${point.id}`, 420, 240);
                            }}
                          />
                          <strong>{point.label}</strong>
                          {point.subtitle && <p className="map-popup-location">{point.subtitle}</p>}
                          {point.mapsUrl && (
                            <div className="map-popup-links">
                              <a href={point.mapsUrl} target="_blank" rel="noopener noreferrer" className="map-popup-link map-popup-link-map">
                                <MapIcon size={11} />
                                Open in Maps
                              </a>
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            )}
          </div>

          <div className="map-expanded-sidebar">
            {/* Filters */}
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
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        overflow: 'hidden',
                        border: `1px solid ${isActive ? `${meta.color}66` : 'var(--navy-100)'}`,
                        background: 'var(--navy-50)',
                        flexShrink: 0,
                      }}
                    >
                      {activityImageErrorById[activity.id] ? (
                        <div
                          className="map-day-badge"
                          style={{
                            width: '100%',
                            height: '100%',
                            background: `${meta.color}18`,
                            color: meta.color,
                            fontSize: 14,
                            borderRadius: 0,
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
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--navy-800)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {activity.name}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>
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
          </div>
        </div>
      </Modal>
    </div>
  );
}
