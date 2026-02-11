import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from '@components/layout/Layout';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import PlanSection from '@components/dashboard/PlanSection';
import FlightsSection from '@components/dashboard/FlightsSection';
import StaysSection from '@components/dashboard/StaysSection';
import MapSection from '@components/dashboard/MapSection';
import ProfileSection from '@components/dashboard/ProfileSection';
import QuickTweaks from '@components/dashboard/QuickTweaks';
import SavedItems from '@components/dashboard/SavedItems';
import ChatPanel from '@components/chat/ChatPanel';
import { useTripStore } from '@/store/tripStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentTrip, activeTab } = useTripStore();

  useEffect(() => { if (!currentTrip) navigate('/'); }, [currentTrip, navigate]);
  if (!currentTrip) return null;

  const renderSection = () => {
    switch (activeTab) {
      case 'plan': return <PlanSection />;
      case 'flights': return <FlightsSection />;
      case 'stays': return <StaysSection />;
      case 'map': return <MapSection />;
      case 'profile': return <ProfileSection />;
      default: return <PlanSection />;
    }
  };

  const showSidebar = activeTab === 'plan' || activeTab === 'flights' || activeTab === 'stays';

  return (
    <Layout showBlobs={false}>
      <div className="page-container" style={{ paddingTop: 100, paddingBottom: 48 }}>
        <DashboardHeader />

        <div style={{ display: 'flex', gap: 24, flexDirection: showSidebar ? 'row' : 'column' }}>
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
            <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }} className="hide-mobile">
              <QuickTweaks />
              <SavedItems />
            </div>
          )}
        </div>
      </div>

      <ChatPanel />
    </Layout>
  );
}
