import { useState } from 'react';
import { Compass, Plus, Bookmark, MapPin, ExternalLink } from 'lucide-react';
import DayPicker from '@components/dashboard/DayPicker';
import { useTripStore } from '@/store/tripStore';
import { buildActivityImage, buildFallbackImage, buildMapsSearchUrl } from '@/utils/mediaImages';

const CATEGORY_FILTERS = ['all', 'attractions', 'food', 'nightlife', 'outdoors', 'shopping', 'custom'];

function cleanActivityTitle(rawTitle: string, destination: string): string {
  const title = (rawTitle || '').trim();
  if (!title) return '';
  const parts = title.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return title;

  const tail = parts.slice(1).join(' ').toLowerCase();
  const dest = (destination || '').trim().toLowerCase();
  if (dest && tail.includes(dest)) {
    return parts[0];
  }
  return title;
}

function cleanActivityDescription(description: string, placeQuery: string, locationName: string, destination: string): string {
  const base = (description || '').trim();
  if (!base) return '';
  const lower = base.toLowerCase();
  const locationTokens = [placeQuery, locationName, destination]
    .map((v) => (v || '').trim().toLowerCase())
    .filter(Boolean);

  if (locationTokens.some((token) => lower.includes(token))) {
    return '';
  }
  return base;
}

export default function ActivitiesSection() {
  const { currentTrip, addSuggestedActivityToDay, generateMoreActivities, updateSuggestedActivityStatus, setActiveTab, setSelectedDay } = useTripStore();
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [addError, setAddError] = useState('');
  const [imageErrorByActivityId, setImageErrorByActivityId] = useState<Record<string, boolean>>({});
  if (!currentTrip) return null;

  const destination = currentTrip.formData.destinations[0] || 'destination';

  const addToDay = async (dayNumber: number) => {
    if (!activeActivityId) return;
    setAddError('');
    try {
      await addSuggestedActivityToDay(activeActivityId, dayNumber);
      setActiveActivityId(null);
      setSelectedDay(dayNumber);
      setActiveTab('plan');
    } catch (err: any) {
      setAddError(err?.response?.data?.message || 'Could not add activity to selected day.');
    }
  };

  const activeActivities = currentTrip.activities.filter((a) => a.status !== 'dismissed');
  const filteredActivities = activeActivities.filter((a) => {
    const byCategory = category === 'all' || (a.category || '').toLowerCase() === category;
    const bySearch =
      !search ||
      (a.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.placeQuery || '').toLowerCase().includes(search.toLowerCase());
    return byCategory && bySearch;
  });
  const hasAnyActivities = activeActivities.length > 0;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div>
          <h2 className="section-title">Activities</h2>
          <p style={{ fontSize: 13, color: 'var(--navy-500)', marginTop: 4 }}>
            AI suggestions bucket. Add activities to specific days manually.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search activities..."
          className="profile-input"
          style={{ maxWidth: 260 }}
        />
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c}
            className={`btn btn-sm ${category === c ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {!hasAnyActivities ? (
        <div className="item-card" style={{ textAlign: 'center', padding: '22px 18px' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>No activity suggestions yet</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--navy-500)' }}>
            Generate AI activities, then add the ones you want to each day.
          </p>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={isSuggesting}
              onClick={async () => {
                setIsSuggesting(true);
                try {
                  await generateMoreActivities();
                } finally {
                  setIsSuggesting(false);
                }
              }}
            >
              <Compass size={14} /> {isSuggesting ? 'Generating...' : 'Generate Activities'}
            </button>
          </div>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="item-card" style={{ textAlign: 'center', padding: '22px 18px' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>No matching activities</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--navy-500)' }}>
            Your current search or category filter is too strict.
          </p>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setSearch('');
                setCategory('all');
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filteredActivities.map((activity) => {
            const mapsUrl =
              activity.mapsUrl ||
              buildMapsSearchUrl(
                activity.placeQuery || activity.locationName || activity.title || `${destination} activity`,
              );
            const displayTitle = cleanActivityTitle(activity.title || '', destination) || activity.title;
            const displayDescription = cleanActivityDescription(
              activity.description || '',
              activity.placeQuery || '',
              activity.locationName || '',
              destination,
            );
            const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
              (displayTitle || activity.title || '').trim() || `${destination} activity`,
            )}`;

            return (
              <div
                key={activity.id}
                className="item-card"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/activity-id', activity.id)}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, cursor: 'grab', alignItems: 'stretch' }}
              >
                <div style={{ display: 'flex', gap: 12, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 116,
                      height: 88,
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: '1px solid var(--navy-100)',
                      background: 'var(--navy-50)',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    {imageErrorByActivityId[activity.id] ? (
                      <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                        <Compass size={18} style={{ color: 'var(--navy-400)' }} />
                      </div>
                    ) : (
                      <img
                        src={activity.cachedImageUrl || buildActivityImage(
                          activity.imageQuery || activity.placeQuery || activity.locationName || activity.title,
                          destination,
                          activity.category || 'activity',
                          420,
                          280,
                          `activity-${currentTrip.id}-${activity.id}`,
                        )}
                        alt={activity.title || 'Activity image'}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.dataset.fallback === '1') {
                            setImageErrorByActivityId((prev) => ({ ...prev, [activity.id]: true }));
                            return;
                          }
                          img.dataset.fallback = '1';
                          img.src = buildFallbackImage(`activity-${currentTrip.id}-${activity.id}`, 420, 280);
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                      display: 'grid',
                      gridTemplateColumns: displayDescription ? 'minmax(170px, 0.95fr) minmax(220px, 1.05fr)' : '1fr',
                      gap: 10,
                      alignItems: 'start',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>{displayTitle}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--navy-500)' }}>
                        {activity.category}{activity.costHint ? ` - ${activity.costHint}` : ''}
                      </p>
                      {!displayDescription && (
                        <a
                          href={googleSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: 'var(--primary-600)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            textDecoration: 'underline',
                            fontWeight: 600,
                          }}
                        >
                          Search on Google <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    {displayDescription && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: 'var(--navy-600)',
                            lineHeight: 1.45,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {displayDescription}
                        </p>
                        <a
                          href={googleSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: 'var(--primary-600)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            textDecoration: 'underline',
                            fontWeight: 600,
                          }}
                        >
                          Search on Google <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', justifyContent: 'center', minWidth: 120 }}>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    title="Open in Google Maps"
                    style={{ justifyContent: 'center' }}
                  >
                    <MapPin size={14} /> Maps <ExternalLink size={12} />
                  </a>
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveActivityId(activity.id)} title="Add to day" style={{ justifyContent: 'center' }}>
                    <Plus size={14} /> Add
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => updateSuggestedActivityStatus(activity.id, 'saved')}
                    title="Save for later"
                    style={{ justifyContent: 'center' }}
                  >
                    <Bookmark size={14} /> Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredActivities.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-ghost btn-sm"
            disabled={isSuggesting}
            onClick={async () => {
              setIsSuggesting(true);
              try {
                await generateMoreActivities(category === 'all' ? undefined : category);
              } finally {
                setIsSuggesting(false);
              }
            }}
            title="Generate more activities"
          >
            <Compass size={14} /> {isSuggesting ? 'Suggesting...' : 'Suggest more'}
          </button>
        </div>
      )}

      {addError && (
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: 'var(--error)' }}>{addError}</p>
      )}

      <DayPicker
        isOpen={!!activeActivityId}
        onClose={() => setActiveActivityId(null)}
        days={currentTrip.plan.map((d) => ({ day: d.day, title: d.title }))}
        onSelectDay={addToDay}
      />
    </div>
  );
}
