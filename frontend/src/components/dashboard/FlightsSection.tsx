import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PlaneTakeoff, Star, ExternalLink, MessageSquare, ArrowUpDown } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useChatStore } from '@/store/chatStore';
import type { Flight } from '@/types';

/* ─── Helpers ─── */

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

/** "$120 - $250" → "from $120" */
function formatFromPrice(range: string): string {
  const m = range.match(/([\$€£])\s*(\d[\d,]*)/);
  if (m) return `from ${m[1]}${m[2]}`;
  const n = range.match(/(\d[\d,]*)/);
  if (n) return `from $${n[1]}`;
  return range;
}

/** Extract numeric price for sorting */
function numericPrice(range: string): number {
  const m = range.match(/(\d[\d,]*)/);
  return m ? parseInt(m[1].replace(',', ''), 10) : Infinity;
}

/** Parse "2h 30m" or "~3h 15m" → total minutes for sorting */
function parseDuration(d: string): number {
  const clean = d.replace(/^~\s*/, '');
  const h = clean.match(/(\d+)\s*h/);
  const m = clean.match(/(\d+)\s*m/);
  return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
}

/** Parse time "15:55" or "3:30 PM" → minutes since midnight */
function parseTime(t: string): number {
  const clock = extractClock(t);
  const h24 = clock.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10);
  return 0;
}

/** Normalize any time hint to "HH:MM" — handles 24h, 12h AM/PM, and vague labels */
function extractClock(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();
  // Already 24h  e.g. "15:55" or "9:00"
  const m24 = s.match(/^~?\s*(\d{1,2}):(\d{2})$/);
  if (m24) return `${m24[1].padStart(2, '0')}:${m24[2]}`;
  // 12h with AM/PM  e.g. "3:30 PM"
  const m12 = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    if (m12[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m12[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m12[2]}`;
  }
  // Vague labels from AI
  const lower = s.toLowerCase();
  if (lower.includes('early morning')) return '06:00';
  if (lower.includes('morning')) return '09:00';
  if (lower.includes('noon') || lower.includes('midday')) return '12:00';
  if (lower.includes('afternoon')) return '14:00';
  if (lower.includes('evening')) return '19:00';
  if (lower.includes('night')) return '22:00';
  // Last resort — return the raw string (shouldn't happen)
  return s;
}

type SortKey = 'default' | 'departure' | 'price' | 'fastest';

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Recommended' },
  { key: 'departure', label: 'Departure' },
  { key: 'price', label: 'Price' },
  { key: 'fastest', label: 'Fastest' },
];

function sortFlights(flights: Flight[], key: SortKey): Flight[] {
  if (key === 'default') return flights;
  return [...flights].sort((a, b) => {
    if (key === 'departure') return parseTime(a.departureTime) - parseTime(b.departureTime);
    if (key === 'price') return numericPrice(a.priceRange) - numericPrice(b.priceRange);
    if (key === 'fastest') return parseDuration(a.duration) - parseDuration(b.duration);
    return 0;
  });
}

/* ─── Component ─── */

export default function FlightsSection() {
  const { currentTrip, toggleFlightSaved, updatedSections } = useTripStore();
  const { openChat } = useChatStore();
  const [sortBy, setSortBy] = useState<SortKey>('default');

  if (!currentTrip) return null;

  const wasUpdated = updatedSections['flights'] && Date.now() - updatedSections['flights'] < 30000;
  const sorted = useMemo(() => sortFlights(currentTrip.flights, sortBy), [currentTrip.flights, sortBy]);

  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Header */}
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="section-title">Flights</h2>
          {wasUpdated && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="badge badge-primary">Updated just now</motion.span>
          )}
        </div>
        <button onClick={() => openChat({ section: 'flights', contextSummary: buildFlightsContext(currentTrip.flights) })} className="edit-chat-btn">
          <MessageSquare size={14} /> Edit in chat
        </button>
      </div>

      {/* Sort bar */}
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
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Flight cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map((flight, idx) => (
          <motion.div
            key={flight.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            style={{
              padding: '18px 22px',
              border: '1px solid var(--navy-100)',
              borderRadius: 14,
              background: 'var(--surface)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          >
            {/* Top row: Airline · Stops · Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-800)' }}>{flight.airline || 'Flight'}</span>
                <span style={{ fontSize: 11, color: 'var(--navy-400)' }}>·</span>
                <span style={{ fontSize: 12, color: 'var(--navy-500)' }}>
                  {flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button
                  onClick={() => toggleFlightSaved(flight.id)}
                  className={`icon-btn ${flight.saved ? 'icon-btn-star-active' : 'icon-btn-star'}`}
                  title="Save flight"
                  style={{ width: 28, height: 28 }}
                >
                  <Star size={13} fill={flight.saved ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => openChat({ section: 'flights', itemId: flight.id, contextSummary: buildFlightContext(flight) })}
                  className="icon-btn icon-btn-chat"
                  title="Edit in chat"
                  style={{ width: 28, height: 28 }}
                >
                  <MessageSquare size={13} />
                </button>
              </div>
            </div>

            {/* ── Ryanair-style route row ── */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {/* Departure */}
              <div style={{ width: 72, flexShrink: 0 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy-950)', lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                  {extractClock(flight.departureTime) || '—'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--navy-500)', marginTop: 4, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {flight.departure}
                </p>
              </div>

              {/* ── Route line: dot ─ ─ ─ ✈ ─ ─ ─ dot ── */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 10px', minWidth: 90 }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', height: 16 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', border: '1.5px solid var(--navy-300)', background: 'var(--surface)', flexShrink: 0 }} />
                  <div style={{ flex: 1, height: 0, borderTop: '1.5px dashed var(--navy-200)' }} />
                  <PlaneTakeoff size={13} style={{ color: 'var(--navy-400)', flexShrink: 0, margin: '0 4px' }} />
                  <div style={{ flex: 1, height: 0, borderTop: '1.5px dashed var(--navy-200)' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', border: '1.5px solid var(--navy-300)', background: 'var(--surface)', flexShrink: 0 }} />
                </div>
                {flight.duration && (
                  <p style={{ fontSize: 10, color: 'var(--navy-400)', marginTop: 3, whiteSpace: 'nowrap' }}>
                    {flight.duration.replace(/^~\s*/, '')}
                  </p>
                )}
              </div>

              {/* Arrival */}
              <div style={{ width: 72, flexShrink: 0, textAlign: 'right' }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy-950)', lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                  {extractClock(flight.arrivalTime) || '—'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--navy-500)', marginTop: 4, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {flight.arrival}
                </p>
              </div>
            </div>

            {/* ── Footer: price + book ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--navy-50)',
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-900)', margin: 0 }}>
                {formatFromPrice(flight.priceRange)}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--navy-400)', marginLeft: 6 }}>/ person</span>
              </p>
              <a
                href={flight.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                Book <ExternalLink size={12} />
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
