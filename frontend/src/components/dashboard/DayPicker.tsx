import { CalendarPlus } from 'lucide-react';
import Modal from '@components/ui/Modal';

interface DayPickerProps {
  isOpen: boolean;
  onClose: () => void;
  days: Array<{ day: number; title: string }>;
  onSelectDay: (day: number) => void;
  activityTitle?: string;
}

export default function DayPicker({ isOpen, onClose, days, onSelectDay, activityTitle }: DayPickerProps) {
  const minDayValue = days.length > 0 ? Math.min(...days.map((d) => d.day)) : 1;
  const toLabelDay = (raw: number) => (minDayValue === 0 ? raw + 1 : raw);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add to day" size="sm">
      {activityTitle && (
        <p style={{ margin: '-4px 0 12px', fontSize: 12, color: 'var(--navy-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activityTitle}
        </p>
      )}
      <div style={{ display: 'grid', gap: 6 }}>
        {days.map((d) => (
          <button
            key={d.day}
            className="item-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              padding: '10px 12px',
            }}
            onClick={() => {
              onSelectDay(d.day);
              onClose();
            }}
          >
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--navy-500)',
              letterSpacing: '0.04em',
              flexShrink: 0,
              minWidth: 36,
            }}>
              DAY {toLabelDay(d.day)}
            </span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--navy-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.title}
            </span>
            <CalendarPlus size={14} style={{ color: 'var(--navy-300)', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </Modal>
  );
}
