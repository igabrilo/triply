import { motion } from 'framer-motion';
import { Plane, MapPin, Calendar } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';

export default function SavedItems() {
  const { currentTrip } = useTripStore();

  if (!currentTrip) return null;

  const savedFlights = currentTrip.flights.filter((f) => f.saved);
  const savedStays = currentTrip.stays.filter((s) => s.saved);
  const savedActivities = currentTrip.plan.flatMap((day) =>
    day.activities.filter((a) => a.status === 'saved' || a.status === 'must-do').map((a) => ({ ...a, day: day.day }))
  );
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
            <div key={a.id} className="map-list-item">
              <Calendar size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</p>
                <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Plan item · Day {a.day}</p>
              </div>
            </div>
          ))}
          {savedStays.map((s) => (
            <div key={s.id} className="map-list-item">
              <MapPin size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Stay</p>
              </div>
            </div>
          ))}
          {savedFlights.map((f) => (
            <div key={f.id} className="map-list-item">
              <Plane size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.airline} · {f.departure}→{f.arrival}</p>
                <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Flight</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
