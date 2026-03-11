import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Settings, CreditCard, Download, Trash2, Crown, MapPin, Bell, Loader } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTripStore } from '@/store/tripStore';
import { analyticsAPI, tripAPI, authAPI } from '@/services/api';
import { emitGuideChanged, resetGuideState } from '@/utils/firstPlanGuide';
import { featureFlags } from '@/config/featureFlags';
import Button from '@components/ui/Button';
import Chip from '@components/ui/Chip';

const interestOptions = ['Museums', 'Food & Wine', 'Nature', 'Nightlife', 'Shopping', 'History', 'Art', 'Beach'];

type ActivationDaily = {
  date: string;
  tripCreated: number;
  firstUsefulPlan: number;
};

type ActivationMetrics = {
  success: boolean;
  windowDays: number;
  tripCreated: number;
  firstUsefulPlan: number;
  conversionRatePct: number;
  medianTimeToFirstUsefulPlanMinutes: number | null;
  daily: ActivationDaily[];
  definitions?: {
    firstUsefulPlan?: string;
    timeToFirstUsefulPlan?: string;
  };
};

function shortDate(dateISO: string): string {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function activationToCsv(metrics: ActivationMetrics): string {
  const lines: string[] = [];
  lines.push('date,trips_created,first_useful_plan');
  for (const row of metrics.daily || []) {
    lines.push(`${row.date},${Number(row.tripCreated || 0)},${Number(row.firstUsefulPlan || 0)}`);
  }
  lines.push('');
  lines.push('window_days,trip_created,first_useful_plan,conversion_rate_pct,median_time_minutes');
  lines.push(
    [
      metrics.windowDays,
      metrics.tripCreated,
      metrics.firstUsefulPlan,
      metrics.conversionRatePct,
      metrics.medianTimeToFirstUsefulPlanMinutes ?? '',
    ].join(','),
  );
  return lines.join('\n');
}

const paceOptions = ['relaxed', 'balanced', 'packed'] as const;

export default function ProfileSection() {
  const navigate = useNavigate();
  const { user, fetchCurrentUser } = useAuthStore();
  const { currentTrip, setActiveTab, loadTrip } = useTripStore();
  const [activeSection, setActiveSection] = useState<'info' | 'preferences' | 'notifications' | 'subscription' | 'trips'>('info');
  const [activation, setActivation] = useState<ActivationMetrics | null>(null);
  const [loadingActivation, setLoadingActivation] = useState(false);
  const [activationWindow, setActivationWindow] = useState<7 | 30 | 60>(30);
  const isActivationEnabled = featureFlags.activationAnalytics;

  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set(user?.preferences?.interests || []));
  const [selectedPace, setSelectedPace] = useState<string>(user?.preferences?.defaultPace || 'balanced');
  const [homeAirport, setHomeAirport] = useState(user?.preferences?.defaultHomeAirport || '');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [notifications, setNotifications] = useState({
    priceAlerts: user?.notificationPreferences?.priceAlerts ?? true,
    tripReminders: user?.notificationPreferences?.tripReminders ?? true,
    productUpdates: user?.notificationPreferences?.productUpdates ?? true,
    marketingOptIn: user?.notificationPreferences?.marketingOptIn ?? false,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [trips, setTrips] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setSelectedInterests(new Set(user?.preferences?.interests || []));
    setSelectedPace(user?.preferences?.defaultPace || 'balanced');
    setHomeAirport(user?.preferences?.defaultHomeAirport || '');
    setNotifications({
      priceAlerts: user?.notificationPreferences?.priceAlerts ?? true,
      tripReminders: user?.notificationPreferences?.tripReminders ?? true,
      productUpdates: user?.notificationPreferences?.productUpdates ?? true,
      marketingOptIn: user?.notificationPreferences?.marketingOptIn ?? false,
    });
  }, [user]);

  useEffect(() => {
    if (activeSection !== 'trips') return;
    let cancelled = false;
    setLoadingTrips(true);
    tripAPI.getTrips()
      .then((res) => {
        if (cancelled) return;
        if (res?.success && res?.trips) setTrips(res.trips);
      })
      .catch(() => { if (!cancelled) setTrips([]); })
      .finally(() => { if (!cancelled) setLoadingTrips(false); });
    return () => { cancelled = true; };
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'trips') return;
    if (!isActivationEnabled) return;
    let cancelled = false;
    setLoadingActivation(true);
    analyticsAPI.getActivationMetrics(activationWindow)
      .then((res) => {
        if (cancelled) return;
        if (res?.success) {
          setActivation(res as ActivationMetrics);
        } else {
          setActivation(null);
        }
      })
      .catch(() => {
        if (!cancelled) setActivation(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingActivation(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSection, activationWindow, isActivationEnabled]);

  const dailyTail = useMemo(() => {
    if (!activation?.daily?.length) return [];
    return activation.daily.slice(-14);
  }, [activation]);

  const maxDailyValue = useMemo(() => {
    if (!dailyTail.length) return 1;
    return Math.max(
      1,
      ...dailyTail.map((row) => Math.max(Number(row.tripCreated || 0), Number(row.firstUsefulPlan || 0))),
    );
  }, [dailyTail]);

  const conversionTrend = useMemo(() => {
    if (!activation?.daily?.length) return null;
    const last14 = activation.daily.slice(-14);
    if (last14.length < 8) return null;
    const prev = last14.slice(0, 7);
    const curr = last14.slice(7);
    const prevCreated = prev.reduce((sum, row) => sum + Number(row.tripCreated || 0), 0);
    const currCreated = curr.reduce((sum, row) => sum + Number(row.tripCreated || 0), 0);
    if (prevCreated === 0 || currCreated === 0) return null;
    const prevRate = prev.reduce((sum, row) => sum + Number(row.firstUsefulPlan || 0), 0) / prevCreated;
    const currRate = curr.reduce((sum, row) => sum + Number(row.firstUsefulPlan || 0), 0) / currCreated;
    const deltaPct = (currRate - prevRate) * 100;
    return Math.round(deltaPct * 100) / 100;
  }, [activation]);

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
            <div className="avatar avatar-lg">{name?.charAt(0).toUpperCase() || 'U'}</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>{name || 'User'}</h3>
              <p style={{ fontSize: 14, color: 'var(--navy-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={13} /> {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 16, borderTop: '1px solid var(--navy-100)' }}>
            <div>
              <label className="form-label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="profile-input"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" value={user?.email || ''} className="profile-input" disabled />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              size="sm"
              disabled={savingName || name === (user?.name || '')}
              onClick={async () => {
                if (!name.trim()) return;
                setSavingName(true);
                try {
                  const res = await authAPI.updateProfile({ name: name.trim() });
                  if (res?.success) await fetchCurrentUser();
                } finally {
                  setSavingName(false);
                }
              }}
            >
              {savingName ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save changes'}
            </Button>
            <Button variant="ghost" size="sm" icon={<Download size={14} />} disabled>Export data</Button>
            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} disabled>Delete account</Button>
          </div>
        </motion.div>
      )}

      {activeSection === 'preferences' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label className="form-label">Default interests</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {interestOptions.map((i) => (
                <Chip
                  key={i}
                  label={i}
                  size="sm"
                  selected={selectedInterests.has(i)}
                  onToggle={() => {
                    const next = new Set(selectedInterests);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    setSelectedInterests(next);
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Default pace</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {paceOptions.map((p) => (
                <Chip
                  key={p}
                  label={p.charAt(0).toUpperCase() + p.slice(1)}
                  size="sm"
                  selected={selectedPace === p}
                  onToggle={() => setSelectedPace(p)}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Home airport (optional)</label>
            <input
              type="text"
              placeholder="e.g., ZAG"
              value={homeAirport}
              onChange={(e) => setHomeAirport(e.target.value)}
              className="profile-input"
              style={{ maxWidth: 200 }}
            />
          </div>
          <Button
            size="sm"
            disabled={savingPrefs}
            onClick={async () => {
              setSavingPrefs(true);
              try {
                const res = await authAPI.updatePreferences({
                  interests: Array.from(selectedInterests),
                  defaultPace: selectedPace,
                  defaultHomeAirport: homeAirport.trim() || undefined,
                });
                if (res?.success) await fetchCurrentUser();
              } finally {
                setSavingPrefs(false);
              }
            }}
          >
            {savingPrefs ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save preferences'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!currentTrip}
            onClick={() => {
              if (!currentTrip) return;
              resetGuideState(currentTrip.id);
              emitGuideChanged(currentTrip.id);
              setActiveTab('overview');
            }}
          >
            Restart first-plan guide
          </Button>
          <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>These preferences are opt-in. You can clear them at any time.</p>
        </motion.div>
      )}

      {activeSection === 'notifications' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { key: 'priceAlerts' as const, label: 'Price alerts', desc: 'Get notified when flight or stay prices drop.' },
            { key: 'tripReminders' as const, label: 'Trip reminders', desc: 'Reminders before your trip start date.' },
            { key: 'productUpdates' as const, label: 'Feature updates', desc: 'New features and product updates.' },
            { key: 'marketingOptIn' as const, label: 'Marketing emails', desc: 'Travel deals and promotions.' },
          ].map((item) => (
            <label key={item.key} className="profile-toggle-item">
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-800)' }}>{item.label}</p>
                <p style={{ fontSize: 12, color: 'var(--navy-500)' }}>{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={notifications[item.key]}
                onChange={async (e) => {
                  const newVal = e.target.checked;
                  setNotifications((prev) => ({ ...prev, [item.key]: newVal }));
                  setSavingNotifications(true);
                  try {
                    const res = await authAPI.updateNotifications({ [item.key]: newVal });
                    if (res?.success) await fetchCurrentUser();
                  } finally {
                    setSavingNotifications(false);
                  }
                }}
                disabled={savingNotifications}
                style={{ width: 16, height: 16 }}
              />
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
          {isActivationEnabled && (
            <div className="item-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900)', margin: 0 }}>
                  Activation snapshot
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--navy-500)' }}>
                  Created trips vs first useful plans
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {[7, 30, 60].map((days) => (
                  <button
                    key={days}
                    className={`btn btn-sm ${activationWindow === days ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setActivationWindow(days as 7 | 30 | 60)}
                  >
                    {days}d
                  </button>
                ))}
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={!activation}
                  onClick={() => {
                    if (!activation) return;
                    const blob = new Blob([activationToCsv(activation)], { type: 'text/csv;charset=utf-8' });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    const today = new Date().toISOString().slice(0, 10);
                    link.href = url;
                    link.download = `activation-${activation.windowDays}d-${today}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                    if (currentTrip) {
                      tripAPI.trackUsageEvent(currentTrip.id, 'activation_csv_exported', {
                        windowDays: activation.windowDays,
                      }).catch(() => undefined);
                    }
                  }}
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>
            {loadingActivation ? (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>Loading metrics...</p>
            ) : activation ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--navy-500)' }}>Trips created</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>{activation.tripCreated}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--navy-500)' }}>First useful plans</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>{activation.firstUsefulPlan}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--navy-500)' }}>Conversion</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>
                      {activation.conversionRatePct}%
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--navy-500)' }}>Median time</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>
                      {activation.medianTimeToFirstUsefulPlanMinutes == null
                        ? '-'
                        : `${activation.medianTimeToFirstUsefulPlanMinutes} min`}
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--navy-100)', paddingTop: 10 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--navy-500)' }}>
                    Funnel: first useful plans from created trips
                  </p>
                  <div style={{ background: 'var(--navy-100)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, activation.conversionRatePct))}%`,
                        background: 'var(--primary-500)',
                        height: '100%',
                      }}
                    />
                  </div>
                  {conversionTrend != null && (
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: conversionTrend >= 0 ? 'var(--success)' : 'var(--error)' }}>
                      {conversionTrend >= 0 ? '+' : ''}{conversionTrend}% vs previous 7-day conversion rate
                    </p>
                  )}
                </div>

                {!!dailyTail.length && (
                  <div style={{ borderTop: '1px solid var(--navy-100)', paddingTop: 10, display: 'grid', gap: 6 }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>
                      Daily trend (created vs first useful)
                    </p>
                    {dailyTail.map((row) => {
                      const createdW = Math.round((Number(row.tripCreated || 0) / maxDailyValue) * 100);
                      const usefulW = Math.round((Number(row.firstUsefulPlan || 0) / maxDailyValue) * 100);
                      return (
                        <div key={row.date} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--navy-500)' }}>{shortDate(row.date)}</span>
                          <div style={{ display: 'grid', gap: 4 }}>
                            <div style={{ height: 6, background: 'var(--navy-100)', borderRadius: 6, overflow: 'hidden' }}>
                              <div style={{ width: `${createdW}%`, height: '100%', background: 'var(--navy-500)' }} />
                            </div>
                            <div style={{ height: 6, background: 'var(--navy-100)', borderRadius: 6, overflow: 'hidden' }}>
                              <div style={{ width: `${usefulW}%`, height: '100%', background: 'var(--primary-500)' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--navy-400)' }}>
                      Gray = trips created, Blue = first useful plans.
                    </p>
                  </div>
                )}

                {activation.definitions?.firstUsefulPlan && (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--navy-400)' }}>
                    {activation.definitions.firstUsefulPlan}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>Metrics unavailable right now.</p>
            )}
            </div>
          )}

          {loadingTrips ? (
            <div className="item-card" style={{ textAlign: 'center', padding: 32 }}>
              <Loader size={24} style={{ color: 'var(--primary-600)', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 14, color: 'var(--navy-500)' }}>Loading trips...</p>
            </div>
          ) : trips.length > 0 ? (
            trips.map((trip) => {
              const daysCount = trip.startDate && trip.endDate
                ? Math.max(1, Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000))
                : 0;
              const dateRange = trip.startDate && trip.endDate
                ? `${new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : '';
              return (
                <div
                  key={trip.id}
                  className="item-card card-interactive"
                  style={{ cursor: 'pointer' }}
                  onClick={async () => {
                    await loadTrip(trip.id);
                    setActiveTab('overview');
                    navigate('/dashboard');
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>
                        {trip.destination || trip.title || 'Untitled Trip'}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--navy-500)', marginTop: 2 }}>
                        {dateRange}
                        {trip.travelersCount ? ` · ${trip.travelersCount} traveler${trip.travelersCount !== 1 ? 's' : ''}` : ''}
                        {daysCount > 0 ? ` · ${daysCount} days` : ''}
                      </p>
                    </div>
                    <span className={`badge ${trip.status === 'ready' ? 'badge-success' : trip.status === 'generating' ? 'badge-warning' : 'badge-error'}`}>
                      {trip.status === 'ready' ? 'Complete' : trip.status === 'generating' ? 'Generating...' : 'Draft'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="item-card" style={{ opacity: 0.6, textAlign: 'center', padding: 32 }}>
              <p style={{ fontSize: 14, color: 'var(--navy-500)' }}>No trips yet. Start planning!</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
