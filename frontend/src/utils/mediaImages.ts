function seed(value: string): string {
  const normalized = (value || 'triply').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return normalized.slice(0, 60) || 'triply';
}

export function buildAiImage(prompt: string, width: number, height: number, imageSeed?: string): string {
  const safePrompt = encodeURIComponent(prompt || 'travel destination photo');
  const safeSeed = encodeURIComponent(seed(imageSeed || prompt || 'triply'));
  return `https://image.pollinations.ai/prompt/${safePrompt}?width=${width}&height=${height}&seed=${safeSeed}`;
}

export function buildFallbackImage(fallbackSeed: string, width: number, height: number): string {
  const safeSeed = encodeURIComponent(seed(fallbackSeed || 'triply'));
  const safeWidth = Math.max(120, Math.min(Math.round(width || 640), 1600));
  const safeHeight = Math.max(120, Math.min(Math.round(height || 360), 1600));
  return `https://picsum.photos/seed/${safeSeed}/${safeWidth}/${safeHeight}`;
}

export function buildMapsSearchUrl(query: string): string {
  const safe = encodeURIComponent((query || '').trim());
  return `https://www.google.com/maps/search/?api=1&query=${safe}`;
}

export function buildPlacePhotoProxyUrl(query: string, width = 640, height?: number, destination?: string): string {
  const safeQuery = encodeURIComponent((query || '').trim());
  const clampedWidth = Math.max(120, Math.min(Math.round(width || 640), 1600));
  const heightPart = height ? `&h=${Math.max(120, Math.min(Math.round(height), 1600))}` : '';
  const dest = (destination || '').trim();
  const destPart = dest ? `&destination=${encodeURIComponent(dest)}` : '';
  return `/api/media/place-photo?q=${safeQuery}&w=${clampedWidth}${heightPart}${destPart}`;
}

export function buildStayPhotoProxyUrl(params: {
  query?: string;
  placeId?: string;
  photoReference?: string;
  photoName?: string;
  width?: number;
  height?: number;
  destination?: string;
}): string {
  const clampedWidth = Math.max(120, Math.min(Math.round(params.width || 640), 1600));
  const search = new URLSearchParams();
  search.set('w', String(clampedWidth));
  if (params.height) {
    search.set('h', String(Math.max(120, Math.min(Math.round(params.height), 1600))));
  }
  if (params.placeId) search.set('pid', params.placeId);
  if (params.photoReference) search.set('pref', params.photoReference);
  if (params.photoName) search.set('pname', params.photoName);
  if (params.query) search.set('q', params.query);
  const dest = (params.destination || '').trim();
  if (dest) search.set('destination', dest);
  return `/api/media/place-photo?${search.toString()}`;
}

export function buildPlaceImage(place: string, destination: string, width: number, height: number, _imageSeed: string): string {
  const p = (place || '').trim();
  const d = (destination || '').trim();
  const query = p || d;
  return buildPlacePhotoProxyUrl(query, width, height, d);
}

export function buildActivityImage(
  title: string,
  destination: string,
  _category: string,
  width: number,
  height: number,
  _imageSeed: string,
): string {
  const t = (title || '').trim();
  const d = (destination || '').trim();
  const query = t || d;
  return buildPlacePhotoProxyUrl(query, width, height, d);
}

export function buildWeatherImage(
  condition: string,
  destination: string,
  width: number,
  height: number,
  imageSeed: string,
): string {
  const weatherCondition = (condition || 'current weather').trim();
  const prompt = `${destination} weather scene, ${weatherCondition}, realistic sky and atmosphere, travel photography`;
  return buildAiImage(prompt, width, height, imageSeed);
}

const airlineDomains: Record<string, string> = {
  'air canada': 'aircanada.com',
  'air france': 'airfrance.com',
  'air serbia': 'airserbia.com',
  'american airlines': 'aa.com',
  'austrian airlines': 'austrian.com',
  'british airways': 'britishairways.com',
  'croatia airlines': 'croatiaairlines.com',
  'delta': 'delta.com',
  'easyjet': 'easyjet.com',
  'emirates': 'emirates.com',
  'etihad': 'etihad.com',
  'eurowings': 'eurowings.com',
  'flydubai': 'flydubai.com',
  'iberia': 'iberia.com',
  'klm': 'klm.com',
  'lot': 'lot.com',
  'lufthansa': 'lufthansa.com',
  'norwegian': 'norwegian.com',
  'qantas': 'qantas.com',
  'qatar airways': 'qatarairways.com',
  'ryanair': 'ryanair.com',
  'sas': 'flysas.com',
  'singapore airlines': 'singaporeair.com',
  'swiss': 'swiss.com',
  'turkish airlines': 'turkishairlines.com',
  'united': 'united.com',
  'vueling': 'vueling.com',
  'wizz': 'wizzair.com',
};

const airlineIataByName: Record<string, string> = {
  'air canada': 'AC',
  'air france': 'AF',
  'air serbia': 'JU',
  'american airlines': 'AA',
  'austrian airlines': 'OS',
  'british airways': 'BA',
  'croatia airlines': 'OU',
  'delta': 'DL',
  'easyjet': 'U2',
  'emirates': 'EK',
  'etihad': 'EY',
  'eurowings': 'EW',
  'flydubai': 'FZ',
  'iberia': 'IB',
  'klm': 'KL',
  'lot': 'LO',
  'lufthansa': 'LH',
  'norwegian': 'DY',
  'qantas': 'QF',
  'qatar airways': 'QR',
  'ryanair': 'FR',
  'sas': 'SK',
  'singapore airlines': 'SQ',
  'swiss': 'LX',
  'turkish airlines': 'TK',
  'united': 'UA',
  'vueling': 'VY',
  'wizz': 'W6',
};

export function buildAirlineLogoUrl(airline: string): string {
  const raw = (airline || '').toLowerCase().trim();
  const directCode = (airline || '').trim().toUpperCase();
  if (/^[A-Z0-9]{2}$/.test(directCode)) {
    return `https://images.kiwi.com/airlines/64/${directCode}.png`;
  }

  const iataKey = Object.keys(airlineIataByName).find((key) => raw.includes(key));
  if (iataKey) {
    const code = airlineIataByName[iataKey];
    return `https://images.kiwi.com/airlines/64/${code}.png`;
  }

  const knownDomainKey = Object.keys(airlineDomains).find((key) => raw.includes(key));
  const domain = knownDomainKey ? airlineDomains[knownDomainKey] : '';
  if (domain) {
    return `https://logo.clearbit.com/${domain}`;
  }

  const fallbackDomain = raw.split(' ').filter(Boolean).join('') || 'airline';
  return `https://logo.clearbit.com/${fallbackDomain}.com`;
}
