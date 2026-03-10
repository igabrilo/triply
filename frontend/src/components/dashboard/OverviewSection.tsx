import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CloudSun, FileText, PiggyBank, Plane, Bed, RotateCcw, Upload, ImagePlus, Link2 } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { buildFallbackImage, buildAirlineLogoUrl, buildPlaceImage, buildWeatherImage, buildStayPhotoProxyUrl } from '@/utils/mediaImages';
import SidebarMap from '@components/dashboard/SidebarMap';

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

function toIsoDate(input?: string): string {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
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
  const nightsLabel = nights > 0 ? `${nights}-night` : 'Multi-night';
  const budgetLabelMap: Record<string, string> = {
    budget: 'budget-friendly',
    mid: 'mid-range',
    premium: 'premium',
    luxury: 'luxury',
  };
  const budgetLabel = budgetLabelMap[params.budget] || params.budget || 'balanced-budget';
  const startIso = toIsoDate(params.startDate);
  const endIso = toIsoDate(params.endDate);
  const fromLabel = (params.origin || '').trim() || 'your origin';
  const travelers = Math.max(1, Number(params.travelers) || 1);

  let description = `${nightsLabel} ${budgetLabel}, ${params.pace}-pace ${destination} trip for ${travelers} from ${fromLabel}`;
  if (startIso && endIso) {
    description += ` (${startIso} to ${endIso}).`;
  } else {
    description += '.';
  }

  if (destination.toLowerCase().includes('tokyo')) {
    description += ' Mix of classic neighborhoods (Asakusa, Shibuya, Shinjuku), low-cost food spots (depachika, ramen, conveyor sushi), one day trip option (Kamakura or Nikko), and smart transit planning with an IC card to keep costs down.';
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

async function optimizeImageFile(file: File): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file);
  try {
    const img = await loadImageFromSrc(rawDataUrl);
    const maxW = 1600;
    const maxH = 1000;
    const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.86);
  } catch {
    return rawDataUrl;
  }
}

