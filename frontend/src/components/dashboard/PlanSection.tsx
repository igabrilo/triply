import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageSquare, Ticket, MapPin, Clock, Undo2 } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useChatStore } from '@/store/chatStore';
import { buildActivityImage, buildFallbackImage } from '@/utils/mediaImages';
import Modal from '@components/ui/Modal';
import type { PlanDay, Activity } from '@/types';

function buildPlanContext(plan: PlanDay[]): string {
  return plan.map(d =>
    `Day ${d.day}: ${d.title}\n` +
    d.activities.map(a => `  - ${a.name} (${a.timeOfDay || 'TBD'}, ${a.duration || '?'})`).join('\n')
  ).join('\n');
}

function buildDayContext(day: PlanDay): string {
  return `Day ${day.day}: ${day.title}\nActivities:\n` +
    day.activities.map(a =>
      `  - ${a.name}${a.description ? ': ' + a.description : ''} (${a.timeOfDay || 'TBD'}, ${a.duration || '?'})`
    ).join('\n');
}

function buildActivityContext(day: PlanDay, activity: Activity): string {
  return `Day ${day.day}: ${day.title}\nActivity: ${activity.name}` +
    (activity.description ? `\nDescription: ${activity.description}` : '') +
    (activity.timeOfDay ? `\nTime: ${activity.timeOfDay}` : '') +
    (activity.duration ? `\nDuration: ${activity.duration}` : '') +
    (activity.category ? `\nCategory: ${activity.category}` : '');
}

export default function PlanSection() {
  const {
    currentTrip,
    selectedDay,
    setSelectedDay,
    setActiveTab,
    updateActivityStatus,
    addSuggestedActivityToDay,
    returnPlanItemToBucket,
    updatedSections,
  } = useTripStore();
  const { openChat } = useChatStore();
  const [dropDay, setDropDay] = useState<number | null>(null);
  const [autofillError] = useState('');
  const [imageErrorByActivityId, setImageErrorByActivityId] = useState<Record<string, boolean>>({});
  const [pendingRevert, setPendingRevert] = useState<{ id: string; name: string } | null>(null);

  if (!currentTrip) return null;
  const destination = currentTrip.formData.destinations[0] || 'destination';

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
          <button onClick={() => openChat({ section: 'plan', contextSummary: buildPlanContext(plan) })} className="edit-chat-btn">
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
          {displayDays.length === 0 && (
            <div className="item-card" style={{ textAlign: 'center', padding: '22px 18px' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>Your day-by-day plan is empty</p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--navy-500)' }}>
                Start by adding activities from AI suggestions.
              </p>
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setSelectedDay(null);
                    setActiveTab('activities');
                  }}
                >
                  Add from Activities
                </button>
              </div>
            </div>
          )}
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
                <button onClick={() => openChat({ section: 'plan', dayNumber: day.day, contextSummary: buildDayContext(day) })} className="day-edit-btn">Edit</button>
              </div>
              {autofillError && (
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--error)' }}>{autofillError}</p>
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  border: dropDay === day.day ? '1px dashed var(--primary-400)' : '1px dashed transparent',
                  borderRadius: 12,
                  padding: dropDay === day.day ? 8 : 0,
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropDay(day.day);
                }}
                onDragLeave={() => setDropDay(null)}
                onDrop={async (e) => {
                  e.preventDefault();
                  const activityId = e.dataTransfer.getData('text/activity-id');
                  setDropDay(null);
                  if (!activityId) return;
                  await addSuggestedActivityToDay(activityId, day.day);
                }}
              >
                {day.activities.length === 0 && (
                  <div className="item-card" style={{ color: 'var(--navy-500)', fontSize: 13, display: 'grid', gap: 8 }}>
                    <p style={{ margin: 0 }}>This day is empty. Add activities from the Activities tab.</p>
                    <div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setSelectedDay(day.day);
                          setActiveTab('activities');
                        }}
                      >
                        Add from Activities
                      </button>
                    </div>
                  </div>
                )}
                {dropDay === day.day && (
                  <div className="item-card" style={{ color: 'var(--primary-700)', fontSize: 13, border: '1px dashed var(--primary-400)' }}>
                    Drop activity here to add it to Day {day.day}.
                  </div>
                )}
                {day.activities.map((activity, actIndex) => {
                  const mapLink = activity.links.find(l => l.type === 'map');
                  const ticketLink = activity.links.find(l => l.type === 'tickets' || l.type === 'other');
                  const imageSeed = `plan-${currentTrip.id}-${activity.id}`;
                  const imagePrompt = [activity.locationName, activity.name].filter(Boolean).join(', ') || activity.name;

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
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div
                          style={{
                            width: 118,
                            height: 88,
                            borderRadius: 10,
                            overflow: 'hidden',
                            border: '1px solid var(--navy-100)',
                            background: 'var(--navy-50)',
                            flexShrink: 0,
                          }}
                        >
                          {imageErrorByActivityId[activity.id] ? (
                            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                              <MapPin size={18} style={{ color: 'var(--navy-400)' }} />
                            </div>
                          ) : (
                            <img
                              src={activity.cachedImageUrl || buildActivityImage(
                                imagePrompt,
                                destination,
                                activity.category || 'activity',
                                420,
                                280,
                                imageSeed,
                              )}
                              alt={activity.name}
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback === '1') {
                                  setImageErrorByActivityId((prev) => ({ ...prev, [activity.id]: true }));
                                  return;
                                }
                                img.dataset.fallback = '1';
                                img.src = buildFallbackImage(imageSeed, 420, 280);
                              }}
                            />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Name + actions */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy-950)', lineHeight: 1.35, margin: 0 }}>
                              {activity.name}
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 12, flexShrink: 0 }}>
                              <button
                                onClick={() => setPendingRevert({ id: activity.id, name: activity.name })}
                                className="icon-btn"
                                title="Remove from plan"
                                style={{ width: 28, height: 28 }}
                              >
                                <Undo2 size={13} />
                              </button>
                              <button
                                onClick={() => updateActivityStatus(activity.id, activity.status === 'saved' ? 'planned' : 'saved')}
                                className={`icon-btn ${activity.status === 'saved' ? 'icon-btn-star-active' : 'icon-btn-star'}`}
                                title="Save"
                                style={{ width: 28, height: 28 }}
                              >
                                <Star size={13} fill={activity.status === 'saved' ? 'currentColor' : 'none'} />
                              </button>
                              <button
                                onClick={() => openChat({ section: 'plan', dayNumber: day.day, itemId: activity.id, contextSummary: buildActivityContext(day, activity) })}
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

                          {/* Tickets / Reserve + Maps */}
                          {(ticketLink || mapLink) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 10, borderTop: '1px solid var(--navy-50)' }}>
                              {ticketLink && (
                                <a href={ticketLink.url} target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary-600)', textDecoration: 'none' }}>
                                  <Ticket size={13} /> {ticketLink.label}
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
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      <Modal
        isOpen={!!pendingRevert}
        onClose={() => setPendingRevert(null)}
        title="Remove from plan?"
        size="sm"
      >
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--navy-600)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--navy-900)' }}>{pendingRevert?.name}</strong> will be moved back to the Activities bucket. You can add it to a day again at any time.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPendingRevert(null)}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (pendingRevert) returnPlanItemToBucket(pendingRevert.id);
              setPendingRevert(null);
            }}
          >
            <Undo2 size={13} /> Remove
          </button>
        </div>
      </Modal>
    </div>
  );
}
