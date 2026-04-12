import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Sparkles, Zap, Download, Map, X } from 'lucide-react';
import Button from '@components/ui/Button';
import { subscriptionAPI } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export type UpgradeFeature = 'pdf' | 'weather_map' | 'chat_edits' | 'trip_limit' | 'general';

const featureCopy: Record<UpgradeFeature, { title: string; description: string }> = {
  pdf: {
    title: 'Export trips as PDF',
    description: 'Download beautiful PDF trip plans to share or print.',
  },
  weather_map: {
    title: 'Live weather map layers',
    description: 'See real-time weather overlays on your trip map.',
  },
  chat_edits: {
    title: 'Unlimited chat edits',
    description: "You've used all your free edits for today. Upgrade for unlimited edits.",
  },
  trip_limit: {
    title: 'Unlimited trip generation',
    description: "You've reached today's free trip limit. Upgrade for unlimited trips.",
  },
  general: {
    title: 'Unlock Premium',
    description: 'Get the most out of Triply with Premium features.',
  },
};

const premiumPerks = [
  { icon: Sparkles, label: 'Premium AI models' },
  { icon: Zap, label: 'Unlimited trips & chat edits' },
  { icon: Crown, label: 'Priority generation' },
  { icon: Download, label: 'PDF export' },
  { icon: Map, label: 'Weather map layers' }
];

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: UpgradeFeature;
}

export default function UpgradeModal({ isOpen, onClose, feature = 'general' }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const copy = featureCopy[feature];

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      onClose();
      openAuthModal('signup');
      return;
    }
    setLoading(true);
    try {
      const result = await subscriptionAPI.createCheckoutSession();
      if (result.success && result.url) window.location.href = result.url;
    } catch {
      // Stripe not configured or network error
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-xl)',
              padding: '28px 24px 24px',
              width: '100%',
              maxWidth: 380,
              position: 'relative',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <button
              onClick={onClose}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--navy-400)', padding: 4, borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ textAlign: 'center', padding: '8px 0 0' }}>
              <div style={{
                width: 56, height: 56,
                borderRadius: 'var(--radius-full)',
                background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Crown size={28} style={{ color: '#fff' }} />
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-950)', marginBottom: 4 }}>
                {copy.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--navy-500)', marginBottom: 24, lineHeight: 1.5 }}>
                {copy.description}
              </p>

              <div style={{
                background: 'var(--surface-dim)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 20px',
                marginBottom: 20,
                textAlign: 'left',
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                  Premium includes
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {premiumPerks.map(({ icon: PerkIcon, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PerkIcon size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--navy-700)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: 16 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--navy-950)' }}>$9</span>
                <span style={{ fontSize: 14, color: 'var(--navy-500)' }}>/month</span>
              </div>

              <Button
                onClick={handleUpgrade}
                disabled={loading}
                style={{ width: '100%', padding: '12px 24px', fontSize: 14 }}
              >
                <Crown size={16} />
                {loading ? 'Redirecting...' : 'Upgrade to Premium'}
              </Button>

              <button
                onClick={onClose}
                style={{
                  marginTop: 12, fontSize: 13, color: 'var(--navy-400)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                }}
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
