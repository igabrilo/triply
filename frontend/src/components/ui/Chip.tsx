import { motion } from 'framer-motion';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface ChipProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export default function Chip({ label, selected, onToggle, onRemove, size = 'md' }: ChipProps) {
  return (
    <motion.span
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={clsx(
        'chip',
        size === 'sm' && 'chip-sm',
        selected && 'chip-selected'
      )}
    >
      {label}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="chip-remove"
        >
          <X size={12} />
        </button>
      )}
    </motion.span>
  );
}
