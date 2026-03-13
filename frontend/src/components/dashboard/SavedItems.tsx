import { motion } from 'framer-motion';
import { Plane, MapPin, Calendar, X } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';

export default function SavedItems() {
  const { currentTrip, updateActivityStatus, updateSuggestedActivityStatus, toggleFlightSaved, toggleStaySaved, setActiveTab, setSelectedDay, setFocusFlightId, setFocusStayId } = useTripStore();

  if (!currentTrip) return null;

  const savedFlights = currentTrip.flights.filter((f) => f.saved);
  const savedStays = currentTrip.stays.filter((s) => s.saved);
  const savedPlanActivities = currentTrip.plan.flatMap((day) =>
    day.activities.filter((a) => a.status === 'saved' || a.status === 'must-do').map((a) => ({ ...a, day: day.day, source: 'plan' as const }))
  );
  const savedBucketActivities = (currentTrip.activities || [])
    .filter((a) => a.status === 'saved')
    .map((a) => ({ ...a, name: a.title || a.placeQuery || 'Activity', day: null, source: 'bucket' as const }));
  const savedActivities = [...savedPlanActivities, ...savedBucketActivities];
  const hasSaved = savedFlights.length > 0 || savedStays.length > 0 || savedActivities.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900)', marginBottom: 4 }}>Saved items</h3>
      <p style={{ fontSize: 12, color: 'var(--navy-500)', marginBottom: 12 }}>Your favorites across flights, stays, and plan.</p>

      {!hasSaved ? (
        <p style={{ fontSize: 12, color: 'var(--navy-400)', textAlign: 'center', padding: '12px 0' }}>
          No saved items yet. Tap the star icon on any item to save it.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {savedActivities.map((a) => (
            <div key={`${a.source}-${a.id}`} className="map-list-item" style={{ cursor: 'pointer' }}
              onClick={() => {
                if (a.source === 'plan') {
                  setSelectedDay(a.day);
                  setActiveTab('plan');
                } else {
                  setActiveTab('activities');
                }
              }}
            >
              <Calendar size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</p>
                <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>
                  {a.source === 'plan' ? `Plan item · Day ${a.day}` : 'Activity suggestion'}
                </p>
              </div>
              <button
                className="icon-btn"
                title="Remove from saved"
                onClick={(e) => {
                  e.stopPropagation();
                  a.source === 'plan' ? updateActivityStatus(a.id, 'planned') : updateSuggestedActivityStatus(a.id, 'suggested');
                }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {savedStays.map((s) => (
            <div key={s.id} className="map-list-item" style={{ cursor: 'pointer' }}
              onClick={() => { setFocusStayId(s.id); setActiveTab('stays'); }}
            >
              <MapPin size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Stay</p>
              </div>
              <button className="icon-btn" title="Remove from saved" onClick={(e) => { e.stopPropagation(); toggleStaySaved(s.id); }}>
                <X size={13} />
              </button>
            </div>
          ))}
          {savedFlights.map((f) => (
            <div key={f.id} className="map-list-item" style={{ cursor: 'pointer' }}
              onClick={() => { setFocusFlightId(f.id); setActiveTab('flights'); }}
            >
              <Plane size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.airline} · {f.departure}→{f.arrival}</p>
                <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Flight</p>
              </div>
              <button className="icon-btn" title="Remove from saved" onClick={(e) => { e.stopPropagation(); toggleFlightSaved(f.id); }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
