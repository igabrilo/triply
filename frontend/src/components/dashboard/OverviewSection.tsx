import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CloudSun, FileText, PiggyBank, Plane, Bed, RotateCcw, Upload, ImagePlus, Link2 } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { buildFallbackImage, buildAirlineLogoUrl, buildPlaceImage, buildWeatherImage, buildPlacePhotoProxyUrl } from '@/utils/mediaImages';
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
    setActiveTab,
    setSelectedDay,
    setFocusFlightId,
    setFocusStayId,
  } = useTripStore();
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
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

  const destination = currentTrip.formData.destinations[0] || 'Trip';
  const dateRange = `${fmtDate(currentTrip.formData.startDate)} -> ${fmtDate(currentTrip.formData.endDate)}`;
  const travelersLabel = `${currentTrip.formData.travelers} traveler${currentTrip.formData.travelers > 1 ? 's' : ''}`;

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

  const budgetSummary = currentTrip.budget?.summary;
  const budgetCurrency = budgetSummary?.currency || currentTrip.budget?.currency || 'EUR';
  const destinationPlaceImage = buildPlacePhotoProxyUrl(destination, 1600, 900);
  const fallbackStaticImage = buildFallbackImage(`overview-${destination}`, 1600, 900);
  const storedCoverUrl = (overview?.destinationImageUrl || '').trim();
  const isLegacyAiCover = storedCoverUrl.includes('image.pollinations.ai/prompt/');
  const coverImageUrl = storedCoverUrl && !isLegacyAiCover ? storedCoverUrl : destinationPlaceImage;
  const firstWeather = currentTrip.weather[0] || null;
  const stayThumbUrl = primaryStay?.imageUrl || buildPlaceImage(
    `${primaryStay?.name || destination} ${primaryStay?.neighborhood || ''}`.trim(),
    destination,
    240,
    180,
    `overview-stay-${currentTrip.id}-${primaryStay?.id || 'none'}`,
  );
  const weatherThumbUrl = buildWeatherImage(
    `${firstWeather?.condition || ''} ${firstWeather?.icon || ''}`.trim() || 'forecast',
    destination,
    320,
    180,
    `overview-weather-${currentTrip.id}-${firstWeather?.date || 'none'}`,
  );

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
                if (img.dataset.fallback === '1') return;
                img.dataset.fallback = '1';
                setCoverImageSrc(fallbackStaticImage);
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

        <div className="item-card overview-print-block" style={{ display: 'grid', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--navy-950)' }}>{destination}</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--navy-500)' }}>
            {dateRange} - {travelersLabel}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--navy-500)' }}>
            Origin: {currentTrip.formData.origin || '-'} - Budget tier: {currentTrip.formData.budget}
          </p>
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
                src={stayThumbUrl}
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
                  img.src = buildFallbackImage(`overview-stay-${currentTrip.id}-${primaryStay.id}`, 240, 180);
                }}
              />
            ) : (
              <Bed size={16} style={{ color: 'var(--primary-600)' }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>Primary stay</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--navy-500)' }}>
              {primaryStay ? `${primaryStay.name} - ${primaryStay.priceRange}` : 'No stay selected yet'}
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

        {(overview?.summary || (overview?.notesSeed?.length ?? 0) > 0) && (
          <div className="item-card overview-print-block">
            {overview?.summary && (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--navy-700)', lineHeight: 1.6 }}>
                {overview.summary}
              </p>
            )}
            {(overview?.notesSeed?.length ?? 0) > 0 && (
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'var(--navy-600)', fontSize: 13 }}>
                {overview?.notesSeed.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
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
