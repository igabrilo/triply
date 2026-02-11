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
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                <div className="flight-icon-box"><Plane size={18} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flight-route">
                    {flight.departure} <ArrowRight size={14} style={{ color: 'var(--navy-400)' }} /> {flight.arrival}
                  </div>
                  <p className="flight-airline">{flight.airline}</p>
                </div>
                <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p className="flight-time">{flight.departureTime}</p>
                    <p className="flight-code">{flight.departure}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p className="flight-code">{flight.duration}</p>
                    <div className="flight-duration-line" />
                    <p className="flight-code">{flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p className="flight-time">{flight.arrivalTime}</p>
                    <p className="flight-code">{flight.arrival}</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <p className="flight-price">{flight.priceRange}</p>
                  <p className="flight-price-sub">per person</p>
                </div>
                <button
                  onClick={() => toggleFlightSaved(flight.id)}
                  className={`icon-btn ${flight.saved ? 'icon-btn-star-active' : 'icon-btn-star'}`}
                >
                  <Star size={16} fill={flight.saved ? 'currentColor' : 'none'} />
                </button>
                <a href={flight.bookingUrl} target="_blank" rel="noopener noreferrer" className="view-btn">
                  View <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
