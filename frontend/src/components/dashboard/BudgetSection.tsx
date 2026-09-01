import { useRef, useState } from 'react';
import { PiggyBank, Plus, Trash2, Pencil, X } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import DateRangePicker from '@components/ui/DateRangePicker';

function money(amount: number | null, currency: string): string {
  if (amount == null) return '-';
  return `${currency} ${amount.toFixed(2)}`;
}

function normalizeCategory(value: string): string {
  return (value || 'other').trim().toLowerCase();
}

function labelCategory(value: string): string {
  const normalized = normalizeCategory(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default function BudgetSection() {
  const currentTrip = useTripStore((s) => s.currentTrip);
  const addBudgetEntry = useTripStore((s) => s.addBudgetEntry);
  const updateBudgetEntry = useTripStore((s) => s.updateBudgetEntry);
  const deleteBudgetEntry = useTripStore((s) => s.deleteBudgetEntry);
  const [category, setCategory] = useState('other');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(currentTrip?.formData?.startDate || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('other');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [entryActionError, setEntryActionError] = useState('');
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  if (!currentTrip) return null;

  const budget = currentTrip.budget;
  const currency = budget?.currency || 'EUR';
  const categories = Array.from(new Set([
    'transport',
    'accommodation',
    'food',
    'activities',
    'shopping',
    'other',
    ...(budget?.categories || []).map((c) => (c.category || '').toLowerCase()).filter(Boolean),
  ]));

  const estimatedByCategory = new Map<string, number>();
  for (const category of budget?.categories || []) {
    const key = normalizeCategory(category.category || 'other');
    const value = Number(category.estimatedAmount ?? 0);
    estimatedByCategory.set(key, value);
  }
  const actualByCategory = new Map<string, number>();
  for (const entry of budget?.entries || []) {
    const key = normalizeCategory(entry.category || 'other');
    const prev = actualByCategory.get(key) || 0;
    actualByCategory.set(key, prev + Number(entry.amount || 0));
  }
  const analyticsCategories = Array.from(new Set([
    ...categories.map((c) => normalizeCategory(c)),
    ...Array.from(actualByCategory.keys()),
    ...Array.from(estimatedByCategory.keys()),
  ]));

  const handleDeleteEntry = async (entryId: string) => {
    const ok = window.confirm('Remove this expense from budget entries?');
    if (!ok) return;
    setEntryActionError('');
    setDeletingEntryId(entryId);
    try {
      await deleteBudgetEntry(entryId);
      if (editingEntryId === entryId) {
        setEditingEntryId(null);
      }
    } catch (err: any) {
      setEntryActionError(err?.response?.data?.message || 'Could not remove expense.');
    } finally {
      setDeletingEntryId(null);
    }
  };

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div>
          <h2 className="section-title">Budget</h2>
          <p style={{ fontSize: 13, color: 'var(--navy-500)', marginTop: 4 }}>
            AI estimates + manual actual spend tracking.
          </p>
        </div>
      </div>

      <div className="item-card" style={{ marginBottom: 12 }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>Add expense</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          <select className="profile-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            className="profile-input"
            type="number"
            min="0"
            step="0.01"
            ref={amountInputRef}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
          />
          <DateRangePicker
            mode="single"
            allowPast
            startDate={date}
            onStartDateChange={setDate}
            placeholder="Expense date"
          />
          <input
            className="profile-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
          />
        </div>
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-ghost btn-sm"
            disabled={saving}
            onClick={async () => {
              const parsedAmount = Number(amount);
              if (!date || !parsedAmount || parsedAmount <= 0) return;
              setSaving(true);
              try {
                await addBudgetEntry({ category, amount: parsedAmount, date, note });
                setAmount('');
                setNote('');
              } finally {
                setSaving(false);
              }
            }}
          >
            <Plus size={14} /> {saving ? 'Saving...' : 'Add expense'}
          </button>
        </div>
      </div>

      <div className="item-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>Estimated total</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--navy-900)' }}>
            {money(budget?.summary?.estimatedTotal ?? budget?.totalEstimated ?? null, currency)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>Actual spent</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--navy-900)' }}>
            {money(budget?.summary?.actualTotal ?? 0, currency)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>Delta</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: (budget?.summary?.delta ?? 0) >= 0 ? 'var(--success-700)' : 'var(--error)' }}>
            {money(budget?.summary?.delta ?? null, currency)}
          </p>
        </div>
      </div>

      {!budget && (
        <div className="item-card" style={{ marginBottom: 12, textAlign: 'center', color: 'var(--navy-500)' }}>
          No AI estimate yet, but you can still track actual spending.
        </div>
      )}

      {budget?.categories?.length ? (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {budget.categories.map((cat) => (
            <div key={cat.category} className="item-card">
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>{cat.category}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--navy-500)' }}>
                {money(cat.estimatedAmount, currency)}
              </p>
              {cat.note && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--navy-500)' }}>{cat.note}</p>}
            </div>
          ))}
        </div>
      ) : null}

      <div className="item-card" style={{ marginBottom: 12 }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>
          Category performance
        </p>
        <div style={{ display: 'grid', gap: 6 }}>
          {analyticsCategories.map((cat) => {
            const estimated = estimatedByCategory.get(cat) ?? 0;
            const actual = actualByCategory.get(cat) ?? 0;
            const delta = estimated - actual;
            return (
              <div
                key={cat}
                style={{
                  border: '1px solid var(--navy-100)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--navy-900)' }}>{labelCategory(cat)}</p>
                <p style={{ margin: 0, color: 'var(--navy-500)' }}>Est: {money(estimated, currency)}</p>
                <p style={{ margin: 0, color: 'var(--navy-500)' }}>Act: {money(actual, currency)}</p>
                <p style={{ margin: 0, fontWeight: 700, color: delta >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  Delta: {money(delta, currency)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="item-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <PiggyBank size={16} style={{ color: 'var(--success-600)' }} />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>Actual entries</p>
        </div>
        {entryActionError && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--error)' }}>{entryActionError}</p>
        )}
        {(budget?.entries?.length || 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>No expenses added yet.</p>
            <div style={{ marginTop: 10 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => amountInputRef.current?.focus()}
              >
                Add First Expense
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {budget?.entries?.map((entry) => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid var(--navy-100)', borderRadius: 10, padding: '8px 10px' }}>
                {editingEntryId === entry.id ? (
                  <div style={{ width: '100%', display: 'grid', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                      <select className="profile-input" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        className="profile-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder="Amount"
                      />
                      <DateRangePicker
                        mode="single"
                        allowPast
                        startDate={editDate}
                        onStartDateChange={setEditDate}
                        placeholder="Expense date"
                      />
                      <input
                        className="profile-input"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Note (optional)"
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={savingEdit || deletingEntryId === entry.id}
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 size={14} /> {deletingEntryId === entry.id ? 'Removing...' : 'Remove expense'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditingEntryId(null)}
                        disabled={savingEdit}
                      >
                        <X size={14} /> Cancel
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={savingEdit}
                        onClick={async () => {
                          const parsed = Number(editAmount);
                          if (!editDate || !parsed || parsed <= 0) return;
                          setSavingEdit(true);
                          try {
                            await updateBudgetEntry(entry.id, {
                              category: editCategory,
                              amount: parsed,
                              date: editDate,
                              note: editNote,
                            });
                            setEditingEntryId(null);
                          } finally {
                            setSavingEdit(false);
                          }
                        }}
                      >
                        {savingEdit ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--navy-900)', textTransform: 'capitalize' }}>
                        {entry.category} - {money(entry.amount, entry.currency || currency)}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--navy-500)' }}>
                        {entry.date}{entry.note ? ` - ${entry.note}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        className="icon-btn"
                        title="Edit entry"
                        onClick={() => {
                          setEditingEntryId(entry.id);
                          setEditCategory(entry.category || 'other');
                          setEditAmount(String(entry.amount || ''));
                          setEditDate(entry.date || '');
                          setEditNote(entry.note || '');
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Delete entry"
                        disabled={deletingEntryId === entry.id}
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 size={14} /> {deletingEntryId === entry.id ? 'Removing...' : 'Remove expense'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
