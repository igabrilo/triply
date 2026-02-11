import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useAuthStore } from '@/store/authStore';
import type { TabId } from '@/types';

const tabs: { id: TabId; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'flights', label: 'Flights' },
  { id: 'stays', label: 'Stays' },
  { id: 'map', label: 'Map' },
  { id: 'profile', label: 'Profile' },
];

export default function DashboardHeader() {
  const { currentTrip, activeTab, setActiveTab } = useTripStore();
  const { user } = useAuthStore();

  if (!currentTrip) return null;

  const dest = currentTrip.formData.destinations[0] || 'Trip';
  const days = currentTrip.plan.length;

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Trip Info */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy-950)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {dest} — {days} days
            <span className="badge badge-success">Saved</span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--navy-500)', marginTop: 2 }}>
            {dest} · {currentTrip.formData.startDate} → {currentTrip.formData.endDate} · {currentTrip.formData.travelers} traveler{currentTrip.formData.travelers > 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm">
            <Download size={15} /> Export
          </button>
          <div className="avatar avatar-sm">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="tab-group" style={{ position: 'relative', zIndex: 20 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-item ${activeTab === tab.id ? 'tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
