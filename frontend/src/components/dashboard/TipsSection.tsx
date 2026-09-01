import { motion } from 'framer-motion';
import {
  BusFront,
  ExternalLink,
  Globe,
  Landmark,
  Link as LinkIcon,
  Shield,
  Ticket,
  Utensils,
  Wallet,
  Wifi,
} from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import type { TripTip } from '@/types';

type IconComponent = typeof BusFront;

interface CategoryMeta {
  label: string;
  icon: IconComponent;
  iconBg: string;
  iconColor: string;
}

const categoryMeta: Record<string, CategoryMeta> = {
  transport: { label: 'Transport', icon: BusFront, iconBg: 'var(--primary-50)', iconColor: 'var(--primary-600)' },
  free_activities: { label: 'Free Activities', icon: Ticket, iconBg: 'var(--success-50)', iconColor: 'var(--success-700)' },
  safety: { label: 'Safety', icon: Shield, iconBg: '#fef2f2', iconColor: '#dc2626' },
  money: { label: 'Money', icon: Wallet, iconBg: '#fefce8', iconColor: '#ca8a04' },
  connectivity: { label: 'Connectivity', icon: Wifi, iconBg: '#eff6ff', iconColor: '#2563eb' },
  food: { label: 'Food', icon: Utensils, iconBg: '#fff7ed', iconColor: '#ea580c' },
  customs: { label: 'Customs', icon: Globe, iconBg: '#f0fdf4', iconColor: '#16a34a' },
  useful_links: { label: 'Useful Links', icon: LinkIcon, iconBg: 'var(--primary-50)', iconColor: 'var(--primary-600)' },
  other: { label: 'Other', icon: Landmark, iconBg: 'var(--navy-50)', iconColor: 'var(--navy-500)' },
};

function normalizeCat(value?: string): string {
  const n = String(value || 'other').trim().toLowerCase();
  return categoryMeta[n] ? n : 'other';
}

function TipCard({ tip, index }: { tip: TripTip; index: number }) {
  const cat = normalizeCat(tip.category);
  const meta = categoryMeta[cat];
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '16px 18px',
        border: '1.5px solid var(--navy-100)',
        borderRadius: 14,
        background: 'var(--surface)',
      }}
    >
      {/* Icon badge */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          flexShrink: 0,
          background: meta.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} style={{ color: meta.iconColor }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-950)' }}>
            {tip.title}
          </p>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: meta.iconColor,
              background: meta.iconBg,
              padding: '2px 8px',
              borderRadius: 20,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {meta.label}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: 'var(--navy-600)', lineHeight: 1.55 }}>
          {tip.description}
        </p>

        {tip.linkUrl && (
          <a
            href={tip.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--primary-600)',
              textDecoration: 'none',
              background: 'var(--primary-50)',
              padding: '4px 10px',
              borderRadius: 8,
              border: '1px solid var(--primary-100)',
              transition: 'opacity 0.15s',
            }}
          >
            <ExternalLink size={12} />
            {tip.linkLabel || 'Open link'}
          </a>
        )}
      </div>
    </motion.div>
  );
}

export default function TipsSection() {
  const currentTrip = useTripStore((s) => s.currentTrip);
  const tips = useTripStore((s) => s.currentTrip?.tips || []);
  if (!currentTrip) return null;

  const catOrder = Object.keys(categoryMeta);
  const sorted = [...tips].sort((a, b) => {
    return catOrder.indexOf(normalizeCat(a.category)) - catOrder.indexOf(normalizeCat(b.category));
  });

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header" style={{ marginBottom: 4 }}>
        <div>
          <h2 className="section-title">Tips</h2>
          <p style={{ fontSize: 13, color: 'var(--navy-500)', marginTop: 4 }}>
            Practical local information to make your trip smoother.
          </p>
        </div>
      </div>

      {tips.length === 0 ? (
        <div
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            border: '1.5px dashed var(--navy-200)',
            borderRadius: 14,
            marginTop: 16,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: 'var(--navy-500)' }}>
            Tips are still being generated. Check back in a moment.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {sorted.map((tip, idx) => (
            <TipCard key={`${tip.category}-${idx}`} tip={tip} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
