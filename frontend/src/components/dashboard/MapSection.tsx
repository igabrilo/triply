import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Maximize2 } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import Chip from '@components/ui/Chip';

const categories = ['All', 'Food', 'Museums', 'Nature', 'Landmarks', 'Shopping'];

export default function MapSection() {
  const { currentTrip, selectedDay, setSelectedDay } = useTripStore();
  const [activeCategory, setActiveCategory] = useState('All');

  if (!currentTrip) return null;

  const allActivities = currentTrip.plan.flatMap((day) =>
    day.activities.map((a) => ({ ...a, day: day.day, dayTitle: day.title }))
  );
  const filteredActivities = selectedDay !== null ? allActivities.filter((a) => a.day === selectedDay) : allActivities;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <h2 className="section-title">Map</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" title="Center on my location"><Navigation size={16} /></button>
          <button className="icon-btn" title="Fit to markers"><Maximize2 size={16} /></button>
        </div>
      </div>

      {/* Day Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        <button onClick={() => setSelectedDay(null)} className={`tab-item tab-sm ${selectedDay === null ? 'tab-active' : ''}`}>All days</button>
        {currentTrip.plan.map((day) => (
          <button key={day.day} onClick={() => setSelectedDay(day.day)} className={`tab-item tab-sm ${selectedDay === day.day ? 'tab-active' : ''}`}>Day {day.day}</button>
        ))}
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {categories.map((cat) => (
          <Chip key={cat} label={cat} size="sm" selected={activeCategory === cat} onToggle={() => setActiveCategory(cat)} />
        ))}
      </div>

      {/* Map Placeholder */}
      <div className="map-placeholder">
        {filteredActivities.map((activity, idx) => (
          <motion.div
            key={activity.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: idx * 0.08, type: 'spring', stiffness: 300 }}
            className="map-marker"
            style={{ left: `${15 + (idx * 17) % 70}%`, top: `${20 + (idx * 23) % 55}%` }}
          >
            {activity.day}
            <div className="map-marker-tooltip">{activity.name}</div>
          </motion.div>
        ))}
        <div className="map-center-label">
          <div className="map-center-box">
            <MapPin size={24} style={{ color: 'var(--primary-500)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-800)' }}>Interactive Map</p>
            <p style={{ fontSize: 12, color: 'var(--navy-500)', marginTop: 4 }}>Map integration coming soon</p>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filteredActivities.map((activity) => (
          <div key={activity.id} className="map-list-item">
            <div className="map-day-badge">{activity.day}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity.name}</p>
              <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Day {activity.day} · {activity.timeOfDay}</p>
            </div>
            <MapPin size={14} style={{ color: 'var(--navy-300)', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
