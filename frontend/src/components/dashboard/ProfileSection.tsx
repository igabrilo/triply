import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Settings, CreditCard, Download, Trash2, Crown, MapPin, Bell } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import Button from '@components/ui/Button';
import Chip from '@components/ui/Chip';

const interestOptions = ['Museums', 'Food & Wine', 'Nature', 'Nightlife', 'Shopping', 'History', 'Art', 'Beach'];

export default function ProfileSection() {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState<'info' | 'preferences' | 'notifications' | 'subscription' | 'trips'>('info');

  const sections = [
    { id: 'info' as const, label: 'Account', icon: User },
    { id: 'preferences' as const, label: 'Preferences', icon: Settings },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'subscription' as const, label: 'Subscription', icon: Crown },
    { id: 'trips' as const, label: 'Past Trips', icon: MapPin },
  ];

  return (
    <div className="card" style={{ padding: 24 }}>
      <h2 className="section-title" style={{ marginBottom: 24 }}>Profile & Account</h2>

      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4, marginBottom: 24 }}>
        {sections.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveSection(id)} className={`tab-item tab-sm ${activeSection === id ? 'tab-active' : ''}`}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon size={14} /> {label}</span>
          </button>
        ))}
      </div>

      {activeSection === 'info' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="avatar avatar-lg">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>{user?.name || 'User'}</h3>
              <p style={{ fontSize: 14, color: 'var(--navy-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={13} /> {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 16, borderTop: '1px solid var(--navy-100)' }}>
            <div>
              <label className="form-label">Name</label>
              <input type="text" defaultValue={user?.name || ''} className="profile-input" />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" defaultValue={user?.email || ''} className="profile-input" disabled />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button size="sm">Save changes</Button>
            <Button variant="ghost" size="sm" icon={<Download size={14} />}>Export data</Button>
            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />}>Delete account</Button>
          </div>
        </motion.div>
      )}

      {activeSection === 'preferences' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label className="form-label">Default interests</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {interestOptions.map((i) => <Chip key={i} label={i} size="sm" onToggle={() => {}} />)}
            </div>
          </div>
          <div>
            <label className="form-label">Default pace</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Chip label="Relaxed" size="sm" onToggle={() => {}} />
              <Chip label="Balanced" size="sm" selected onToggle={() => {}} />
              <Chip label="Packed" size="sm" onToggle={() => {}} />
            </div>
          </div>
          <div>
            <label className="form-label">Home airport (optional)</label>
            <input type="text" placeholder="e.g., ZAG" className="profile-input" style={{ maxWidth: 200 }} />
          </div>
          <Button size="sm">Save preferences</Button>
          <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>These preferences are opt-in. You can clear them at any time.</p>
        </motion.div>
      )}

      {activeSection === 'notifications' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'Price alerts', desc: 'Get notified when flight or stay prices drop.' },
            { label: 'Trip reminders', desc: 'Reminders before your trip start date.' },
            { label: 'Feature updates', desc: 'New features and product updates.' },
            { label: 'Marketing emails', desc: 'Travel deals and promotions.' },
          ].map((item) => (
            <label key={item.label} className="profile-toggle-item">
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-800)' }}>{item.label}</p>
                <p style={{ fontSize: 12, color: 'var(--navy-500)' }}>{item.desc}</p>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
            </label>
          ))}
        </motion.div>
      )}

      {activeSection === 'subscription' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="subscription-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Crown size={18} style={{ color: 'var(--primary-600)' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>Free Plan</h3>
            </div>
            <p style={{ fontSize: 14, color: 'var(--navy-600)', marginBottom: 16 }}>3 trip generations/month, 5 chat edits/trip.</p>
            <Button size="sm" icon={<Crown size={14} />}>Upgrade to Premium</Button>
          </div>
          <div className="item-card">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-800)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CreditCard size={15} /> Payment method
            </h3>
            <p style={{ fontSize: 14, color: 'var(--navy-500)' }}>No payment method on file.</p>
            <button className="btn-link" style={{ marginTop: 8 }}>Add payment method</button>
          </div>
        </motion.div>
      )}

      {activeSection === 'trips' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="item-card card-interactive">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>Paris — 5 days</h3>
                <p style={{ fontSize: 12, color: 'var(--navy-500)', marginTop: 2 }}>Jun 10–15, 2026 · 2 travelers</p>
              </div>
              <span className="badge badge-success">Active</span>
            </div>
          </div>
          <div className="item-card" style={{ opacity: 0.6, textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 14, color: 'var(--navy-500)' }}>No other trips yet. Start planning!</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
