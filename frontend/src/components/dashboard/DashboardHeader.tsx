import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useAuthStore } from '@/store/authStore';
import { tripAPI } from '@/services/api';
import { emitGuideChanged, setGuideExportDone } from '@/utils/firstPlanGuide';
import type { TabId } from '@/types';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'Plan' },
  { id: 'activities', label: 'Activities' },
  { id: 'flights', label: 'Flights' },
  { id: 'stays', label: 'Stays' },
  { id: 'budget', label: 'Budget' },
  { id: 'weather', label: 'Weather' },
  { id: 'map', label: 'Map' },
  { id: 'notes', label: 'Notes' },
];

export default function DashboardHeader() {
  const { currentTrip, activeTab, setActiveTab, isGenerating } = useTripStore();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!currentTrip) return null;

  const dest = currentTrip.formData.destinations[0] || 'Trip';
  const days = currentTrip.plan.length;
  const isReady = currentTrip.status === 'ready' && !isGenerating;
  const onExport = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const blob = await tripAPI.exportOverviewPdf(currentTrip.id);
      const safeDest = (dest || 'trip').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'trip';
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeDest}-overview.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setGuideExportDone(currentTrip.id, true);
      emitGuideChanged(currentTrip.id);
      tripAPI.trackUsageEvent(currentTrip.id, 'overview_exported').catch(() => undefined);
      return;
    } catch (err) {
      // Fallback to browser print when server-side PDF export is unavailable.
      console.error('Server PDF export failed, falling back to print.', err);
    } finally {
      setExporting(false);
    }

    const previousTitle = document.title;
    document.title = `${dest} - Triply Overview`;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    setActiveTab('overview');
    setGuideExportDone(currentTrip.id, true);
    emitGuideChanged(currentTrip.id);
    tripAPI.trackUsageEvent(currentTrip.id, 'overview_exported_fallback').catch(() => undefined);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(restoreTitle, 1500);
    }, 350);
  };

  return (
    <div className="print-hide" style={{ marginBottom: 24 }}>
      {/* Trip Info */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy-950)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {dest}{days > 0 ? ` — ${days} days` : ''}
            {isReady ? (
              <span className="badge badge-success">Saved</span>
            ) : (
              <span className="badge badge-warning">Generating...</span>
            )}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--navy-500)', marginTop: 2 }}>
            {dest} · {currentTrip.formData.startDate} → {currentTrip.formData.endDate} · {currentTrip.formData.travelers} traveler{currentTrip.formData.travelers > 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onExport} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Exporting...' : 'Export'}
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="avatar avatar-sm"
              style={{ border: 'none', cursor: 'pointer' }}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </button>
            {menuOpen && (
              <div
                className="item-card"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  zIndex: 30,
                  minWidth: 150,
                  padding: 8,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setActiveTab('profile');
                    setMenuOpen(false);
                  }}
                >
                  Profile
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await logout();
                    window.location.assign('/');
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
        <div className="tab-group" style={{ position: 'relative', zIndex: 20, minWidth: 'max-content' }}>
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
    </div>
  );
}
