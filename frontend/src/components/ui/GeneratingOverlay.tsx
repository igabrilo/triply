import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';

export default function GeneratingOverlay() {
  const { isGenerating, generationStatus } = useTripStore();

  if (!isGenerating) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="gen-overlay">
      <div style={{ textAlign: 'center', maxWidth: 360, padding: '0 24px' }}>
        <div className="gen-spinner-ring">
          <Sparkles size={28} style={{ color: 'var(--primary-500)' }} />
        </div>
        <h2 className="gen-title">Building your trip</h2>
        <motion.p key={generationStatus} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="gen-status">
          {generationStatus}
        </motion.p>
        <div className="gen-dots">
          {[0, 1, 2, 3].map((i) => <span key={i} className="gen-dot" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 0.6, x: 0 }} transition={{ delay: 0.5 + i * 0.3 }} className="gen-skeleton" />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
