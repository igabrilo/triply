import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '@components/layout/Layout';
import HeroSection from '@components/home/HeroSection';
import TripForm from '@components/home/TripForm';
import FeaturesSection from '@components/home/FeaturesSection';
import HowItWorks from '@components/home/HowItWorks';
import PricingSection from '@components/home/PricingSection';
import Footer from '@components/home/Footer';
import CrossfadeBackground from '@components/home/CrossfadeBackground';
import { useBackgroundImages } from '@/hooks/useBackgroundImages';
import { useTripStore } from '@/store/tripStore';
import { useAuthStore } from '@/store/authStore';

/* ─── Form section with rotating background images ─── */
function FormWithBackground() {
  const { bgImages, currentImg, prevImg } = useBackgroundImages(10000);

  return (
    <div
      id="trip-form-section"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CrossfadeBackground bgImages={bgImages} currentImg={currentImg} prevImg={prevImg} overlayOpacity={0.85} />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '100%', position: 'relative', zIndex: 2 }}
      >
        <TripForm />
      </motion.div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { generateTrip } = useTripStore();
  const { isAuthenticated } = useAuthStore();

  // Auto-trigger trip generation after OAuth callback (if user was generating a trip)
  useEffect(() => {
    const shouldGenerate = sessionStorage.getItem('pending_trip_generation');
    if (shouldGenerate === 'true' && isAuthenticated) {
      sessionStorage.removeItem('pending_trip_generation');
      // Trigger trip generation
      generateTrip().then(() => {
        navigate('/dashboard');  // navigates immediately – generation continues via SSE
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
    <Layout showBlobs fullViewport>
      {/* ── Section 1: Full-viewport Hero ── */}
      <HeroSection />

      {/* ── Section 2: Trip Form (full screen with background images) ── */}
      <FormWithBackground />

      {/* ── Section 3: Features ── */}
      <div style={{ padding: '80px 16px' }}>
        <FeaturesSection />
      </div>

      {/* ── Section 4: How it Works (centered) ── */}
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px' }}>
        <HowItWorks />
      </div>

      {/* ── Section 5: Pricing (centered) ── */}
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px' }}>
        <PricingSection />
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '40px 16px 60px' }}>
        <Footer />
      </div>
    </Layout>
  );
}
