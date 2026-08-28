import { buildProspectDedupeKey } from './prospectosApifyService.js';

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function sanitizeSelectedProspects(prospects = []) {
  return asArray(prospects).map((prospect) => {
    const row = {
      google_id: cleanText(prospect.google_id),
      name: cleanText(prospect.name),
      address: cleanText(prospect.address),
      city: cleanText(prospect.city),
      zip_code: cleanText(prospect.zip_code),
      phone: cleanText(prospect.phone),
      website: cleanText(prospect.website),
      rubro: cleanText(prospect.rubro),
      google_types: asArray(prospect.google_types).map(cleanText).filter(Boolean),
      rating: prospect.rating ?? null,
      user_ratings_total: prospect.user_ratings_total ?? null,
      latitude: prospect.latitude ?? null,
      longitude: prospect.longitude ?? null,
      google_maps_uri: cleanText(prospect.google_maps_uri),
      business_status: cleanText(prospect.business_status),
      source: 'apify_google_maps',
    };
    return { ...row, dedupe_key: buildProspectDedupeKey(row) };
  }).filter((row) => row.name && row.dedupe_key);
}

export async function saveSelectedApifyProspects({ prospects, crmRepository, airtableClient }) {
  const selected = sanitizeSelectedProspects(prospects);
  if (!selected.length) {
    const err = new Error('Selecciona al menos un prospecto válido.');
    err.statusCode = 400;
    throw err;
  }

  const crm = await crmRepository.upsertMany(selected);
  const saved = asArray(crm.saved);
  if (!saved.length) {
    return { status: 'crm_saved', crm: { saved: 0, inserted: 0, updated: 0 }, airtable: { synced: 0 } };
  }

  try {
    const airtable = await airtableClient.syncProspects(saved);
    if (crmRepository.markAirtableResult) {
      await crmRepository.markAirtableResult(asArray(airtable.synced));
    }
    return {
      status: 'synced',
      crm: { saved: saved.length, inserted: crm.inserted || 0, updated: crm.updated || 0 },
      airtable: { synced: asArray(airtable.synced).length, failed: asArray(airtable.failed).length },
    };
  } catch (error) {
    if (crmRepository.markAirtableError) {
      await crmRepository.markAirtableError(saved, error.message);
    }
    return {
      status: 'partial',
      crm: { saved: saved.length, inserted: crm.inserted || 0, updated: crm.updated || 0 },
      airtable: { synced: 0, error: error.message },
    };
  }
}

