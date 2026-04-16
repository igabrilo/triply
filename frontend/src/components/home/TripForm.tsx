import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Sparkles, Navigation, Loader } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { useAuthStore } from '@/store/authStore';
import { geocodeAPI, authAPI } from '@/services/api';
import Input from '@components/ui/Input';
import Button from '@components/ui/Button';
import Chip from '@components/ui/Chip';
import DateRangePicker from '@components/ui/DateRangePicker';
import DestinationAutocomplete from '@components/ui/DestinationAutocomplete';
import UpgradeModal from '@components/ui/UpgradeModal';
import type { BudgetLevel } from '@/types';

const interestOptions = [
  'Museums', 'Food & Wine', 'Nature', 'Nightlife', 'Shopping',
  'History', 'Architecture', 'Beach', 'Adventure', 'Art',
  'Local culture', 'Photography', 'Wellness',
];

const paceOptions: { label: string; value: 'relaxed' | 'balanced' | 'packed' }[] = [
  { label: 'Relaxed', value: 'relaxed' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'Packed', value: 'packed' },
];

const budgetOptions: { label: string; value: BudgetLevel }[] = [
  { label: 'Budget', value: 'budget' },
  { label: 'Mid-range', value: 'mid' },
  { label: 'Premium', value: 'premium' },
  { label: 'Luxury', value: 'luxury' },
];

const stayStyleOptions = ['Hotel', 'Hostel', 'Apartment', 'Boutique', 'Resort'];
const accessibilityOptions = ['Wheelchair accessible', 'Limited mobility', 'Stroller friendly'];
const dietaryOptions = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free'];

