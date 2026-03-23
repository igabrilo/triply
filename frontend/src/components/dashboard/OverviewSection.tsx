import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CloudSun, FileText, PiggyBank, Plane, Bed, X, Plus, Trash2, Lightbulb } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { buildFallbackImage, buildAirlineLogoUrl, buildPlaceImage, buildWeatherImage, buildStayPhotoProxyUrl } from '@/utils/mediaImages';
import SidebarMap from '@components/dashboard/SidebarMap';
import DateRangePicker from '@components/ui/DateRangePicker';

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function money(amount: number | null | undefined, currency: string): string {
  if (amount == null) return '-';
  return `${currency} ${amount.toFixed(2)}`;
}

function nightsBetween(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / dayMs));
}

function buildDefaultTravelDescription(params: {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: string;
  pace: 'relaxed' | 'balanced' | 'packed';
  origin: string;
}): string {
  const destination = (params.destination || 'trip').trim();
  const nights = nightsBetween(params.startDate, params.endDate);
  const nightsLabel = nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : 'multiple nights';
  const budgetLabelMap: Record<string, string> = {
    budget: 'budget-friendly',
    mid: 'mid-range',
    premium: 'premium',
    luxury: 'luxury',
  };
  const paceLabelMap: Record<'relaxed' | 'balanced' | 'packed', string> = {
    relaxed: 'relaxed',
    balanced: 'balanced',
    packed: 'packed',
  };
  const budgetLabel = budgetLabelMap[params.budget] || params.budget || 'balanced';
  const paceLabel = paceLabelMap[params.pace] || 'balanced';
  const startPretty = fmtDate(params.startDate);
  const endPretty = fmtDate(params.endDate);
  const fromLabel = (params.origin || '').trim() || 'your origin';
  const travelers = Math.max(1, Number(params.travelers) || 1);
  const travelersLabel = `${travelers} traveler${travelers > 1 ? 's' : ''}`;

  let description = `A ${nightsLabel} ${destination} trip for ${travelersLabel} from ${fromLabel}, planned in a ${paceLabel} style with a ${budgetLabel} budget.`;
  if (startPretty === '-' || endPretty === '-') {
    description += ' Travel dates can be adjusted anytime.';
  }

  if (destination.toLowerCase().includes('tokyo')) {
    description += ' Focus areas include iconic neighborhoods, efficient transit planning, and flexible day-trip options to keep the itinerary practical and easy to follow.';
  }

  return description;
}

function normalizeDestinationName(value: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const map: Record<string, string> = {
    tokio: 'Tokyo',
  };
  return map[raw.toLowerCase()] || raw;
}

function normalizeAdviceLine(value: string): string {
  const cleaned = String(value || '')
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, '')
    .trim();
  if (!cleaned) return '';
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function formatBudgetTier(value: string): string {
  const map: Record<string, string> = {
    budget: 'Budget-friendly',
    mid: 'Mid-range',
    premium: 'Premium',
    luxury: 'Luxury',
  };
  return map[(value || '').toLowerCase()] || (value || 'Flexible');
}

function formatPace(value: 'relaxed' | 'balanced' | 'packed'): string {
  const map: Record<'relaxed' | 'balanced' | 'packed', string> = {
    relaxed: 'Relaxed',
    balanced: 'Balanced',
    packed: 'Packed',
  };
  return map[value] || 'Balanced';
}

function splitTravelDescription(value: string): string[] {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentenceChunks = (clean.match(/[^.!?]+[.!?]?/g) || [])
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentenceChunks.length <= 2) return sentenceChunks;
  return [sentenceChunks[0], sentenceChunks.slice(1).join(' ')];
}

function isLegacyAutoOverviewImage(url: string): boolean {
  const value = (url || '').trim().toLowerCase();
  if (!value) return false;
  if (value.includes('image.pollinations.ai/prompt/')) return true;
  if (!value.includes('/api/media/place-photo')) return false;

  const legacyTokens = [
    'skyline%20famous%20landmarks%20city%20travel',
    'skyline+famous+landmarks+city+travel',
    'famous%20landmarks%20city%20travel',
    'famous+landmarks+city+travel',
    'city%20landmark',
    'city+landmark',
  ];
  return legacyTokens.some((token) => value.includes(token));
}

