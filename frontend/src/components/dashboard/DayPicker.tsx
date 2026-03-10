import Modal from '@components/ui/Modal';

interface DayPickerProps {
  isOpen: boolean;
  onClose: () => void;
  days: Array<{ day: number; title: string }>;
  onSelectDay: (day: number) => void;
}

export default function DayPicker({ isOpen, onClose, days, onSelectDay }: DayPickerProps) {
  const minDayValue = days.length > 0 ? Math.min(...days.map((d) => d.day)) : 1;
  const toLabelDay = (raw: number) => (minDayValue === 0 ? raw + 1 : raw);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Activity To Day" size="sm">
      <div style={{ display: 'grid', gap: 8 }}>
        {days.map((d) => (
          <button
            key={d.day}
            className="btn btn-ghost"
            style={{ justifyContent: 'space-between' }}
            onClick={() => {
              onSelectDay(d.day);
              onClose();
            }}
          >
            <span>Day {toLabelDay(d.day)}</span>
            <span style={{ fontSize: 12, color: 'var(--navy-500)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.title}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
