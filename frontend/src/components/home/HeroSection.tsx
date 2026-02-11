import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

export default function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, -50]);

  return (
    <motion.div 
      ref={ref}
      style={{ 
        textAlign: 'center', 
        maxWidth: 600, 
        margin: '0 auto 48px', 
        paddingTop: 80,
        opacity,
        scale,
        y
      }}
    >
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontSize: 'clamp(36px, 6vw, 56px)',
          fontWeight: 800,
          color: 'var(--navy-950)',
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          marginTop: 0,
        }}
      >
        Your main hub for travel.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{
          marginTop: 20,
          fontSize: 16,
          color: 'var(--navy-600)',
          lineHeight: 1.6,
          maxWidth: 480,
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
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--navy-600)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-500)' }} />
          Personalized itinerary with links.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--navy-600)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-500)' }} />
          Edit only the section you need.
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        style={{ marginTop: 20, fontSize: 13, color: 'var(--primary-500)' }}
      >
        Your trip is saved to your dashboard after you sign in.
      </motion.p>
    </motion.div>
  );
}
