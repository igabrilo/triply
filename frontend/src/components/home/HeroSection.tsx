import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useBackgroundImages } from '@/hooks/useBackgroundImages';
import CrossfadeBackground from './CrossfadeBackground';

export default function HeroSection() {
  const ref = useRef(null);
  const { bgImages, currentImg, prevImg } = useBackgroundImages(10000);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.6], [1, 0.92]);
  const y = useTransform(scrollYProgress, [0, 0.6], [0, -80]);

  const handleScrollDown = () => {
    const formSection = document.getElementById('trip-form-section');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  return (
    <motion.section
      ref={ref}
      style={{
        height: '100dvh',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        opacity: contentOpacity,
        scale,
        y,
      }}
    >
      <CrossfadeBackground bgImages={bgImages} currentImg={currentImg} prevImg={prevImg} />

      <div style={{ maxWidth: 680, padding: '0 24px', position: 'relative', zIndex: 2 }}>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(40px, 7vw, 72px)',
            fontWeight: 800,
            color: 'var(--navy-950)',
            letterSpacing: '-0.04em',
            lineHeight: 1.08,
            marginTop: 0,
          }}
        >
          Your main hub
          <br />
          for travel.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{
            marginTop: 20,
            fontSize: 'clamp(14px, 1.6vw, 17px)',
            color: 'var(--navy-500)',
            lineHeight: 1.6,
            maxWidth: 440,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Triply builds flights, stays, and a day-by-day plan with links.
          Then you tweak anything in chat.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--navy-600)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary-500)', flexShrink: 0 }} />
            Personalized itinerary
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--navy-600)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary-500)', flexShrink: 0 }} />
            Edit any section in chat
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.button
        onClick={handleScrollDown}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        style={{
          position: 'absolute',
          bottom: 40,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--navy-400)', letterSpacing: '0.05em' }}>
          Scroll to explore
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={20} style={{ color: 'var(--navy-400)' }} />
        </motion.div>
      </motion.button>
    </motion.section>
  );
}
