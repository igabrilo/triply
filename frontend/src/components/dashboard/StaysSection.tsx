import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, ExternalLink, MessageSquare, MapPin, SlidersHorizontal } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useChatStore } from '@/store/chatStore';
import Chip from '@components/ui/Chip';
import type { Stay } from '@/types';

function buildStaysContext(stays: Stay[]): string {
  return 'Stays:\n' + stays.map(s =>
    `  - ${s.name} (${s.type}, ${s.neighborhood}), ${s.priceRange}, ${s.rating} stars, ${s.reviewCount} reviews`
  ).join('\n');
}

function buildStayContext(stay: Stay): string {
  return `Stay: ${stay.name}\nType: ${stay.type}\nNeighborhood: ${stay.neighborhood}` +
    `\nPrice: ${stay.priceRange}\nRating: ${stay.rating} (${stay.reviewCount} reviews)` +
    (stay.whyItFits ? `\nWhy it fits: ${stay.whyItFits}` : '') +
    (stay.amenities.length ? `\nAmenities: ${stay.amenities.join(', ')}` : '');
}

const filterOptions = ['All', 'Budget', 'Mid-range', 'Family-friendly'];

export default function StaysSection() {
  const { currentTrip, toggleStaySaved, updatedSections } = useTripStore();
  const { openChat } = useChatStore();
  const [activeFilter, setActiveFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  if (!currentTrip) return null;

  const wasUpdated = updatedSections['stays'] && Date.now() - updatedSections['stays'] < 30000;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="section-title">Stays</h2>
          {wasUpdated && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="badge badge-primary">Updated just now</motion.span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowFilters(!showFilters)} className="icon-btn"><SlidersHorizontal size={16} /></button>
          <button onClick={() => openChat({ section: 'stays', contextSummary: buildStaysContext(currentTrip.stays) })} className="edit-chat-btn">
            <MessageSquare size={14} /> Edit in chat
          </button>
        </div>
      </div>

      {showFilters && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--navy-100)' }}>
          {filterOptions.map((f) => (
            <Chip key={f} label={f} size="sm" selected={activeFilter === f} onToggle={() => setActiveFilter(f)} />
          ))}
        </motion.div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {currentTrip.stays.map((stay, idx) => (
          <motion.div key={stay.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="item-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="stay-thumb"><MapPin size={20} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="stay-name">{stay.name}</h3>
                    <p className="stay-meta">{stay.type} · {stay.neighborhood}</p>
                    <div className="stay-rating">
                      <Star size={12} style={{ color: 'var(--warning)' }} fill="var(--warning)" />
                      <span className="stay-rating-value">{stay.rating}</span>
                      <span className="stay-rating-count">({stay.reviewCount} reviews)</span>
                    </div>
                  </div>
                </div>
                <p className="stay-why">{stay.whyItFits}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {stay.amenities.map((a) => <span key={a} className="stay-amenity">{a}</span>)}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <p className="flight-price">{stay.priceRange}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => toggleStaySaved(stay.id)} className={`icon-btn ${stay.saved ? 'icon-btn-star-active' : 'icon-btn-star'}`}>
                    <Star size={16} fill={stay.saved ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => openChat({ section: 'stays', itemId: stay.id, contextSummary: buildStayContext(stay) })}
                    className="icon-btn icon-btn-chat"
                    title="Edit in chat"
                    style={{ width: 28, height: 28 }}
                  >
                    <MessageSquare size={13} />
                  </button>
                  <a href={stay.bookingUrl} target="_blank" rel="noopener noreferrer" className="view-btn">
                    View deal <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
