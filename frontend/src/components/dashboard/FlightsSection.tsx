import { motion } from 'framer-motion';
import { Plane, Star, ExternalLink, MessageSquare, ArrowRight } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useChatStore } from '@/store/chatStore';

export default function FlightsSection() {
  const { currentTrip, toggleFlightSaved, updatedSections } = useTripStore();
  const { openChat } = useChatStore();

  if (!currentTrip) return null;

  const wasUpdated = updatedSections['flights'] && Date.now() - updatedSections['flights'] < 30000;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="section-title">Flights</h2>
          {wasUpdated && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="badge badge-primary">Updated just now</motion.span>
          )}
        </div>
        <button onClick={() => openChat({ section: 'flights' })} className="edit-chat-btn">
          <MessageSquare size={14} /> Edit in chat
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {currentTrip.flights.map((flight, idx) => (
          <motion.div
            key={flight.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="item-card"
            style={{ padding: '16px 20px' }}
          >
            {/* Header: Airline + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div 
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, var(--primary-50), var(--primary-100))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Plane size={18} style={{ color: 'var(--primary-600)' }} />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy-900)', lineHeight: 1.3 }}>
                    {flight.airline || 'Flight'}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--navy-500)', marginTop: 2 }}>
                    {flight.stops === 0 ? 'Direct flight' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => toggleFlightSaved(flight.id)}
                  className={`icon-btn ${flight.saved ? 'icon-btn-star-active' : 'icon-btn-star'}`}
                  title="Save flight"
                >
                  <Star size={14} fill={flight.saved ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>

            {/* Route Details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {/* Departure */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: 'var(--navy-500)', marginBottom: 4 }}>From</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>{flight.departure}</p>
                {flight.departureTime && (
                  <p style={{ fontSize: 13, color: 'var(--navy-600)', marginTop: 2 }}>{flight.departureTime}</p>
                )}
              </div>

              {/* Arrow + Duration */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px', flexShrink: 0 }}>
                <ArrowRight size={18} style={{ color: 'var(--navy-400)' }} />
                {flight.duration && (
                  <p style={{ fontSize: 11, color: 'var(--navy-400)', marginTop: 4, whiteSpace: 'nowrap' }}>
                    {flight.duration}
                  </p>
                )}
              </div>

              {/* Arrival */}
              <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                <p style={{ fontSize: 12, color: 'var(--navy-500)', marginBottom: 4 }}>To</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>{flight.arrival}</p>
                {flight.arrivalTime && (
                  <p style={{ fontSize: 13, color: 'var(--navy-600)', marginTop: 2 }}>{flight.arrivalTime}</p>
                )}
              </div>
            </div>

            {/* Footer: Price + View Button */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTop: '1px solid var(--navy-50)',
              }}
            >
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary-600)' }}>
                  {flight.priceRange}
                </p>
                <p style={{ fontSize: 12, color: 'var(--navy-500)' }}>per person</p>
              </div>
              <a 
                href={flight.bookingUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                View <ExternalLink size={12} />
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
