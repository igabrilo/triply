import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
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

/* Spring config — high stiffness tracks scroll tightly, damping smooths jitter */
const SPRING = { stiffness: 120, damping: 22, mass: 0.6 };

/* ─── Form section — slides up as a sheet over the sticky hero ─── */
function FormWithBackground() {
  const sectionRef = useRef(null);
  const { bgImages, currentImg, prevImg } = useBackgroundImages(12000);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'start start'] });

  // Raw scroll-driven values
  const rawBgScale     = useTransform(scrollYProgress, [0, 1],    [1.08, 1.0]);
  const rawBorderRadius = useTransform(scrollYProgress, [0, 0.65], [32,   0]);

  // Sprung — gives the "glide" feeling instead of mechanical tracking
  const bgScale     = useSpring(rawBgScale,      SPRING);
  const borderRadius = useSpring(rawBorderRadius, SPRING);

  return (
    <motion.div
      ref={sectionRef}
      id="trip-form-section"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 16px',
        position: 'relative',
        overflow: 'hidden',
        /* Sits on top of the sticky hero */
        zIndex: 1,
        borderRadius,
        /* Lift shadow as it slides over the hero */
        boxShadow: '0 -12px 60px rgba(0,0,0,0.14)',
      }}
    >
      {/* Scroll-zoom background wrapper */}
      <motion.div style={{ position: 'absolute', inset: 0, scale: bgScale, transformOrigin: 'center center' }}>
        <CrossfadeBackground bgImages={bgImages} currentImg={currentImg} prevImg={prevImg} overlayOpacity={0.85} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '100%', position: 'relative', zIndex: 2 }}
      >
        <TripForm />
      </motion.div>
    </motion.div>
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
      {/* ── Section 1: Sticky hero — subsequent sections slide over it ── */}
      <HeroSection />

      {/* ── Sections 2–5 + Footer stack on top of the sticky hero ── */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Section 2: Trip Form (slides up as a card over the hero) ── */}
        <FormWithBackground />

        {/* ── Section 3: Features ── */}
        <div style={{ padding: '80px 16px', background: 'var(--surface-dim)' }}>
          <FeaturesSection />
        </div>

        {/* ── Section 4: How it Works ── */}
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px', background: 'var(--surface)' }}>
          <HowItWorks />
        </div>

        {/* ── Section 5: Pricing ── */}
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px', background: 'var(--surface-dim)' }}>
          <PricingSection />
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '40px 16px 60px', background: 'var(--surface-dim)' }}>
          <Footer />
        </div>
      </div>
    </Layout>
  );
}
