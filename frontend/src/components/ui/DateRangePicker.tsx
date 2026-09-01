import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

/* ─── Shared types / utils ─────────────────────────────────────────────── */

type Mode = 'range' | 'single';

interface BaseProps {
  mode?: Mode;
  /** Allow selecting dates in the past (e.g. expense logging). Default false. */
  allowPast?: boolean;
  /** Compact visual size for dense UIs like popups. */
  size?: 'md' | 'sm';
  /** Control calendar popup direction. */
  dropdownDirection?: 'auto' | 'down' | 'up';
  /** Control popup horizontal alignment. */
  dropdownAlign?: 'auto' | 'left' | 'right';
  error?: string;
  placeholder?: string;
}

interface RangeProps extends BaseProps {
  mode?: 'range';
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

interface SingleProps extends BaseProps {
  mode: 'single';
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate?: never;
  onEndDateChange?: never;
}

type DateRangePickerProps = RangeProps | SingleProps;

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateObj(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplay(str: string): string {
  const d = toDateObj(str);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/* ─── Component ────────────────────────────────────────────────────────── */

export default function DateRangePicker(props: DateRangePickerProps) {
  const {
    mode = 'range',
    startDate,
    onStartDateChange,
    error,
    allowPast = false,
    size = 'md',
    dropdownDirection = 'auto',
    dropdownAlign = 'auto',
    placeholder,
  } = props;

  const endDate = mode === 'range' ? (props as RangeProps).endDate : '';
  const onEndDateChange = mode === 'range' ? (props as RangeProps).onEndDateChange : undefined;
  const isCompact = size === 'sm';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');

  const initialMonth = toDateObj(startDate) ?? today;
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const estimatedPopupWidth = isCompact ? 260 : 340;

    if (dropdownDirection === 'up') {
      setOpenUpward(true);
    } else if (dropdownDirection === 'down') {
      setOpenUpward(false);
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const estimatedPopupHeight = isCompact ? 300 : 360;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpward(spaceBelow < estimatedPopupHeight && spaceAbove > spaceBelow);
    }

    if (dropdownAlign === 'right') {
      setAlignRight(true);
    } else if (dropdownAlign === 'left') {
      setAlignRight(false);
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const wouldOverflowRight = rect.left + estimatedPopupWidth > window.innerWidth - 12;
      setAlignRight(wouldOverflowRight);
    }

    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, dropdownDirection, dropdownAlign, isCompact]);

  useEffect(() => {
    if (open && !startDate && !endDate) setSelecting('start');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const startObj = toDateObj(startDate);
  const endObj = toDateObj(endDate ?? '');

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayClick = (dateStr: string) => {
    if (mode === 'single') {
      onStartDateChange(dateStr);
      setTimeout(() => setOpen(false), 100);
      return;
    }
    const clicked = toDateObj(dateStr)!;
    if (selecting === 'start') {
      onStartDateChange(dateStr);
      onEndDateChange?.('');
      setSelecting('end');
    } else {
      if (startObj && clicked < startObj) {
        onStartDateChange(dateStr);
        onEndDateChange?.('');
        setSelecting('end');
      } else {
        onEndDateChange?.(dateStr);
        setSelecting('start');
        setTimeout(() => setOpen(false), 120);
      }
    }
  };

  const clearDates = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartDateChange('');
    onEndDateChange?.('');
    setSelecting('start');
  };

  const isInRange = (dateStr: string): boolean => {
    if (mode === 'single') return false;
    const d = toDateObj(dateStr)!;
    const effectiveEnd = endObj ?? (hoverDate ? toDateObj(hoverDate) : null);
    if (!startObj || !effectiveEnd) return false;
    const lo = startObj < effectiveEnd ? startObj : effectiveEnd;
    const hi = startObj < effectiveEnd ? effectiveEnd : startObj;
    return d > lo && d < hi;
  };

  const isRangeStart = (dateStr: string): boolean => startDate === dateStr;
  const isRangeEnd = (dateStr: string): boolean => (endDate ?? '') === dateStr && !!endDate;
  const isToday = (dateStr: string): boolean => toDateStr(today) === dateStr;
  const isPast = (dateStr: string): boolean => !allowPast && toDateObj(dateStr)! < today;

  const daysCount = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const tripDuration = startObj && endObj ? daysBetween(startObj, endObj) : null;

  const hasDates = !!(startDate || endDate);

  const displayText = (() => {
    if (mode === 'single') return startDate ? formatDisplay(startDate) : null;
    if (startDate && endDate) return `${formatDisplay(startDate)} – ${formatDisplay(endDate)}`;
    if (startDate) return `${formatDisplay(startDate)} → ?`;
    return null;
  })();

  const defaultPlaceholder = mode === 'single' ? 'Select date' : 'Select travel dates';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="form-input"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          textAlign: 'left',
          paddingLeft: isCompact ? 36 : 42,
          paddingTop: isCompact ? 8 : 12,
          paddingBottom: isCompact ? 8 : 12,
          color: displayText ? 'var(--navy-900)' : 'var(--navy-400)',
          userSelect: 'none',
          borderColor: open ? 'var(--primary-400)' : undefined,
          boxShadow: open ? '0 0 0 3px rgba(99, 102, 241, 0.12)' : undefined,
          minHeight: isCompact ? 32 : undefined,
          fontSize: isCompact ? 13 : 14,
        }}
      >
        <span style={{
          position: 'absolute', left: isCompact ? 12 : 14, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--navy-400)', display: 'flex',
        }}>
          <Calendar size={isCompact ? 14 : 16} />
        </span>
        <span style={{ flex: 1, fontSize: isCompact ? 13 : 14 }}>
          {displayText ?? (placeholder ?? defaultPlaceholder)}
        </span>
        {hasDates && (
          <span
            role="button"
            onClick={clearDates}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center',
              padding: 2, borderRadius: '50%', color: 'var(--navy-400)', flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--navy-700)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--navy-400)')}
          >
            <X size={isCompact ? 12 : 14} />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              ...(alignRight ? { right: 0 } : { left: 0 }),
              ...(openUpward
                ? { bottom: isCompact ? 'calc(100% + 6px)' : 'calc(100% + 8px)' }
                : { top: isCompact ? 'calc(100% + 6px)' : 'calc(100% + 8px)' }),
              zIndex: 500,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--navy-100)',
              padding: isCompact ? '14px 14px 12px' : '20px 20px 16px',
              minWidth: isCompact ? 248 : 300,
              width: '100%',
              maxWidth: isCompact ? 260 : 340,
            }}
          >
            {/* Month nav header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isCompact ? 10 : 16 }}>
              <NavButton onClick={prevMonth}><ChevronLeft size={16} /></NavButton>
              <span style={{ fontSize: isCompact ? 13 : 14, fontWeight: 700, color: 'var(--navy-900)' }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <NavButton onClick={nextMonth}><ChevronRight size={16} /></NavButton>
            </div>

            {/* Weekday labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: isCompact ? 4 : 6 }}>
              {DAYS.map(d => (
                <div key={d} style={{
                  textAlign: 'center', fontSize: isCompact ? 10 : 11, fontWeight: 600,
                  color: 'var(--navy-400)', padding: '4px 0',
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}

              {Array.from({ length: daysCount }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const past = isPast(dateStr);
                const isStart = isRangeStart(dateStr);
                const isEnd = isRangeEnd(dateStr);
                const selected = isStart || isEnd;
                const inRange = isInRange(dateStr);
                const todayFlag = isToday(dateStr);

                /* border-radius shaping for range endpoints */
                let br = '0';
                if (selected) {
                  if (mode === 'single') br = '50%';
                  else if (isStart && endDate) br = '50% 0 0 50%';
                  else if (isEnd && startDate) br = '0 50% 50% 0';
                  else br = '50%';
                }

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={past}
                    onClick={() => handleDayClick(dateStr)}
                    onMouseEnter={() => !past && setHoverDate(dateStr)}
                    onMouseLeave={() => setHoverDate(null)}
                    style={{
                      position: 'relative',
                      height: isCompact ? 30 : 34,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isCompact ? 12 : 13,
                      fontWeight: selected ? 700 : todayFlag ? 600 : 400,
                      borderRadius: br,
                      background: selected ? 'var(--navy-950)' : inRange ? 'var(--primary-50)' : 'transparent',
                      color: selected ? '#fff' : past ? 'var(--navy-200)' : inRange ? 'var(--primary-700)' : 'var(--navy-800)',
                      cursor: past ? 'default' : 'pointer',
                      transition: 'all 0.1s ease',
                      outline: todayFlag && !selected ? '1.5px solid var(--primary-300)' : 'none',
                      outlineOffset: -2,
                    }}
                  >
                    {/* range strip half-fills */}
                    {(isStart && endDate && mode === 'range') && (
                      <span style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%',
                        background: 'var(--primary-50)', zIndex: 0,
                      }} />
                    )}
                    {(isEnd && startDate && mode === 'range') && (
                      <span style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%',
                        background: 'var(--primary-50)', zIndex: 0,
                      }} />
                    )}
                    <span style={{ position: 'relative', zIndex: 1 }}>{day}</span>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{
              marginTop: isCompact ? 10 : 14, paddingTop: isCompact ? 8 : 12,
              borderTop: '1px solid var(--navy-100)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              minHeight: isCompact ? 22 : 28,
            }}>
              <span style={{ fontSize: isCompact ? 11 : 12, color: 'var(--navy-400)' }}>
                {mode === 'single'
                  ? 'Select a date'
                  : selecting === 'start' ? 'Select departure date' : 'Select return date'}
              </span>
              {mode === 'range' && tripDuration !== null && tripDuration > 0 && (
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--primary-600)',
                  background: 'var(--primary-50)',
                  padding: '2px 10px',
                  borderRadius: 'var(--radius-full)',
                }}>
                  {tripDuration} {tripDuration === 1 ? 'night' : 'nights'}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function NavButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: '50%', color: 'var(--navy-500)',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-50)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}
