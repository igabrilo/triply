import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageSquare, Ticket, MapPin, Clock } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useChatStore } from '@/store/chatStore';

export default function PlanSection() {
  const { currentTrip, selectedDay, setSelectedDay, updateActivityStatus, updatedSections } = useTripStore();
  const { openChat } = useChatStore();

  if (!currentTrip) return null;

  const plan = currentTrip.plan;
  const displayDays = selectedDay !== null ? plan.filter((d) => d.day === selectedDay) : plan;
  const wasUpdated = updatedSections['plan'] && Date.now() - updatedSections['plan'] < 30000;

  const startDate = currentTrip.formData?.startDate;
  const endDate = currentTrip.formData?.endDate;
  const fmtDate = (s: string) => {
    try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return s; }
  };

  return (
    <div className="card" style={{ padding: 28 }}>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy-950)', margin: 0 }}>Plan</h2>
          {startDate && endDate && (
            <p style={{ fontSize: 13, color: 'var(--navy-500)', marginTop: 4, fontWeight: 500 }}>
              {fmtDate(startDate)} — {fmtDate(endDate)} · {plan.length} days
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {wasUpdated && (
            <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="badge badge-primary">Updated</motion.span>
          )}
          <button onClick={() => openChat({ section: 'plan' })} className="edit-chat-btn">
            <MessageSquare size={14} /> Edit in chat
          </button>
        </div>
      </div>

      {/* Day Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        <button onClick={() => setSelectedDay(null)} className={`tab-item tab-sm ${selectedDay === null ? 'tab-active' : ''}`}>
          All
        </button>
        {plan.map((day) => (
          <button key={day.day} onClick={() => setSelectedDay(day.day)} className={`tab-item tab-sm ${selectedDay === day.day ? 'tab-active' : ''}`}>
            Day {day.day}
          </button>
        ))}
      </div>

      {/* Days */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDay ?? 'all'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 32 }}
        >
          {displayDays.map((day, index) => (
            <motion.div 
              key={day.day}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px', amount: 0.2 }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Day Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--primary-600)',
                    background: 'var(--primary-50)', padding: '4px 12px',
                    borderRadius: 20, letterSpacing: '0.02em', whiteSpace: 'nowrap',
                  }}>Day {day.day}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy-900)' }}>
                    {day.title.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s*/i, '').replace(/^\d{4}-\d{2}-\d{2}\s*/, '').replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*/i, '') || day.title}
                  </span>
                </div>
                <button onClick={() => openChat({ section: 'plan', dayNumber: day.day })} className="day-edit-btn">Edit</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {day.activities.map((activity, actIndex) => {
                  const mapLink = activity.links.find(l => l.type === 'map');
                  const ticketLink = activity.links.find(l => l.type === 'tickets' || l.type === 'other');

                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.4, delay: actIndex * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        padding: '16px 20px',
                        background: 'var(--surface)',
                        border: '1px solid var(--navy-100)',
                        borderRadius: 14,
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                      }}
                    >
                      {/* Name + actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy-950)', lineHeight: 1.35, margin: 0 }}>
                          {activity.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 12, flexShrink: 0 }}>
                          <button
                            onClick={() => updateActivityStatus(activity.id, activity.status === 'saved' ? 'planned' : 'saved')}
                            className={`icon-btn ${activity.status === 'saved' ? 'icon-btn-star-active' : 'icon-btn-star'}`}
                            title="Save"
                            style={{ width: 28, height: 28 }}
                          >
                            <Star size={13} fill={activity.status === 'saved' ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            onClick={() => openChat({ section: 'plan', dayNumber: day.day, itemId: activity.id })}
                            className="icon-btn icon-btn-chat"
                            title="Edit in chat"
                            style={{ width: 28, height: 28 }}
                          >
                            <MessageSquare size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      {activity.description && (
                        <p style={{ fontSize: 13, color: 'var(--navy-500)', lineHeight: 1.55, margin: '0 0 10px' }}>
                          {activity.description}
                        </p>
                      )}

                      {/* Time + Duration */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        {activity.timeOfDay && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, color: 'var(--primary-700)', background: 'var(--primary-50)',
                            padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                          }}>
                            <Clock size={11} />
                            {activity.timeOfDay}
                          </span>
                        )}
                        {activity.duration && (
                          <span style={{ fontSize: 12, color: 'var(--navy-400)' }}>{activity.duration}</span>
                        )}
                      </div>

                      {/* Tickets + Maps */}
                      {(ticketLink || mapLink) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 10, borderTop: '1px solid var(--navy-50)' }}>
                          {ticketLink && (
                            <a href={ticketLink.url} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary-600)', textDecoration: 'none' }}>
                              <Ticket size={13} /> Tickets
                            </a>
                          )}
                          {mapLink && (
                            <a href={mapLink.url} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--navy-600)', textDecoration: 'none' }}>
                              <MapPin size={13} /> Maps
                            </a>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
