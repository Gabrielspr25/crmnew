const APIFY_API_BASE = 'https://api.apify.com/v2';
const DEFAULT_ACTOR_ID = 'nwua9Gu5YrADL7ZDj';

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function digitsOnly(value) {
  return cleanText(value).replace(/\D+/g, '');
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function validateApifyPreviewCriteria(input = {}) {
  const rubro = cleanText(input.rubro);
  const zona = cleanText(input.zona);
  const cantidad = Math.min(Math.max(Number(input.cantidad) || 20, 1), 200);
  const filtros = {
    telefono: Boolean(input.filtros?.telefono),
    website: Boolean(input.filtros?.website),
  };

  if (rubro.length < 2) {
    const err = new Error('Indica un rubro válido para buscar.');
    err.statusCode = 400;
    throw err;
  }
  if (zona.length < 2) {
    const err = new Error('Indica una zona o municipio válido.');
    err.statusCode = 400;
    throw err;
  }

  return { rubro, zona, cantidad, filtros };
}

export function buildProspectDedupeKey(prospect = {}) {
  const googleId = cleanText(prospect.google_id || prospect.placeId || prospect.place_id);
  if (googleId) return `google:${googleId}`;

  const name = cleanText(prospect.name).toLowerCase();
  const phone = digitsOnly(prospect.phone || prospect.mobile || prospect.additional_phone);
  if (name && phone) return `name_phone:${name}:${phone}`;

  const address = cleanText(prospect.address).toLowerCase();
  const city = cleanText(prospect.city).toLowerCase();
  if (name && address && city) return `name_address_city:${name}:${address}:${city}`;

  return '';
}

function readFirst(item, keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null && cleanText(item[key])) return item[key];
  }
  return null;
}

function readLat(item) {
  return item.location?.lat ?? item.location?.latitude ?? item.lat ?? item.latitude;
}

function readLng(item) {
  return item.location?.lng ?? item.location?.lon ?? item.location?.longitude ?? item.lng ?? item.longitude;
}

export function normalizeApifyItems(items = [], criteria = {}) {
  const seen = new Set();
  const normalized = [];

  for (const item of Array.isArray(items) ? items : []) {
    const name = cleanText(readFirst(item, ['title', 'name', 'businessName']));
    if (!name) continue;

    const prospect = {
      google_id: cleanText(readFirst(item, ['placeId', 'place_id', 'googlePlaceId', 'cid'])),
      name,
      address: cleanText(readFirst(item, ['address', 'street', 'fullAddress'])),
      city: cleanText(readFirst(item, ['city', 'municipality'])),
      zip_code: cleanText(readFirst(item, ['postalCode', 'zip', 'zip_code'])),
      phone: cleanText(readFirst(item, ['phone', 'phoneNumber', 'contactPhone'])),
      website: cleanText(readFirst(item, ['website', 'urlWebsite'])),
      rubro: cleanText(criteria.rubro || readFirst(item, ['categoryName', 'category'])),
      google_types: [readFirst(item, ['categoryName', 'category'])].filter(Boolean).map(cleanText),
      rating: numberOrNull(readFirst(item, ['totalScore', 'rating', 'stars'])),
      user_ratings_total: numberOrNull(readFirst(item, ['reviewsCount', 'reviews', 'userRatingsTotal'])),
      latitude: numberOrNull(readLat(item)),
      longitude: numberOrNull(readLng(item)),
      google_maps_uri: cleanText(readFirst(item, ['url', 'googleUrl', 'mapsUrl'])),
      business_status: cleanText(readFirst(item, ['temporarilyClosed', 'permanentlyClosed'])) || null,
      source: 'apify_google_maps',
    };

    if (criteria.filtros?.telefono && !prospect.phone) continue;
    if (criteria.filtros?.website && !prospect.website) continue;

    const dedupeKey = buildProspectDedupeKey(prospect);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalized.push({ ...prospect, dedupe_key: dedupeKey });
  }

  return normalized;
}

export function buildApifyGoogleMapsInput(criteria) {
  const searchString = `${criteria.rubro} en ${criteria.zona}, Puerto Rico`;
  return {
    searchStringsArray: [searchString],
    maxCrawledPlacesPerSearch: criteria.cantidad,
    language: 'es',
    countryCode: 'pr',
    scrapePlaceDetailPage: true,
    skipClosedPlaces: true,
    includeWebResults: criteria.filtros.website,
  };
}

export async function fetchApifyPreview(criteriaInput, options = {}) {
  const criteria = validateApifyPreviewCriteria(criteriaInput);
  const token = options.token || process.env.APIFY_API_TOKEN;
  const actorId = options.actorId || process.env.APIFY_GOOGLE_MAPS_ACTOR_ID || DEFAULT_ACTOR_ID;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (!token) {
    const err = new Error('APIFY_API_TOKEN no configurado en backend.');
    err.statusCode = 503;
    throw err;
  }
  if (!actorId) {
    const err = new Error('APIFY_GOOGLE_MAPS_ACTOR_ID no configurado en backend.');
    err.statusCode = 503;
    throw err;
  }

  const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&clean=true&format=json`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildApifyGoogleMapsInput(criteria)),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Apify ${response.status}: ${detail.slice(0, 180)}`);
  }
  const rawItems = await response.json();
  return {
    criteria,
    total_raw: Array.isArray(rawItems) ? rawItems.length : 0,
    data: normalizeApifyItems(rawItems, criteria),
  };
}