export default function OverviewSection() {
  const {
    currentTrip,
    saveTripNotes,
    saveOverviewImage,
    saveOverviewDescription,
    setActiveTab,
    setSelectedDay,
    setFocusFlightId,
    setFocusStayId,
  } = useTripStore();
  const [notes, setNotes] = useState('');
  const [travelDescription, setTravelDescription] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingTravelDescription, setSavingTravelDescription] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [travelDescriptionError, setTravelDescriptionError] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageMenuOpen, setImageMenuOpen] = useState(false);
  const [coverImageSrc, setCoverImageSrc] = useState('');
  const [flightLogoBroken, setFlightLogoBroken] = useState(false);
  const [stayThumbBroken, setStayThumbBroken] = useState(false);
  const [weatherThumbBroken, setWeatherThumbBroken] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const overview = currentTrip?.overview;

  useEffect(() => {
    setNotes(overview?.notes || '');
  }, [overview?.notes]);

  if (!currentTrip) return null;

  const destination = normalizeDestinationName(currentTrip.formData.destinations[0] || 'Trip');
  const dateRange = `${fmtDate(currentTrip.formData.startDate)} -> ${fmtDate(currentTrip.formData.endDate)}`;
  const travelersLabel = `${currentTrip.formData.travelers} traveler${currentTrip.formData.travelers > 1 ? 's' : ''}`;
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
    const stored = (overview?.travelDescription || '').trim();
    setTravelDescription(stored || generatedTravelDescription);
  }, [overview?.travelDescription, generatedTravelDescription]);

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

  const applyOverviewImageUrl = async (url: string) => {
    const trimmed = (url || '').trim();
    if (!trimmed) return;
    setSavingImage(true);
    setImageError('');
    try {
      await saveOverviewImage(trimmed);
      setImageMenuOpen(false);
    } catch (err: any) {
      setImageError(err?.response?.data?.message || 'Could not update image URL.');
    } finally {
      setSavingImage(false);
    }
  };

  const resetOverviewImage = async () => {
    setSavingImage(true);
    setImageError('');
    try {
      await saveOverviewImage('');
      setImageMenuOpen(false);
    } catch (err: any) {
      setImageError(err?.response?.data?.message || 'Could not reset image.');
    } finally {
      setSavingImage(false);
    }
  };

  const handleUploadImage = async (file: File | undefined) => {
    if (!file) return;
    setSavingImage(true);
    setImageError('');
    try {
      const dataUrl = await optimizeImageFile(file);
      if (dataUrl.length > 1_900_000) {
        throw new Error('Image is too large. Please pick a smaller image.');
      }
      await saveOverviewImage(dataUrl);
      setImageMenuOpen(false);
    } catch (err: any) {
      setImageError(err?.response?.data?.message || err?.message || 'Could not upload image.');
    } finally {
      setSavingImage(false);
    }
  };

  const saveTravelDescription = async () => {
    setSavingTravelDescription(true);
    setTravelDescriptionError('');
    try {
      await saveOverviewDescription(travelDescription.trim());
    } catch (err: any) {
      setTravelDescriptionError(err?.response?.data?.message || 'Could not save travel description.');
    } finally {
      setSavingTravelDescription(false);
    }
  };

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
            One-page summary for planning and PDF export.
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
            <div className="print-hide" style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 4 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={savingImage}
                onClick={() => setImageMenuOpen((v) => !v)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  padding: 0,
                  background: 'rgba(15, 23, 42, 0.58)',
                  border: '1px solid rgba(255,255,255,0.45)',
                  color: '#fff',
                  backdropFilter: 'blur(2px)',
                }}
                title="Change overview image"
              >
                <ImagePlus size={16} />
              </button>

              {imageMenuOpen && (
                <div
                  className="item-card"
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 'calc(100% + 8px)',
                    minWidth: 186,
                    padding: 8,
                    display: 'grid',
                    gap: 6,
                    background: 'rgba(255,255,255,0.97)',
                  }}
                >
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={savingImage}
                    onClick={() => imageInputRef.current?.click()}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <Upload size={14} /> Upload photo
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={savingImage}
                    onClick={async () => {
                      const raw = window.prompt('Paste image URL');
                      if (!raw) return;
                      await applyOverviewImageUrl(raw);
                    }}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <Link2 size={14} /> Paste URL
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={savingImage}
                    onClick={resetOverviewImage}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <RotateCcw size={14} /> Reset image
                  </button>
                </div>
              )}

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                disabled={savingImage}
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = '';
                  await handleUploadImage(file);
                }}
              />
            </div>
          </div>
        </div>
        {imageError && (
          <p className="print-hide" style={{ margin: 0, fontSize: 12, color: 'var(--error)' }}>{imageError}</p>
        )}

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
              Origin: {currentTrip.formData.origin || '-'} - Budget tier: {currentTrip.formData.budget}
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 8,
              alignContent: 'start',
              borderLeft: '1px solid var(--navy-100)',
              paddingLeft: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--navy-900)', letterSpacing: '0.02em' }}>
              Travel Description
            </p>
            <textarea
              className="profile-input print-hide"
              value={travelDescription}
              onChange={(e) => setTravelDescription(e.target.value)}
              rows={5}
              placeholder="Write a compact trip description..."
              style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.45 }}
            />
            <div className="print-only" style={{ marginTop: 4, fontSize: 13, color: 'var(--navy-700)', whiteSpace: 'pre-wrap' }}>
              {travelDescription || generatedTravelDescription}
            </div>
            <div className="print-hide" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={savingTravelDescription}
                onClick={saveTravelDescription}
              >
                {savingTravelDescription ? 'Saving...' : 'Save travel description'}
              </button>
            </div>
            {travelDescriptionError && (
              <p className="print-hide" style={{ margin: 0, fontSize: 12, color: 'var(--error)' }}>{travelDescriptionError}</p>
            )}
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
                ? `${primaryFlight.airline} - ${primaryFlight.departure} -> ${primaryFlight.arrival} - ${primaryFlight.priceRange}`
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
                : 'Forecast is informational and read-only. Users can refresh data, not edit conditions.'}
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
            onClick={() => {
              setSelectedDay(null);
              setActiveTab('budget');
            }}
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
          </button>
          <button
            type="button"
            className="item-card overview-print-block"
            onClick={() => requestAnimationFrame(() => notesRef.current?.focus())}
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
                Central trip notes
              </p>
            </div>
          </button>
        </div>

        <div className="item-card overview-print-block" style={{ display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>Notes</p>
          <textarea
            className="profile-input print-hide"
            ref={notesRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Write trip-level notes here..."
            style={{ width: '100%', resize: 'vertical' }}
          />
          <div className="print-only" style={{ marginTop: 4, fontSize: 13, color: 'var(--navy-700)', whiteSpace: 'pre-wrap' }}>
            {notes || 'No notes added.'}
          </div>
          <div className="print-hide" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={savingNotes}
              onClick={async () => {
                setSavingNotes(true);
                try {
                  await saveTripNotes(notes);
                } finally {
                  setSavingNotes(false);
                }
              }}
            >
              {savingNotes ? 'Saving...' : 'Save notes'}
            </button>
          </div>
        </div>

        {expertAdvice.length > 0 && (
          <div className="item-card overview-print-block">
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--navy-900)', letterSpacing: '0.02em' }}>
              Personalized Expert Advice
            </p>
            {expertAdvice.length > 0 && (
              <ol style={{ margin: '10px 0 0', paddingLeft: 20, color: 'var(--navy-600)', fontSize: 13, display: 'grid', gap: 4 }}>
                {expertAdvice.map((tip, idx) => (
                  <li key={`${idx}-${tip}`}>{tip}</li>
                ))}
              </ol>
            )}
          </div>
        )}

        <div className="print-only print-doc-footer">
          <span>Generated with Triply on {new Date().toLocaleDateString('en-US')}</span>
          <span>Page <span className="print-page-number" /></span>
        </div>
      </div>
    </div>
  );
}
