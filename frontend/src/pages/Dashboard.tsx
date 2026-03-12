import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Plane, Building2, MapPin, Check } from 'lucide-react';
import Layout from '@components/layout/Layout';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import FirstPlanGuide from '@components/dashboard/FirstPlanGuide';
import OverviewSection from '@components/dashboard/OverviewSection';
import PlanSection from '@components/dashboard/PlanSection';
import ActivitiesSection from '@components/dashboard/ActivitiesSection';
import FlightsSection from '@components/dashboard/FlightsSection';
import StaysSection from '@components/dashboard/StaysSection';
import BudgetSection from '@components/dashboard/BudgetSection';
import WeatherSection from '@components/dashboard/WeatherSection';
import MapSection from '@components/dashboard/MapSection';
import NotesSection from '@components/dashboard/NotesSection';
import ProfileSection from '@components/dashboard/ProfileSection';
import QuickTweaks from '@components/dashboard/QuickTweaks';
import SavedItems from '@components/dashboard/SavedItems';
import SidebarMap from '@components/dashboard/SidebarMap';
import ChatPanel from '@components/chat/ChatPanel';
import { useTripStore } from '@/store/tripStore';
import { featureFlags } from '@/config/featureFlags';

/* ─── Generation progress steps ─── */
const generationSteps = [
  { key: 'plan', icon: MapPin, label: 'Building itinerary' },
  { key: 'stays', icon: Building2, label: 'Finding accommodation' },
  { key: 'flights', icon: Plane, label: 'Searching flights' },
  { key: 'activities', icon: Sparkles, label: 'Generating activities' },
  { key: 'weather', icon: Sparkles, label: 'Preparing weather' },
  { key: 'overview', icon: Sparkles, label: 'Creating overview' },
];