function buildPersonalizedExpertAdvice(params: {
  destination: string;
  travelers: number;
  budget: string;
  pace: 'relaxed' | 'balanced' | 'packed';
  interests: string[];
  origin: string;
  firstWeather: { condition?: string; highTempC?: number | null; lowTempC?: number | null; humidityPct?: number | null } | null;
  notesSeed: string[];
}): string[] {
  const {
    destination,
    travelers,
    budget,
    pace,
    interests,
    origin,
    firstWeather,
    notesSeed,
  } = params;

  const destinationName = (destination || 'your destination').trim();
  const destLower = destinationName.toLowerCase();
  const tips: string[] = [];

  if (destLower.includes('tokyo') || destLower.includes('japan')) {
    tips.push('Buy timed-entry tickets for top spots in advance (teamLab, Skytree, major museums), especially for weekends.');
    tips.push('Load a Suica/PASMO card on day one to move quickly between neighborhoods and avoid queueing for individual tickets.');
  } else {
    tips.push(`Buy tickets for major attractions in ${destinationName} in advance to avoid sold-out slots and long queues.`);
  }

  tips.push(`Keep valuables in front pockets or zipped bags in busy transit hubs and tourist areas around ${destinationName}.`);

  if (pace === 'packed') {
    tips.push('Cluster activities by neighborhood each day to reduce transit time and keep your packed schedule realistic.');
  } else if (pace === 'relaxed') {
    tips.push('Leave buffer time between activities so you can explore local streets and cafes without rushing.');
  }

  if (budget === 'budget') {
    tips.push('Set a daily spending cap and use lunch specials or convenience-store meals to keep costs under control.');
  } else if (budget === 'luxury' || budget === 'premium') {
    tips.push('Reserve premium dining and signature experiences early, because high-demand slots fill fast.');
  }

  if (travelers > 1) {
    tips.push(`Book group tables and transport for ${travelers} travelers in advance to avoid split seating.`);
  }

  if (firstWeather?.condition) {
    const weatherBits: string[] = [];
    if (firstWeather.highTempC != null) weatherBits.push(`high around ${firstWeather.highTempC}C`);
    if (firstWeather.lowTempC != null) weatherBits.push(`low near ${firstWeather.lowTempC}C`);
    if (firstWeather.humidityPct != null) weatherBits.push(`humidity about ${firstWeather.humidityPct}%`);
    const weatherTail = weatherBits.length > 0 ? ` (${weatherBits.join(', ')})` : '';
    tips.push(`Pack for ${firstWeather.condition.toLowerCase()}${weatherTail} and keep a compact rain/wind layer with you.`);
  }

  if (interests.length > 0) {
    const topInterests = interests.slice(0, 2).join(' and ');
    tips.push(`Prioritize bookings that match your interests in ${topInterests} early in the trip so backup options remain available.`);
  }

  if (origin.trim()) {
    tips.push(`Check departure logistics from ${origin.trim()} at least 24 hours before flying to avoid last-minute transfer issues.`);
  }

  for (const note of notesSeed || []) {
    const normalized = normalizeAdviceLine(note);
    if (normalized) tips.push(normalized);
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const tip of tips) {
    const key = tip.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(tip);
  }
  return deduped.slice(0, 6);
}

function normalizeCat(value: string): string {
  return (value || 'other').trim().toLowerCase();
}

