import { motion } from 'framer-motion';

const steps = [
  { number: '01', title: 'Fill the form', description: 'Destination, dates, budget, vibe.' },
  { number: '02', title: 'Get your dashboard', description: 'Plan, flights, stays, and a map.' },
  { number: '03', title: 'Edit in chat', description: 'Change only one day or one section.' },
];

export default function HowItWorks() {
  return (
    <motion.div
      id="how-it-works"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px', amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="card card-hover"
      style={{ maxWidth: 540, margin: '0 auto', padding: '24px 28px', scrollMarginTop: 80 }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-950)', marginBottom: 20 }}>
        How it works
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            style={{
              padding: '18px 18px 20px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-dim)',
              border: '1px solid rgba(0,0,0,0.04)',
              transition: 'all var(--duration-normal) ease',
            }}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-sm)' }}
          >
            <span style={{
              display: 'inline-block',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--primary-600)',
              background: 'var(--primary-50)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              marginBottom: 12,
              letterSpacing: '0.02em',
            }}>
              {step.number}
            </span>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy-950)', marginBottom: 4 }}>
              {step.title}
            </p>
            <p style={{ fontSize: 13, color: 'var(--navy-500)', lineHeight: 1.5 }}>
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