function GeneratingView() {
  const { currentTrip, generationStatus } = useTripStore();

  const hasPlan = (currentTrip?.plan?.length ?? 0) > 0;
  const hasStays = (currentTrip?.stays?.length ?? 0) > 0;
  const hasFlights = (currentTrip?.flights?.length ?? 0) > 0;
  const hasActivities = (currentTrip?.activities?.length ?? 0) > 0;
  const hasWeather = (currentTrip?.weather?.length ?? 0) > 0;
  const hasOverview = !!currentTrip?.overview;
  const sectionDone: Record<string, boolean> = {
    plan: hasPlan,
    stays: hasStays,
    flights: hasFlights,
    activities: hasActivities,
    weather: hasWeather,
    overview: hasOverview,
  };

  const dest = currentTrip?.formData?.destinations?.[0] || 'your trip';

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', paddingTop: 48, paddingBottom: 80 }}>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <div className="gen-spinner-ring" style={{ width: 72, height: 72, margin: '0 auto 20px' }}>
          <Sparkles size={32} style={{ color: 'var(--primary-500)' }} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--navy-950)', marginBottom: 8 }}>
          Crafting your {dest} trip
        </h1>
        <motion.p
          key={generationStatus}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: 15, color: 'var(--navy-500)' }}
        >
          {generationStatus || 'Starting generation...'}
        </motion.p>
      </motion.div>

      {/* Progress Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {generationSteps.map((step, idx) => {
          const done = sectionDone[step.key];
          const isActive = !done && (
            (step.key === 'plan' && !hasPlan) ||
            (step.key === 'stays' && hasPlan && !hasStays) ||
            (step.key === 'flights' && hasPlan && hasStays && !hasFlights) ||
            (step.key === 'activities' && hasPlan && hasStays && hasFlights && !hasActivities) ||
            (step.key === 'weather' && hasPlan && hasStays && hasFlights && hasActivities && !hasWeather) ||
            (step.key === 'overview' && hasPlan && hasStays && hasFlights && hasActivities && hasWeather && !hasOverview)
          );

          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.12 }}
              className="card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                borderLeft: `3px solid ${done ? 'var(--success-500)' : isActive ? 'var(--primary-500)' : 'var(--navy-100)'}`,
                opacity: done || isActive ? 1 : 0.5,
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: done ? 'var(--success-50)' : isActive ? 'var(--primary-50)' : 'var(--navy-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {done ? (
                  <Check size={18} style={{ color: 'var(--success-600)' }} />
                ) : (
                  <step.icon size={18} style={{ color: isActive ? 'var(--primary-600)' : 'var(--navy-400)' }} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: done ? 'var(--success-700)' : 'var(--navy-900)' }}>
                  {done ? `${step.label} — done` : step.label}
                </p>
                {isActive && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--navy-100)', overflow: 'hidden' }}>
                      <motion.div
                        style={{ height: '100%', borderRadius: 2, background: 'var(--primary-500)' }}
                        initial={{ width: '5%' }}
                        animate={{ width: '85%' }}
                        transition={{ duration: 30, ease: 'linear' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Skeleton preview cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="gen-skeleton" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="gen-skeleton" style={{ height: 14, width: `${60 + i * 10}%`, borderRadius: 4, marginBottom: 8 }} />
                <div className="gen-skeleton" style={{ height: 10, width: `${40 + i * 8}%`, borderRadius: 4 }} />
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentTrip, activeTab, isGenerating } = useTripStore();

  useEffect(() => { if (!currentTrip) navigate('/'); }, [currentTrip, navigate]);
  if (!currentTrip) return null;

  const isStillGenerating = isGenerating || currentTrip.status === 'generating';
  const hasContent =
    currentTrip.plan.length > 0 ||
    currentTrip.flights.length > 0 ||
    currentTrip.stays.length > 0 ||
    currentTrip.activities.length > 0 ||
    currentTrip.weather.length > 0 ||
    !!currentTrip.overview;

  // Show generating view when generating and no content yet
  if (isStillGenerating && !hasContent) {
    return (
      <Layout showBlobs={false}>
        <div className="page-container" style={{ paddingTop: 100, paddingBottom: 48 }}>
          <GeneratingView />
        </div>
      </Layout>
    );
  }

  const renderSection = () => {
    switch (activeTab) {
      case 'overview': return <OverviewSection />;
      case 'plan': return <PlanSection />;
      case 'activities': return <ActivitiesSection />;
      case 'flights': return <FlightsSection />;
      case 'stays': return <StaysSection />;
      case 'budget': return <BudgetSection />;
      case 'weather': return <WeatherSection />;
      case 'map': return <MapSection />;
      case 'notes': return <NotesSection />;
      case 'profile': return <ProfileSection />;
      default: return <OverviewSection />;
    }
  };

  const showSidebar = activeTab === 'plan' || activeTab === 'flights' || activeTab === 'stays' || activeTab === 'activities';

  return (
    <Layout showBlobs={false}>
      <div className="page-container dashboard-page-container" style={{ paddingTop: 100, paddingBottom: 48 }}>
        {/* Show a subtle generating banner if still generating but some content arrived */}
        {isStillGenerating && hasContent && (
          <motion.div
            className="print-hide"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: 16,
              padding: '10px 16px',
              borderRadius: 12,
              background: 'var(--primary-50)',
              border: '1px solid var(--primary-100)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 14,
              color: 'var(--primary-700)',
            }}
          >
            <div className="gen-spinner-ring" style={{ width: 24, height: 24 }}>
              <Sparkles size={12} style={{ color: 'var(--primary-500)' }} />
            </div>
            Still generating... Sections will appear as they're ready.
          </motion.div>
        )}

        <DashboardHeader />
        {featureFlags.firstPlanGuide && <FirstPlanGuide />}

        <div className="dashboard-main-wrap" style={{ display: 'flex', gap: 24, flexDirection: showSidebar ? 'row' : 'column' }}>
          {/* Main */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                {renderSection()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          {showSidebar && (
            <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }} className="hide-mobile dashboard-sidebar print-hide">
              <QuickTweaks />
              <SidebarMap />
              <SavedItems />
            </div>
          )}
        </div>
      </div>

      <ChatPanel />
    </Layout>
  );
}
