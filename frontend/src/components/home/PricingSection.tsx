import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { subscriptionAPI } from '@/services/api';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying Triply out.',
    features: [
      '2 trips per day',
      'Basic AI itinerary',
      '5 chat edits per trip/day',
      'Save to dashboard',
    ],
    cta: 'Get started',
    highlighted: false,
  },
  {
    name: 'Premium',
    price: '$9',
    period: '/month',
    description: 'Unlimited trips, smarter AI.',
    features: [
      'Premium AI models',
      'Unlimited trip generation',
      'Unlimited chat edits',
      'Priority generation',
      'Export PDF',
      'Weather map layers',
    ],
    cta: 'Upgrade to Premium',
    highlighted: true,
  },
];

export default function PricingSection() {
  const { isAuthenticated, user, openAuthModal } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleCta = async (planName: string) => {
    if (planName === 'Free') {
      if (!isAuthenticated) openAuthModal('signup');
      return;
    }
    // Premium
    if (!isAuthenticated) {
      openAuthModal('signup');
      return;
    }
    if (user?.plan === 'premium') return;
    setLoading(true);
    try {
      const res = await subscriptionAPI.createCheckoutSession();
      if (res.success && res.url) window.location.href = res.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      id="pricing"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px', amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="card card-hover"
      style={{ maxWidth: 540, margin: '0 auto', padding: '24px 28px', scrollMarginTop: 80 }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-950)', marginBottom: 4 }}>
        Pricing
      </h3>
      <p style={{ fontSize: 13, color: 'var(--navy-500)', marginBottom: 20 }}>
        Start free. Upgrade when you need more.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              padding: '20px 20px 22px',
              borderRadius: 'var(--radius-lg)',
              background: plan.highlighted ? 'var(--navy-950)' : 'var(--surface-dim)',
              border: plan.highlighted ? '1px solid var(--navy-800)' : '1px solid rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all var(--duration-normal) ease',
            }}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: plan.highlighted ? '#fff' : 'var(--navy-950)',
              }}>
                {plan.name}
              </span>
              {plan.highlighted && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--primary-300)',
                  background: 'rgba(99,102,241,0.15)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                }}>
                  <Sparkles size={10} />
                  Popular
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 4 }}>
              <span style={{
                fontSize: 28,
                fontWeight: 800,
                color: plan.highlighted ? '#fff' : 'var(--navy-950)',
                letterSpacing: '-0.02em',
              }}>
                {plan.price}
              </span>
              <span style={{
                fontSize: 13,
                color: plan.highlighted ? 'rgba(255,255,255,0.5)' : 'var(--navy-400)',
              }}>
                {plan.period}
              </span>
            </div>

            <p style={{
              fontSize: 13,
              color: plan.highlighted ? 'rgba(255,255,255,0.6)' : 'var(--navy-500)',
              marginBottom: 16,
              lineHeight: 1.4,
            }}>
              {plan.description}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, flex: 1 }}>
              {plan.features.map((feature) => (
                <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={14} style={{
                    color: plan.highlighted ? 'var(--primary-400)' : 'var(--success)',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 13,
                    color: plan.highlighted ? 'rgba(255,255,255,0.8)' : 'var(--navy-600)',
                  }}>
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleCta(plan.name)}
              disabled={loading && plan.highlighted}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--duration-fast) ease',
                border: 'none',
                background: plan.highlighted ? 'var(--primary-500)' : 'var(--navy-950)',
                color: '#fff',
                opacity: (loading && plan.highlighted) ? 0.7 : 1,
              }}
            >
              {loading && plan.highlighted ? 'Redirecting...' : (user?.plan === 'premium' && plan.highlighted ? 'Current plan' : plan.cta)}
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
