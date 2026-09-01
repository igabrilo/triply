import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpDown, Check, ExternalLink, MapPin, MessageSquare, PlaneTakeoff, Star } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useChatStore } from '@/store/chatStore';
import type { Flight } from '@/types';
import { buildAirlineLogoUrl, buildMapsSearchUrl } from '@/utils/mediaImages';

type SortKey = 'default' | 'departure' | 'price' | 'fastest';

function buildFlightsContext(flights: Flight[]): string {
  return 'Flights:\n' + flights.map(f =>
    `  - ${f.airline}: ${f.departure} → ${f.arrival}, ${f.departureTime}–${f.arrivalTime}, ${f.duration}, ${f.stops === 0 ? 'Direct' : f.stops + ' stop(s)'}, ${f.priceRange}`
  ).join('\n');
}

function buildFlightContext(flight: Flight): string {
  return `Flight: ${flight.airline}\nRoute: ${flight.departure} → ${flight.arrival}` +
    `\nDeparture: ${flight.departureTime}\nArrival: ${flight.arrivalTime}` +
    `\nDuration: ${flight.duration}` +
    `\nStops: ${flight.stops === 0 ? 'Direct' : flight.stops + ' stop(s)'}` +
    `\nPrice: ${flight.priceRange}`;
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Recommended' },
  { key: 'departure', label: 'Departure' },
  { key: 'price', label: 'Price' },
  { key: 'fastest', label: 'Fastest' },
];

function numericPrice(range: string): number {
  const m = (range || '').match(/(\d[\d,]*)/);
  return m ? parseInt(m[1].replace(',', ''), 10) : Infinity;
}

function lowestPrice(priceRange: string): string {
  const s = (priceRange || '').trim();
  if (!s) return '-';
  const parts = s.split(/\s*[-\u2013\u2014−]\s*/);
  const lowest = (parts.length > 1 ? parts[0].trim() : s).replace(/^~\s*/, '');
  return `from ${lowest}`;
}

function parseDuration(value: string): number {
  const v = (value || '').replace(/^~\s*/, '');
  const h = v.match(/(\d+)\s*h/);
  const m = v.match(/(\d+)\s*m/);
  return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
}

function parseClock(value: string): number {
  const m = (value || '').match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
}

function sortFlights(flights: Flight[], key: SortKey): Flight[] {
  if (key === 'default') return flights;
  return [...flights].sort((a, b) => {
    if (key === 'departure') return parseClock(a.departureTime) - parseClock(b.departureTime);
    if (key === 'price') return numericPrice(a.priceRange) - numericPrice(b.priceRange);
    if (key === 'fastest') return parseDuration(a.duration) - parseDuration(b.duration);
    return 0;
  });
}

