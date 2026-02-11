import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        maxWidth: 540,
        margin: '0 auto',
        padding: '24px 4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--navy-400)' }}>
        &copy; {new Date().getFullYear()} Triply
      </span>

      <div style={{ display: 'flex', gap: 20 }}>
        <a
          href="#"
          style={{
            fontSize: 13,
            color: 'var(--navy-400)',
            textDecoration: 'none',
            transition: 'color var(--duration-fast) ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--navy-700)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--navy-400)')}
        >
          Privacy
        </a>
        <a
          href="#"
          style={{
            fontSize: 13,
            color: 'var(--navy-400)',
            textDecoration: 'none',
            transition: 'color var(--duration-fast) ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--navy-700)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--navy-400)')}
        >
          Terms
        </a>
      </div>
    </motion.footer>
  );
}
