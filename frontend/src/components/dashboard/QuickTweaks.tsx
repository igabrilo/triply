import { motion } from 'framer-motion';
import { useTripStore } from '@/store/tripStore';
import { useChatStore } from '@/store/chatStore';
import Chip from '@components/ui/Chip';

const quickChips = ['Cheaper', 'Kid friendly', 'Reduce walking', 'Rainy day', 'More museums'];

export default function QuickTweaks() {
  const { currentTrip } = useTripStore();
  const { openChat, sendMessage } = useChatStore();

  if (!currentTrip) return null;

  const handleQuickTweak = (label: string) => {
    openChat();
    sendMessage(label);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900)', marginBottom: 4 }}>Quick tweaks</h3>
      <p style={{ fontSize: 12, color: 'var(--navy-500)', marginBottom: 12 }}>One tap opens chat with context attached.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {quickChips.map((chip) => (
          <Chip key={chip} label={chip} size="sm" onToggle={() => handleQuickTweak(chip)} />
        ))}
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Budget level</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900)', textTransform: 'capitalize' }}>{currentTrip.formData.budget}</p>
          <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Estimated daily range</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-700)' }}>
            {currentTrip.formData.budget === 'budget' ? '\u20AC60\u2013\u20AC100' :
             currentTrip.formData.budget === 'mid' ? '\u20AC140\u2013\u20AC220' :
             currentTrip.formData.budget === 'premium' ? '\u20AC250\u2013\u20AC400' : '\u20AC400+'}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Pace</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900)', textTransform: 'capitalize' }}>{currentTrip.formData.preferences.pace}</p>
          <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Edits are scoped to the section you change.</p>
        </div>
      </div>
    </motion.div>
  );
}