export default function FlightsSection() {
  const currentTrip = useTripStore((s) => s.currentTrip);
  const updatedSections = useTripStore((s) => s.updatedSections);
  const toggleFlightSaved = useTripStore((s) => s.toggleFlightSaved);
  const selectPrimaryFlight = useTripStore((s) => s.selectPrimaryFlight);
  const focusFlightId = useTripStore((s) => s.focusFlightId);
  const setFocusFlightId = useTripStore((s) => s.setFocusFlightId);
  const { openChat } = useChatStore();
  const [sortBy, setSortBy] = useState<SortKey>('default');
  const [logoErrorByFlightId, setLogoErrorByFlightId] = useState<Record<string, boolean>>({});

  if (!currentTrip) return null;

  const wasUpdated = updatedSections['flights'] && Date.now() - updatedSections['flights'] < 30000;
  const sorted = useMemo(() => sortFlights(currentTrip.flights, sortBy), [currentTrip.flights, sortBy]);

  useEffect(() => {
    if (!focusFlightId) return;
    const target = document.querySelector(`[data-flight-id="${focusFlightId}"]`) as HTMLElement | null;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeoutId = window.setTimeout(() => setFocusFlightId(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [focusFlightId, sorted, setFocusFlightId]);

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="section-title">Flights</h2>
          {wasUpdated && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="badge badge-primary">
              Updated just now
            </motion.span>
          )}
        </div>
        <button onClick={() => openChat({ section: 'flights', contextSummary: buildFlightsContext(currentTrip.flights) })} className="edit-chat-btn">
          <MessageSquare size={14} /> Edit in chat
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
        <ArrowUpDown size={13} style={{ color: 'var(--navy-400)', flexShrink: 0 }} />
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            style={{
              fontSize: 12,
              fontWeight: sortBy === opt.key ? 600 : 500,
              color: sortBy === opt.key ? 'var(--primary-700)' : 'var(--navy-500)',
              background: sortBy === opt.key ? 'var(--primary-50)' : 'transparent',
              border: sortBy === opt.key ? '1px solid var(--primary-200)' : '1px solid var(--navy-100)',
              padding: '5px 14px',
              borderRadius: 20,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Flight cards */}
      <div style={{ display: 'grid', gap: 10 }}>
        {sorted.length === 0 && (
          <div className="item-card" style={{ textAlign: 'center', padding: '22px 18px' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>No flight options yet</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--navy-500)' }}>
              Ask AI to generate flight suggestions for this trip.
            </p>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => openChat({ section: 'flights' })}>
                Generate Flights
              </button>
            </div>
          </div>
        )}
        {sorted.map((flight, idx) => {
          const departureAirportMaps = buildMapsSearchUrl(`${flight.departure || ''} airport`.trim());
          const arrivalAirportMaps = buildMapsSearchUrl(`${flight.arrival || ''} airport`.trim());

          return (
            <motion.div
              key={flight.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="item-card"
              data-flight-id={flight.id}
              style={{
                border: focusFlightId === flight.id ? '2px solid var(--primary-300)' : undefined,
                boxShadow: focusFlightId === flight.id ? '0 0 0 3px var(--primary-100)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: '1px solid var(--navy-100)',
                      background: 'var(--surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {logoErrorByFlightId[flight.id] ? (
                      <PlaneTakeoff size={18} style={{ color: 'var(--navy-400)' }} />
                    ) : (
                      <img
                        src={buildAirlineLogoUrl(flight.airline || '')}
                        alt={`${flight.airline || 'Airline'} logo`}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }}
                        onError={() => setLogoErrorByFlightId((prev) => ({ ...prev, [flight.id]: true }))}
                      />
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>{flight.airline || 'Flight'}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>
                      {flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {flight.isSelected && (
                    <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Check size={10} /> Primary
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button
                    onClick={() => toggleFlightSaved(flight.id)}
                    className={`icon-btn ${flight.saved ? 'icon-btn-star-active' : 'icon-btn-star'}`}
                    title="Save flight"
                  >
                    <Star size={14} fill={flight.saved ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => openChat({ section: 'flights', itemId: flight.id, contextSummary: buildFlightContext(flight) })}
                    className="icon-btn icon-btn-chat"
                    title="Edit in chat"
                  >
                    <MessageSquare size={13} />
                  </button>
                </div>
              </div>

              <div className="flight-schedule">
                <div className="flight-side">
                  <div className="flight-time">{flight.departureTime || '-'}</div>
                  <div className="flight-location">{flight.departure || '-'}</div>
                </div>

                <div className="flight-center">
                  <div className="flight-line" />
                  <div className="flight-plane">
                    <PlaneTakeoff size={14} />
                  </div>
                  <div className="flight-duration">{(flight.duration || '-').replace(/^\s*[-–—]\s*/, '')}</div>
                </div>

                <div className="flight-side">
                  <div className="flight-time">{flight.arrivalTime || '-'}</div>
                  <div className="flight-location">{flight.arrival || '-'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <a
                  href={departureAirportMaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <MapPin size={12} /> Departure map <ExternalLink size={12} />
                </a>
                <a
                  href={arrivalAirportMaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <MapPin size={12} /> Arrival map <ExternalLink size={12} />
                </a>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>{lowestPrice(flight.priceRange)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className={`btn btn-sm ${flight.isSelected ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => selectPrimaryFlight(flight.id)}
                  >
                    {flight.isSelected ? 'Selected' : 'Select primary'}
                  </button>
                  <a
                    href={flight.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    Book <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
