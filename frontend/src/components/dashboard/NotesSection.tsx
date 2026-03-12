import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTripStore } from '@/store/tripStore';

export default function NotesSection() {
  const { currentTrip, saveTripNotes } = useTripStore();
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveNotesError, setSaveNotesError] = useState('');
  const hasUserEdited = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const tripId = currentTrip?.id;
  const overview = currentTrip?.overview;

  const ensureBulletPrefix = (text: string): string => {
    return text
      .split('\n')
      .map((line) => {
        const t = line.trimStart();
        if (!t) return line;
        if (/^[•\-*]\s/.test(t) || t.startsWith('•') || t.startsWith('- ') || t.startsWith('* ')) return line;
        return line.replace(/^\s*/, (m) => m + '• ');
      })
      .join('\n');
  };

  useEffect(() => {
    const raw = overview?.notes || '';
    setNotes(ensureBulletPrefix(raw));
    hasUserEdited.current = false;
    setSaveNotesError('');
  }, [tripId, overview?.notes]);

  useEffect(() => {
    if (!tripId || !hasUserEdited.current) return;
    const t = window.setTimeout(async () => {
      setSavingNotes(true);
      setSaveNotesError('');
      try {
        await saveTripNotes(notes);
      } catch {
        setSaveNotesError('Could not save notes. Please try again.');
      } finally {
        setSavingNotes(false);
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [notes, tripId, saveTripNotes]);

  if (!currentTrip) return null;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div>
          <h2 className="section-title">Notes</h2>
          <p style={{ fontSize: 13, color: 'var(--navy-500)', marginTop: 4 }}>
            Trip-level notes. Auto-saves as you type.
          </p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'grid', gap: 12 }}>
        <textarea
          className="profile-input"
          ref={textareaRef}
          value={notes}
          onChange={(e) => {
            hasUserEdited.current = true;
            setSaveNotesError('');
            setNotes(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const ta = e.currentTarget;
              const start = ta.selectionStart;
              const end = ta.selectionEnd;
              const before = notes.slice(0, start);
              const after = notes.slice(end);
              const lineStart = before.lastIndexOf('\n') + 1;
              const line = before.slice(lineStart);
              const bulletMatch = /^[•\-*]\s*/.exec(line);
              const prefix = bulletMatch ? bulletMatch[0] : '• ';
              e.preventDefault();
              const newNotes = before + '\n' + prefix + after;
              setNotes(newNotes);
              hasUserEdited.current = true;
              setSaveNotesError('');
              requestAnimationFrame(() => {
                const newPos = start + 1 + prefix.length;
                ta.setSelectionRange(newPos, newPos);
              });
            }
          }}
          rows={14}
          placeholder="• Write trip notes..."
          style={{ width: '100%', resize: 'vertical', fontSize: 14, lineHeight: 1.6 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {saveNotesError
            ? <p style={{ margin: 0, fontSize: 12, color: 'var(--error)' }}>{saveNotesError}</p>
            : <span style={{ fontSize: 12, color: 'var(--navy-400)' }}>{savingNotes ? 'Saving...' : hasUserEdited.current ? 'Auto-saved' : ''}</span>
          }
          <button
            className="btn btn-ghost btn-sm"
            disabled={savingNotes}
            onClick={async () => {
              setSavingNotes(true);
              setSaveNotesError('');
              try {
                await saveTripNotes(notes);
              } catch {
                setSaveNotesError('Could not save notes. Please try again.');
              } finally {
                setSavingNotes(false);
              }
            }}
          >
            {savingNotes ? 'Saving...' : 'Save now'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