function labelCat(value: string): string {
  const n = normalizeCat(value);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export default function OverviewSection() {
  const {
    currentTrip,
    saveTripNotes,
    addBudgetEntry,
    deleteBudgetEntry,
    setActiveTab,
    setSelectedDay,
    setFocusFlightId,
    setFocusStayId,
  } = useTripStore();
  const [coverImageSrc, setCoverImageSrc] = useState('');
  const [flightLogoBroken, setFlightLogoBroken] = useState(false);
  const [stayThumbBroken, setStayThumbBroken] = useState(false);
  const [weatherThumbBroken, setWeatherThumbBroken] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveNotesError, setSaveNotesError] = useState('');
  const hasUserEditedNotes = useRef(false);

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [qCat, setQCat] = useState('other');
  const [qAmount, setQAmount] = useState('');
  const [qDate, setQDate] = useState('');
  const [qNote, setQNote] = useState('');
  const [qSaving, setQSaving] = useState(false);
  const [qDeletingId, setQDeletingId] = useState<string | null>(null);
  const overview = currentTrip?.overview;
  const tripId = currentTrip?.id;

  useEffect(() => {
    setNotes(overview?.notes || '');
    hasUserEditedNotes.current = false;
    setSaveNotesError('');
  }, [tripId]);

  useEffect(() => {
    if (currentTrip?.formData?.startDate) {
      setQDate(currentTrip.formData.startDate);
    }
  }, [tripId, currentTrip?.formData?.startDate]);

  useEffect(() => {
    if (!tripId || !hasUserEditedNotes.current) return;
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

  const destination = normalizeDestinationName(currentTrip.formData.destinations[0] || 'Trip');
  const dateRange = `${fmtDate(currentTrip.formData.startDate)} -> ${fmtDate(currentTrip.formData.endDate)}`;
  const travelersLabel = `${currentTrip.formData.travelers} traveler${currentTrip.formData.travelers > 1 ? 's' : ''}`;
  const tripNights = nightsBetween(currentTrip.formData.startDate, currentTrip.formData.endDate);
  const generatedTravelDescription = buildDefaultTravelDescription({
    destination,
    startDate: currentTrip.formData.startDate,
    endDate: currentTrip.formData.endDate,
    travelers: currentTrip.formData.travelers,
    budget: currentTrip.formData.budget,
    pace: currentTrip.formData.preferences.pace,
    origin: currentTrip.formData.origin || '',
  });

  const primaryFlight =
    currentTrip.flights.find((f) => f.id === currentTrip.selectedFlightId) ||
    currentTrip.flights.find((f) => f.saved) ||
    currentTrip.flights[0] ||
    null;
  const primaryStay =
    currentTrip.stays.find((s) => s.id === currentTrip.selectedStayId) ||
    currentTrip.stays.find((s) => s.saved) ||
    currentTrip.stays[0] ||
    null;
  const primaryStayPrice = (primaryStay?.priceRange || '').trim() || 'Price on request';

  const budgetSummary = currentTrip.budget?.summary;
  const budgetCurrency = budgetSummary?.currency || currentTrip.budget?.currency || 'EUR';
  const destinationHeroImage = `/api/media/overview-hero?destination=${encodeURIComponent(destination)}&w=1600&h=900`;
  const destinationPlaceImage = `/api/media/place-photo?q=${encodeURIComponent(`${destination} famous landmark`)}&w=1600&h=900&norand=1`;
  const fallbackPlaceImage = `/api/media/place-photo?q=${encodeURIComponent(destination)}&w=1600&h=900&norand=1`;
  const fallbackStaticImage = buildFallbackImage(`overview-${destination}`, 1600, 900);
  const storedCoverUrl = (overview?.destinationImageUrl || '').trim();
  const cachedHeroUrl = (overview?.cachedImageUrl || '').trim();
  const isLegacyAiCover = isLegacyAutoOverviewImage(storedCoverUrl);
  const coverImageUrl = cachedHeroUrl || (storedCoverUrl && !isLegacyAiCover ? storedCoverUrl : destinationHeroImage);
  const firstWeather = currentTrip.weather[0] || null;
  const stayThumbUrl = primaryStay?.cachedImageUrl || primaryStay?.imageUrl || buildPlaceImage(
    `${primaryStay?.name || destination} ${primaryStay?.neighborhood || ''}`.trim(),
    destination,
    240,
    180,
    `overview-stay-${currentTrip.id}-${primaryStay?.id || 'none'}`,
  );
  const stayThumbPreferredUrl = primaryStay
    ? (
      primaryStay.cachedImageUrl ||
      primaryStay.imageUrl ||
      buildStayPhotoProxyUrl({
        query: `${primaryStay.name || ''} ${destination} hotel`.trim(),
        placeId: primaryStay.placeId,
        photoReference: primaryStay.photoReference,
        photoName: primaryStay.photoName,
        width: 240,
        height: 180,
        destination,
      })
    )
    : stayThumbUrl;
  const weatherThumbUrl = buildWeatherImage(
    `${firstWeather?.condition || ''} ${firstWeather?.icon || ''}`.trim() || 'forecast',
    destination,
    320,
    180,
    `overview-weather-${currentTrip.id}-${firstWeather?.date || 'none'}`,
  );
  const expertAdvice = buildPersonalizedExpertAdvice({
    destination,
    travelers: currentTrip.formData.travelers,
    budget: currentTrip.formData.budget,
    pace: currentTrip.formData.preferences.pace,
    interests: currentTrip.formData.preferences.interests || [],
    origin: currentTrip.formData.origin || '',
    firstWeather,
    notesSeed: overview?.notesSeed || [],
  });

  useEffect(() => {
    setCoverImageSrc(coverImageUrl);
  }, [coverImageUrl]);

  useEffect(() => {
    setFlightLogoBroken(false);
    setStayThumbBroken(false);
    setWeatherThumbBroken(false);
  }, [primaryFlight?.id, primaryStay?.id, firstWeather?.date]);

  const openWeatherTab = () => {
    setFocusFlightId(null);
    setFocusStayId(null);
    setSelectedDay(null);
    setActiveTab('weather');
  };

  const openTipsTab = () => {
    setFocusFlightId(null);
    setFocusStayId(null);
    setSelectedDay(null);
    setActiveTab('tips');
  };

  const openPrimaryFlight = () => {
    setFocusStayId(null);
    if (primaryFlight?.id) {
      setFocusFlightId(primaryFlight.id);
    }
    setSelectedDay(null);
    setActiveTab('flights');
  };

  const openPrimaryStay = () => {
    setFocusFlightId(null);
    if (primaryStay?.id) {
      setFocusStayId(primaryStay.id);
    }
    setSelectedDay(null);
    setActiveTab('stays');
  };

  const travelDescriptionSummary = (overview?.travelDescription || '').trim() || generatedTravelDescription;
  const travelDescriptionLines = splitTravelDescription(travelDescriptionSummary);
  const travelDescriptionIntro = travelDescriptionLines[0] || travelDescriptionSummary;
  const budgetTierLabel = formatBudgetTier(currentTrip.formData.budget);
  const paceLabel = formatPace(currentTrip.formData.preferences.pace);
  const whatToExpect = [
    `A ${paceLabel.toLowerCase()} pace with clear day-by-day flow.`,
    primaryFlight
      ? `Flight baseline set: ${primaryFlight.departure} -> ${primaryFlight.arrival}.`
      : 'Flight options can be refined anytime in the Flights tab.',
    primaryStay
      ? `Stay anchor selected in ${primaryStay.neighborhood || destination}.`
      : 'Stay recommendations are ready for quick comparison.',
  ];

  const primaryFlightPriceDisplay = primaryFlight
    ? (() => {
      const pr = (primaryFlight.priceRange || '').trim();
      if (!pr) return '-';
      const parts = pr.split(/\s*[-\u2013\u2014−]\s*/);
      const lowest = (parts.length > 1 ? parts[0].trim() : pr).replace(/^~\s*/, '');
      return `from ${lowest}`;
    })()
    : null;

  return (
    <div className="card overview-print" style={{ padding: 24 }}>
      <div className="print-only print-doc-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--navy-900)' }}>TRIPLY</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--navy-500)' }}>AI-curated travel planner</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--navy-900)' }}>{destination}</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--navy-500)' }}>{dateRange}</p>
          </div>
        </div>
      </div>

      <div className="section-header">
        <div>
          <h2 className="section-title">Overview</h2>
          <p style={{ fontSize: 13, color: 'var(--navy-500)', marginTop: 4 }}>
            Your trip summary ready for export. Perfect for sharing with travel companions or printing as a handy reference on the go.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div className="item-card overview-print-block" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative', minHeight: 220, background: 'var(--navy-100)' }}>
            <img
              src={coverImageSrc}
              alt={`${destination} destination`}
              loading="lazy"
              style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }}
              onError={(e) => {
                const img = e.currentTarget;
                const step = img.dataset.fallbackStep || '0';
                if (step === '0') {
                  img.dataset.fallbackStep = '1';
                  setCoverImageSrc(destinationPlaceImage || fallbackPlaceImage);
                  return;
                }
                if (step === '1') {
                  img.dataset.fallbackStep = '2';
                  setCoverImageSrc(fallbackStaticImage);
                }
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0.05))',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'absolute', left: 16, bottom: 14, color: 'white' }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{destination}</p>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.95 }}>{dateRange}</p>
            </div>
          </div>
        </div>

        <div
          className="item-card overview-print-block"
          style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
        >
          <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--navy-950)' }}>{destination}</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--navy-500)' }}>
              {dateRange} - {travelersLabel}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--navy-500)' }}>
              Origin: {currentTrip.formData.origin || '-'}
            </p>

            <div className="overview-facts-grid" style={{ marginTop: 4 }}>
              <div className="overview-fact-pill">
                <span className="overview-fact-label">Trip length</span>
                <span className="overview-fact-value">{tripNights > 0 ? `${tripNights} night${tripNights === 1 ? '' : 's'}` : 'Flexible'}</span>
              </div>
              <div className="overview-fact-pill">
                <span className="overview-fact-label">Travel pace</span>
                <span className="overview-fact-value">{paceLabel}</span>
              </div>
              <div className="overview-fact-pill">
                <span className="overview-fact-label">Budget tier</span>
                <span className="overview-fact-value">{budgetTierLabel}</span>
              </div>
              <div className="overview-fact-pill">
                <span className="overview-fact-label">Travelers</span>
                <span className="overview-fact-value">{travelersLabel}</span>
              </div>
            </div>
          </div>
          <div
            className="overview-summary-panel"
          >
            <div className="overview-summary-head">
              <p className="overview-summary-title" style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--navy-900)', letterSpacing: '0.02em' }}>
                Before you go
              </p>
              <span className="overview-summary-tag">Quick brief</span>
            </div>

            <div className="overview-brief-grid">
              <section className="overview-brief-block">
                <p className="overview-brief-label">Trip brief</p>
                <p className="overview-summary-text" style={{ margin: 0, fontSize: 13, color: 'var(--navy-700)' }}>
                  {travelDescriptionIntro}
                </p>
                {travelDescriptionLines.length > 1 && (
                  <p className="overview-summary-text" style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>
                    {travelDescriptionLines.slice(1).join(' ')}
                  </p>
                )}
              </section>

              <section className="overview-brief-block">
                <p className="overview-brief-label">What to expect</p>
                <ul className="overview-brief-list">
                  {whatToExpect.map((item, idx) => (
                    <li key={`${idx}-${item}`}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>

            <p className="overview-summary-tip">
              Tip: Open Flights, Stays, or Tips to fine-tune details in under a minute.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="item-card overview-print-block"
          onClick={openPrimaryFlight}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            background: 'var(--surface)',
            border: '1.5px solid var(--navy-100)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              border: '1px solid var(--navy-100)',
              background: 'var(--surface)',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {primaryFlight && !flightLogoBroken ? (
              <img
                src={buildAirlineLogoUrl(primaryFlight.airline || '')}
                alt={`${primaryFlight.airline || 'Airline'} logo`}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                onError={() => setFlightLogoBroken(true)}
              />
            ) : (
              <Plane size={16} style={{ color: 'var(--primary-600)' }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>Primary flight</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--navy-500)' }}>
              {primaryFlight
                ? `${primaryFlight.airline} - ${primaryFlight.departure} -> ${primaryFlight.arrival} - ${primaryFlightPriceDisplay}`
                : 'No flight selected yet'}
            </p>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--navy-400)' }} />
        </button>

        <button
          type="button"
          className="item-card overview-print-block"
          onClick={openPrimaryStay}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            background: 'var(--surface)',
            border: '1.5px solid var(--navy-100)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              border: '1px solid var(--navy-100)',
              background: 'var(--surface)',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {primaryStay && !stayThumbBroken ? (
              <img
                src={stayThumbPreferredUrl}
                alt={`${primaryStay.name} preview`}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.dataset.fallback === '1') {
                    setStayThumbBroken(true);
                    return;
                  }
                  img.dataset.fallback = '1';
                  img.src = stayThumbUrl || buildFallbackImage(`overview-stay-${currentTrip.id}-${primaryStay.id}`, 240, 180);
                }}
              />
            ) : (
              <Bed size={16} style={{ color: 'var(--primary-600)' }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>Primary stay</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--navy-500)' }}>
              {primaryStay ? `${primaryStay.name} - ${primaryStayPrice}` : 'No stay selected yet'}
            </p>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--navy-400)' }} />
        </button>

        <button
          type="button"
          className="item-card overview-print-block"
          onClick={openWeatherTab}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            background: 'var(--surface)',
            border: '1.5px solid var(--navy-100)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              border: '1px solid var(--navy-100)',
              background: 'var(--surface)',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {firstWeather && !weatherThumbBroken ? (
              <img
                src={weatherThumbUrl}
                alt={`${firstWeather.condition || 'Weather'} in ${destination}`}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.dataset.fallback === '1') {
                    setWeatherThumbBroken(true);
                    return;
                  }
                  img.dataset.fallback = '1';
                  img.src = buildFallbackImage(`overview-weather-${currentTrip.id}-${firstWeather.date}`, 320, 180);
                }}
              />
            ) : (
              <CloudSun size={16} style={{ color: 'var(--warning)' }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>Weather</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--navy-500)' }}>
              {firstWeather
                ? `${firstWeather.icon ? `${firstWeather.icon} ` : ''}${firstWeather.condition || 'Forecast'} - ${firstWeather.highTempC ?? '-'} C/${firstWeather.lowTempC ?? '-'} C`
                : 'Check the weather forecast up to 7 days in advance and pack accordingly.'}
            </p>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--navy-400)' }} />
        </button>

        <button
          type="button"
          className="item-card overview-print-block"
          onClick={openTipsTab}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            background: 'var(--surface)',
            border: '1.5px solid var(--navy-100)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              border: '1px solid var(--navy-100)',
              background: 'var(--surface)',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <Lightbulb size={16} style={{ color: 'var(--warning)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>Tips</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--navy-500)' }}>
              {currentTrip.tips.length > 0
                ? `${currentTrip.tips.length} local tips available · ${currentTrip.tips[0].title}`
                : 'Destination tips are being prepared.'}
            </p>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--navy-400)' }} />
        </button>

        <div className="print-hide">
          <SidebarMap />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            type="button"
            className="item-card overview-print-block"
            onClick={() => setBudgetOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              background: 'var(--surface)',
              border: '1.5px solid var(--navy-100)',
            }}
          >
            <PiggyBank size={16} style={{ color: 'var(--success)' }} />
            <div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>Budget snapshot</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>
                {budgetSummary
                  ? `${money(budgetSummary.actualTotal, budgetCurrency)} spent`
                  : 'No spending tracked yet'}
              </p>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--navy-400)', marginLeft: 'auto' }} />
          </button>
          <button
            type="button"
            className="item-card overview-print-block"
            onClick={() => setNotesOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              background: 'var(--surface)',
              border: '1.5px solid var(--navy-100)',
            }}
          >
            <FileText size={16} style={{ color: 'var(--primary-600)' }} />
            <div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-500)' }}>Notes</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-900)' }}>
                {(overview?.notes || '').trim() ? 'View trip notes' : 'Add trip notes'}
              </p>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--navy-400)', marginLeft: 'auto' }} />
          </button>
        </div>

        {expertAdvice.length > 0 && (
          <div className="item-card overview-print-block overview-expert-card">
            <div className="overview-expert-header">
              <div className="overview-expert-title-wrap">
                <div className="overview-expert-icon">
                  <Lightbulb size={16} style={{ color: 'var(--warning-700)' }} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--navy-950)', letterSpacing: '0.01em' }}>
                    Personalized Expert Advice
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--navy-500)' }}>
                    Practical tips tuned for your route, budget, pace, and weather.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm print-hide"
                onClick={openTipsTab}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                Open tips <ArrowRight size={12} />
              </button>
            </div>

            <div className="overview-expert-grid">
              {expertAdvice.map((tip, idx) => (
                <article key={`${idx}-${tip}`} className="overview-expert-tip">
                  <span className="overview-expert-tip-index">{idx + 1}</span>
                  <p className="overview-expert-tip-text">{tip}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="print-only print-doc-footer">
          <span>Generated with Triply on {new Date().toLocaleDateString('en-US')}</span>
          <span>Page <span className="print-page-number" /></span>
        </div>
      </div>

      <AnimatePresence>
        {budgetOpen && (() => {
          const budget = currentTrip.budget;
          const currency = budget?.currency || 'EUR';
          const allCats = Array.from(new Set([
            'transport', 'accommodation', 'food', 'activities', 'shopping', 'other',
            ...(budget?.categories || []).map((c) => normalizeCat(c.category || 'other')),
          ]));
          const estimatedMap = new Map<string, number>();
          for (const c of budget?.categories || []) {
            estimatedMap.set(normalizeCat(c.category || 'other'), Number(c.estimatedAmount ?? 0));
          }
          const actualMap = new Map<string, number>();
          for (const e of budget?.entries || []) {
            const k = normalizeCat(e.category || 'other');
            actualMap.set(k, (actualMap.get(k) || 0) + Number(e.amount || 0));
          }
          const displayCats = Array.from(new Set([
            ...allCats,
            ...Array.from(actualMap.keys()),
            ...Array.from(estimatedMap.keys()),
          ]));

          return (
            <motion.div
              key="budget-popup"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="chat-panel print-hide"
              style={{ right: 'auto', left: 24, display: 'flex', flexDirection: 'column', width: 440, maxHeight: 680 }}
            >
              <div className="chat-header">
                <div className="chat-header-title">
                  <PiggyBank size={15} style={{ color: 'var(--success-600)' }} />
                  Budget
                </div>
                <button onClick={() => setBudgetOpen(false)} className="icon-btn" aria-label="Close budget">
                  <X size={16} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px' }}>
                {/* Summary strip */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Estimated', value: budget?.summary?.estimatedTotal ?? budget?.totalEstimated ?? null, color: 'var(--navy-900)' },
                    { label: 'Spent', value: budget?.summary?.actualTotal ?? 0, color: 'var(--navy-900)' },
                    { label: 'Left', value: budget?.summary?.delta ?? null, color: (budget?.summary?.delta ?? 0) >= 0 ? 'var(--success-700)' : 'var(--error)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'var(--navy-50)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--navy-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color }}>{money(value, currency)}</p>
                    </div>
                  ))}
                </div>

                {/* Per-category predictions */}
                {!budget && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--navy-400)', textAlign: 'center' }}>No AI estimate yet — you can still track spending below.</p>
                )}
                <div style={{ display: 'grid', gap: 5 }}>
                  {displayCats.map((cat) => {
                    const est = estimatedMap.get(cat) ?? 0;
                    const act = actualMap.get(cat) ?? 0;
                    const delta = est - act;
                    const hasData = est > 0 || act > 0;
                    if (!hasData) return null;
                    return (
                      <div key={cat} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center', padding: '7px 10px', borderRadius: 9, background: 'var(--navy-50)', fontSize: 13 }}>
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--navy-800)' }}>{labelCat(cat)}</p>
                        <p style={{ margin: 0, color: 'var(--navy-500)' }}>Est {money(est || null, currency)}</p>
                        <p style={{ margin: 0, color: 'var(--navy-700)', fontWeight: 600 }}>Spent {money(act || null, currency)}</p>
                        <p style={{ margin: 0, fontWeight: 700, color: delta >= 0 ? 'var(--success-600)' : 'var(--error)', minWidth: 56, textAlign: 'right' }}>
                          {est > 0 ? money(delta, currency) : '—'}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Recent entries */}
                {(budget?.entries?.length || 0) > 0 && (
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent expenses</p>
                    <div style={{ display: 'grid', gap: 3 }}>
                      {[...(budget?.entries || [])].reverse().slice(0, 8).map((entry) => (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, border: '1px solid var(--navy-100)', fontSize: 13 }}>
                          <p style={{ margin: 0, flex: 1, color: 'var(--navy-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{entry.category}</span>
                            {' · '}{money(entry.amount, entry.currency || currency)}
                            {entry.note ? ` · ${entry.note}` : ''}
                          </p>
                          <p style={{ margin: 0, color: 'var(--navy-400)', flexShrink: 0 }}>{entry.date}</p>
                          <button
                            className="icon-btn"
                            title="Delete expense"
                            disabled={qDeletingId === entry.id}
                            style={{ flexShrink: 0 }}
                            onClick={async () => {
                              setQDeletingId(entry.id);
                              try { await deleteBudgetEntry(entry.id); } finally { setQDeletingId(null); }
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick add form */}
              <div className="chat-input-bar" style={{ flexDirection: 'column', gap: 8, alignItems: 'stretch', padding: '10px 16px' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add expense</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1.2fr', gap: 6 }}>
                  <select
                    className="profile-input"
                    style={{ fontSize: 13, padding: '10px 10px', height: 42 }}
                    value={qCat}
                    onChange={(e) => setQCat(e.target.value)}
                  >
                    {allCats.map((c) => <option key={c} value={c}>{labelCat(c)}</option>)}
                  </select>
                  <input
                    className="profile-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    value={qAmount}
                    onChange={(e) => setQAmount(e.target.value)}
                    style={{ fontSize: 13, padding: '10px 10px', height: 42 }}
                  />
                  <DateRangePicker
                    mode="single"
                    allowPast
                    size="sm"
                    dropdownDirection="up"
                    dropdownAlign="right"
                    startDate={qDate}
                    onStartDateChange={setQDate}
                    placeholder="Expense date"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                  <input
                    className="profile-input"
                    placeholder="Note (optional)"
                    value={qNote}
                    onChange={(e) => setQNote(e.target.value)}
                    style={{ fontSize: 13, padding: '10px 10px', height: 42 }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const parsed = Number(qAmount);
                        if (!qDate || !parsed || parsed <= 0) return;
                        setQSaving(true);
                        try { await addBudgetEntry({ category: qCat, amount: parsed, date: qDate, note: qNote }); setQAmount(''); setQNote(''); } finally { setQSaving(false); }
                      }
                    }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={qSaving || !qAmount || Number(qAmount) <= 0 || !qDate}
                    onClick={async () => {
                      const parsed = Number(qAmount);
                      if (!qDate || !parsed || parsed <= 0) return;
                      setQSaving(true);
                      try { await addBudgetEntry({ category: qCat, amount: parsed, date: qDate, note: qNote }); setQAmount(''); setQNote(''); } finally { setQSaving(false); }
                    }}
                  >
                    <Plus size={13} /> {qSaving ? 'Saving...' : 'Add'}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {notesOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="chat-panel print-hide"
            style={{ right: 'auto', left: 24, display: 'flex', flexDirection: 'column' }}
          >
            <div className="chat-header">
              <div className="chat-header-title">
                <FileText size={15} style={{ color: 'var(--primary-500)' }} />
                Trip Notes
              </div>
              <button onClick={() => setNotesOpen(false)} className="icon-btn" aria-label="Close notes">
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              <textarea
                autoFocus
                value={notes}
                onChange={(e) => {
                  hasUserEditedNotes.current = true;
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
                    hasUserEditedNotes.current = true;
                    setSaveNotesError('');
                    requestAnimationFrame(() => {
                      const newPos = start + 1 + prefix.length;
                      ta.setSelectionRange(newPos, newPos);
                    });
                  }
                }}
                placeholder="• Write trip notes..."
                style={{
                  flex: 1,
                  width: '100%',
                  minHeight: 280,
                  resize: 'none',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: 'var(--navy-800)',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div className="chat-input-bar" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--navy-400)' }}>
                {saveNotesError
                  ? <span style={{ color: 'var(--error)' }}>{saveNotesError}</span>
                  : savingNotes ? 'Saving...' : 'Auto-saved'
                }
              </span>
              <button
                className="btn btn-primary btn-sm"
                disabled={savingNotes}
                onClick={async () => {
                  setSavingNotes(true);
                  setSaveNotesError('');
                  try {
                    await saveTripNotes(notes);
                  } catch {
                    setSaveNotesError('Could not save.');
                  } finally {
                    setSavingNotes(false);
                  }
                }}
              >
                {savingNotes ? 'Saving...' : 'Save now'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