export default function TripForm() {
  const navigate = useNavigate();
  const { formData, updateFormData, generateTrip, clearRememberedDefaults } = useTripStore();
  const { isAuthenticated, user, openAuthModal } = useAuthStore();
  const [destinationInput, setDestinationInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreferences, setShowPreferences] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  
  const ref = useRef(null);

  // Auto-detect location on mount (if not already set)
  useEffect(() => {
    if (formData.origin) return;
    if (!navigator.geolocation) return;

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await geocodeAPI.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (result.success && result.city) {
            updateFormData({ origin: result.city });
          }
        } catch (err) {
          console.warn('Auto-detect location failed:', err);
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        setDetectingLocation(false);
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    setDetectingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await geocodeAPI.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (result.success && result.city) {
            updateFormData({ origin: result.city });
          } else {
            setLocationError('Could not determine your city');
          }
        } catch {
          setLocationError('Failed to detect location');
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        setDetectingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access denied. Please enter manually.');
        } else {
          setLocationError('Could not get your location');
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (formData.destinations.length === 0 && !destinationInput.trim()) {
      errs.destination = 'Please enter a destination';
    }
    if (!formData.startDate || !formData.endDate) {
      errs.dates = 'Please select your travel dates';
    }
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      errs.dates = 'End date must be after start date';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const addDestination = () => {
    const val = destinationInput.trim();
    if (val && !formData.destinations.includes(val)) {
      updateFormData({ destinations: [...formData.destinations, val] });
      setDestinationInput('');
      setErrors((e) => ({ ...e, destination: '' }));
    }
  };

  const removeDestination = (dest: string) => {
    updateFormData({ destinations: formData.destinations.filter((d) => d !== dest) });
  };

  const toggleArray = (key: 'interests' | 'stayStyle' | 'accessibility' | 'dietary', value: string) => {
    const current = formData.preferences[key] as string[];
    const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    updateFormData({ preferences: { ...formData.preferences, [key]: updated } });
  };

  const handleGenerate = async () => {
    if (destinationInput.trim()) addDestination();
    if (!validate()) return;

    const doGenerate = async () => {
      // Check daily trip limit for basic users
      if (user && user.plan !== 'premium') {
        try {
          const usage = await authAPI.getUsageLimits();
          if (usage.limits.tripsPerDay !== null && usage.limits.tripsUsedToday >= usage.limits.tripsPerDay) {
            setShowUpgrade(true);
            return;
          }
        } catch {
          // If limit check fails, let the backend enforce it
        }
      }

      setIsSubmitting(true);
      await generateTrip();
      setIsSubmitting(false);
      navigate('/dashboard');  // navigates immediately – generation continues via SSE
    };

    if (!isAuthenticated) {
      // Save form data to sessionStorage for OAuth flow
      sessionStorage.setItem('pending_trip_generation', 'true');
      openAuthModal('signin', doGenerate);
    } else {
      await doGenerate();
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="card card-hover"
      style={{ maxWidth: 540, margin: '0 auto', padding: '28px 32px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-950)' }}>Build your trip</h2>
        <span className="badge badge-primary">Beta</span>
      </div>
      <p style={{ fontSize: 14, color: 'var(--navy-500)', marginBottom: 24 }}>
        Keep it simple. You can refine later in chat.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Destination */}
        <div>
          <label className="form-label">Where to?</label>
          <DestinationAutocomplete
            value={destinationInput}
            onChange={setDestinationInput}
            onSelect={(city) => {
              if (city && !formData.destinations.includes(city)) {
                updateFormData({ destinations: [...formData.destinations, city] });
                setErrors((e) => ({ ...e, destination: '' }));
              }
              setDestinationInput('');
            }}
            onEnter={addDestination}
            error={errors.destination}
          />
          {formData.destinations.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {formData.destinations.map((d) => (
                <Chip key={d} label={d} selected onRemove={() => removeDestination(d)} />
              ))}
            </div>
          )}
        </div>

        {/* Origin / Flying from */}
        <div>
          <label className="form-label">Flying from</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Input
                placeholder={detectingLocation ? 'Detecting your city...' : 'e.g., London'}
                value={formData.origin}
                onChange={(e) => updateFormData({ origin: e.target.value })}
                icon={detectingLocation
                  ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Navigation size={16} />
                }
              />
            </div>
            <button
              type="button"
              onClick={detectLocation}
              disabled={detectingLocation}
              className="btn btn-ghost btn-sm"
              style={{
                height: 42,
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title="Detect my location"
            >
              <Navigation size={14} />
              Detect
            </button>
          </div>
          {locationError && <p className="form-error">{locationError}</p>}
          <p style={{ fontSize: 12, color: 'var(--navy-400)', marginTop: 4 }}>
            Helps us suggest flights from your city
          </p>
        </div>

        {/* Dates */}
        <div>
          <label className="form-label">Dates</label>
          <DateRangePicker
            startDate={formData.startDate}
            endDate={formData.endDate}
            onStartDateChange={(date) => updateFormData({ startDate: date })}
            onEndDateChange={(date) => updateFormData({ endDate: date })}
            error={errors.dates}
          />
        </div>

        {/* Travelers */}
        <div>
          <label className="form-label">Travelers</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="counter">
              <button className="counter-btn" onClick={() => updateFormData({ travelers: Math.max(1, formData.travelers - 1) })}>
                -
              </button>
              <span className="counter-value">{formData.travelers}</span>
              <button className="counter-btn" onClick={() => updateFormData({ travelers: formData.travelers + 1 })}>
                +
              </button>
            </div>
            <Users size={16} style={{ color: 'var(--navy-400)' }} />
            <span style={{ fontSize: 14, color: 'var(--navy-500)' }}>
              {formData.travelers === 1 ? 'traveler' : 'travelers'}
            </span>
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="form-label">Budget</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {budgetOptions.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={formData.budget === opt.value}
                onToggle={() => updateFormData({ budget: opt.value })}
              />
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn-link"
              onClick={clearRememberedDefaults}
              style={{ fontSize: 12 }}
            >
              Reset remembered defaults
            </button>
          </div>
        </div>

        {/* Preferences Toggle */}
        <button onClick={() => setShowPreferences(!showPreferences)} className="btn-link" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} />
          {showPreferences ? 'Hide preferences' : 'Add preferences (optional)'}
        </button>

        {/* Preferences */}
        {showPreferences && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16, borderTop: '1px solid var(--navy-100)' }}
          >
            <div>
              <label className="form-label">Interests</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {interestOptions.map((i) => (
                  <Chip key={i} label={i} size="sm" selected={formData.preferences.interests.includes(i)} onToggle={() => toggleArray('interests', i)} />
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Pace</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {paceOptions.map((p) => (
                  <Chip key={p.value} label={p.label} selected={formData.preferences.pace === p.value} onToggle={() => updateFormData({ preferences: { ...formData.preferences, pace: p.value } })} />
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Stay style</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {stayStyleOptions.map((s) => (
                  <Chip key={s} label={s} size="sm" selected={formData.preferences.stayStyle.includes(s)} onToggle={() => toggleArray('stayStyle', s)} />
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Accessibility</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {accessibilityOptions.map((a) => (
                  <Chip key={a} label={a} size="sm" selected={formData.preferences.accessibility.includes(a)} onToggle={() => toggleArray('accessibility', a)} />
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Dietary</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {dietaryOptions.map((d) => (
                  <Chip key={d} label={d} size="sm" selected={formData.preferences.dietary.includes(d)} onToggle={() => toggleArray('dietary', d)} />
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.preferences.kidsFriendly}
                onChange={(e) => updateFormData({ preferences: { ...formData.preferences, kidsFriendly: e.target.checked } })}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-700)' }}>Kid-friendly trip</span>
            </label>
          </motion.div>
        )}

        {/* Generate CTA */}
        <Button onClick={handleGenerate} fullWidth size="lg" loading={isSubmitting} icon={<Sparkles size={18} />}>
          Generate my trip
        </Button>

        <p style={{ fontSize: 13, textAlign: 'center', color: 'var(--primary-500)' }}>
          {isAuthenticated ? 'Your trip will be saved to your dashboard.' : "You'll sign in to save your trip to your dashboard."}
        </p>
      </div>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} feature="trip_limit" />
    </motion.div>
  );
}
