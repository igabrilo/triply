import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageSquare, ExternalLink } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useChatStore } from '@/store/chatStore';

export default function PlanSection() {
  const { currentTrip, selectedDay, setSelectedDay, updateActivityStatus, updatedSections } = useTripStore();
  const { openChat } = useChatStore();

  if (!currentTrip) return null;

  const plan = currentTrip.plan;
  const displayDays = selectedDay !== null ? plan.filter((d) => d.day === selectedDay) : plan;
  const wasUpdated = updatedSections['plan'] && Date.now() - updatedSections['plan'] < 30000;

  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Header */}
      <div className="section-header">
        <h2 className="section-title">Plan</h2>
        <button onClick={() => openChat({ section: 'plan' })} className="edit-chat-btn">
          <MessageSquare size={14} /> Edit in chat
        </button>
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

      {/* Section subheader */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>Day-by-day Itinerary</h3>
        {wasUpdated && (
          <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="badge badge-primary">
            Updated just now
          </motion.span>
        )}
      </div>
      <p className="section-subtitle" style={{ marginBottom: 20 }}>Tap an item for links. Edit only what you need.</p>

      {/* Days */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDay ?? 'all'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          {displayDays.map((day, index) => (
            <motion.div 
              key={day.day}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px', amount: 0.2 }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="day-header">
                <span className="day-title">Day {day.day} · {day.title}</span>
                <button onClick={() => openChat({ section: 'plan', dayNumber: day.day })} className="day-edit-btn">
                  Edit Day {day.day}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {day.activities.map((activity, actIndex) => (
                  <motion.div 
                    key={activity.id} 
                    className="item-card" 
                    style={{ position: 'relative' }}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.4, delay: actIndex * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h5 className="item-card-title">{activity.name}</h5>
                        <p className="item-card-desc">{activity.description}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <span className="badge badge-time">{activity.timeOfDay}</span>
                          <span style={{ fontSize: 12, color: 'var(--navy-400)' }}>{activity.duration}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                          {activity.links.map((link) => (
                            <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="ext-link">
                              {link.label} <ExternalLink size={10} />
                            </a>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12 }}>
                        <button
                          onClick={() => updateActivityStatus(activity.id, activity.status === 'saved' ? 'planned' : 'saved')}
                          className={`icon-btn ${activity.status === 'saved' ? 'icon-btn-star-active' : 'icon-btn-star'}`}
                          title="Save item"
                        >
                          <Star size={14} fill={activity.status === 'saved' ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={() => openChat({ section: 'plan', dayNumber: day.day, itemId: activity.id })}
                          className="icon-btn icon-btn-chat"
                          title="Edit in chat"
                        >
                          <MessageSquare size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      <p style={{ fontSize: 12, color: 'var(--navy-400)', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--navy-50)' }}>
        Links are suggestions. Always verify opening hours and ticket availability.
      </p>
    </div>
  );
}
