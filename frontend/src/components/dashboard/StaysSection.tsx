import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ExternalLink, MapPin, MessageSquare, SlidersHorizontal, Star } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useChatStore } from '@/store/chatStore';
import { buildFallbackImage, buildMapsSearchUrl, buildPlaceImage } from '@/utils/mediaImages';
import Chip from '@components/ui/Chip';

const filterOptions = ['All', 'Budget', 'Mid-range', 'Family-friendly'];

export default function StaysSection() {
  const { currentTrip, toggleStaySaved, selectPrimaryStay, updatedSections, focusStayId, setFocusStayId } = useTripStore();
  const { openChat } = useChatStore();
  const [activeFilter, setActiveFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [imageErrorByStayId, setImageErrorByStayId] = useState<Record<string, boolean>>({});

  if (!currentTrip) return null;
  const wasUpdated = updatedSections['stays'] && Date.now() - updatedSections['stays'] < 30000;

  useEffect(() => {
    if (!focusStayId) return;
    const target = document.querySelector(`[data-stay-id="${focusStayId}"]`) as HTMLElement | null;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeoutId = window.setTimeout(() => setFocusStayId(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [focusStayId, currentTrip.stays, setFocusStayId]);

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="section-title">Stays</h2>
          {wasUpdated && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="badge badge-primary">
              Updated just now
            </motion.span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowFilters(!showFilters)} className="icon-btn">
            <SlidersHorizontal size={16} />
          </button>
          <button onClick={() => openChat({ section: 'stays' })} className="edit-chat-btn">
            <MessageSquare size={14} /> Edit in chat
          </button>
        </div>
      </div>

      {showFilters && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--navy-100)' }}
        >
          {filterOptions.map((f) => (
            <Chip key={f} label={f} size="sm" selected={activeFilter === f} onToggle={() => setActiveFilter(f)} />
          ))}
        </motion.div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {currentTrip.stays.length === 0 && (
          <div className="item-card" style={{ textAlign: 'center', padding: '22px 18px' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>No stay options yet</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--navy-500)' }}>
              Ask AI to generate accommodation suggestions.
            </p>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => openChat({ section: 'stays' })}>
                Generate Stays
              </button>
            </div>
          </div>
        )}

        {currentTrip.stays.map((stay, idx) => {
          const mapsUrl =
            stay.mapsUrl ||
            buildMapsSearchUrl(
              `${stay.name || ''} ${stay.neighborhood || ''} ${currentTrip.formData.destinations[0] || ''}`.trim(),
            );

          return (
            <motion.div
              key={stay.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="item-card"
              data-stay-id={stay.id}
              style={{
                border: focusStayId === stay.id ? '2px solid var(--primary-300)' : undefined,
                boxShadow: focusStayId === stay.id ? '0 0 0 3px var(--primary-100)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div
                      className="stay-thumb"
                      style={{
                        width: 86,
                        height: 86,
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '1px solid var(--navy-100)',
                        background: 'var(--navy-50)',
                        flexShrink: 0,
                      }}
                    >
                      {imageErrorByStayId[stay.id] ? (
                        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                          <MapPin size={20} />
                        </div>
                      ) : (
                        <img
                          src={buildPlaceImage(
                            `${stay.name} ${stay.neighborhood}`.trim(),
                            currentTrip.formData.destinations[0] || stay.name,
                            240,
                            240,
                            `stay-${stay.id}`,
                          )}
                          alt={stay.name}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (img.dataset.fallback === '1') {
                              setImageErrorByStayId((prev) => ({ ...prev, [stay.id]: true }));
                              return;
                            }
                            img.dataset.fallback = '1';
                            img.src = buildFallbackImage(`stay-${stay.id}`, 240, 240);
                          }}
                        />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 className="stay-name">{stay.name}</h3>
                      <p className="stay-meta">{stay.type} - {stay.neighborhood}</p>
                      {stay.isSelected && (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                          <Check size={10} /> Primary
                        </span>
                      )}
                      <div className="stay-rating">
                        <Star size={12} style={{ color: 'var(--warning)' }} fill="var(--warning)" />
                        <span className="stay-rating-value">{stay.rating}</span>
                        <span className="stay-rating-count">({stay.reviewCount} reviews)</span>
                      </div>
                    </div>
                  </div>
                  <p className="stay-why">{stay.whyItFits}</p>
                </div>

                <div style={{ width: 320, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <p className="flight-price">{stay.priceRange}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className={`btn btn-sm ${stay.isSelected ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => selectPrimaryStay(stay.id)}>
                        {stay.isSelected ? 'Selected' : 'Select primary'}
                      </button>
                      <button onClick={() => toggleStaySaved(stay.id)} className={`icon-btn ${stay.saved ? 'icon-btn-star-active' : 'icon-btn-star'}`}>
                        <Star size={16} fill={stay.saved ? 'currentColor' : 'none'} />
                      </button>
                      <a href={stay.bookingUrl} target="_blank" rel="noopener noreferrer" className="view-btn">
                        View deal <ExternalLink size={12} />
                      </a>
                    </div>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <MapPin size={12} /> Google Maps <ExternalLink size={12} />
                    </a>
                  </div>

                  {stay.amenities.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
                      {stay.amenities.map((a) => <span key={a} className="stay-amenity">{a}</span>)}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
