import { motion } from 'framer-motion';
import { Plane, Building2, CalendarDays } from 'lucide-react';

const features = [
  { icon: Plane, label: 'Flights', description: 'Best options' },
  { icon: Building2, label: 'Stays', description: 'Shortlist' },
  { icon: CalendarDays, label: 'Plan', description: 'Day-by-day' },
];

export default function FeaturesSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px', amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="card card-hover"
      style={{ maxWidth: 540, margin: '0 auto', padding: '24px 28px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-950)' }}>What you'll get</h3>
        <button
          className="btn-link"
          style={{ fontSize: 14, fontWeight: 500 }}
        >
          View example
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {features.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              padding: '16px 18px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-dim)',
              border: '1px solid rgba(0,0,0,0.04)',
              transition: 'all var(--duration-normal) ease',
              cursor: 'default',
            }}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-sm)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <f.icon size={14} style={{ color: 'var(--navy-400)' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--navy-500)' }}>{f.label}</span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy-950)' }}>{f.description}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
