import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@components/layout/Layout';
import HeroSection from '@components/home/HeroSection';
import TripForm from '@components/home/TripForm';
import FeaturesSection from '@components/home/FeaturesSection';
import HowItWorks from '@components/home/HowItWorks';
import PricingSection from '@components/home/PricingSection';
import Footer from '@components/home/Footer';
import GeneratingOverlay from '@components/ui/GeneratingOverlay';
import { useTripStore } from '@/store/tripStore';
import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const navigate = useNavigate();
  const { isGenerating, generateTrip } = useTripStore();
  const { isAuthenticated } = useAuthStore();

  // Auto-trigger trip generation after OAuth callback (if user was generating a trip)
  useEffect(() => {
    const shouldGenerate = sessionStorage.getItem('pending_trip_generation');
    if (shouldGenerate === 'true' && isAuthenticated) {
      sessionStorage.removeItem('pending_trip_generation');
      // Trigger trip generation
      generateTrip().then(() => {
        navigate('/dashboard');
      });
    }
  }, [isAuthenticated, generateTrip, navigate]);

  // Scroll to section when landing with hash (e.g. from /#how-it-works)
  useEffect(() => {
    const hash = window.location.hash?.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <Layout showBlobs>
      <div className="px-4 sm:px-6 lg:px-8 pt-48 pb-16 sm:pt-56 sm:pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <HeroSection />
        <TripForm />
        <FeaturesSection />
        <HowItWorks />
        <PricingSection />
        <Footer />
      </div>

      {/* Generating Overlay */}
      {isGenerating && <GeneratingOverlay />}
    </Layout>
  );
}
