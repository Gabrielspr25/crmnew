import { pool } from '../db.js';

function nullIfBlank(value) {
  const text = String(value || '').trim();
  return text || null;
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function findExisting(client, prospect) {
  if (prospect.google_id) {
    const byGoogle = await client.query(
      `SELECT id FROM public.prospectos WHERE google_id = $1 LIMIT 1`,
      [prospect.google_id],
    );
    if (byGoogle.rows[0]) return byGoogle.rows[0];
  }

  if (prospect.name && prospect.phone) {
    const byPhone = await client.query(
      `SELECT id FROM public.prospectos
       WHERE source = 'apify_google_maps'
         AND lower(name) = lower($1)
         AND regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = regexp_replace($2, '\\D', '', 'g')
       LIMIT 1`,
      [prospect.name, prospect.phone],
    );
    if (byPhone.rows[0]) return byPhone.rows[0];
  }

  if (prospect.name && prospect.address && prospect.city) {
    const byAddress = await client.query(
      `SELECT id FROM public.prospectos
       WHERE source = 'apify_google_maps'
         AND lower(name) = lower($1)
         AND lower(coalesce(address, '')) = lower($2)
         AND lower(coalesce(city, '')) = lower($3)
       LIMIT 1`,
      [prospect.name, prospect.address, prospect.city],
    );
    if (byAddress.rows[0]) return byAddress.rows[0];
  }

  return null;
}

async function upsertOne(client, prospect) {
  const existing = await findExisting(client, prospect);
  const values = [
    nullIfBlank(prospect.google_id),
    prospect.name,
    nullIfBlank(prospect.address),
    nullIfBlank(prospect.city),
    nullIfBlank(prospect.zip_code),
    nullIfBlank(prospect.phone),
    nullIfBlank(prospect.website),
    nullIfBlank(prospect.rubro),
    prospect.google_types?.length ? prospect.google_types : null,
    asNumber(prospect.rating),
    Number.isFinite(Number(prospect.user_ratings_total)) ? Number(prospect.user_ratings_total) : null,
    asNumber(prospect.latitude),
    asNumber(prospect.longitude),
    nullIfBlank(prospect.google_maps_uri),
    nullIfBlank(prospect.business_status),
    'apify_google_maps',
  ];

  if (existing) {
    const result = await client.query(
      `UPDATE public.prospectos SET
         google_id = COALESCE($1, google_id),
         name = $2,
         address = COALESCE($3, address),
         city = COALESCE($4, city),
         zip_code = COALESCE($5, zip_code),
         phone = COALESCE($6, phone),
         website = COALESCE($7, website),
         rubro = COALESCE($8, rubro),
         google_types = COALESCE($9, google_types),
         rating = COALESCE($10, rating),
         user_ratings_total = COALESCE($11, user_ratings_total),
         latitude = COALESCE($12, latitude),
         longitude = COALESCE($13, longitude),
         google_maps_uri = COALESCE($14, google_maps_uri),
         business_status = COALESCE($15, business_status),
         source = $16,
         updated_at = NOW()
       WHERE id = $17
       RETURNING *`,
      [...values, existing.id],
    );
    return { row: result.rows[0], inserted: false };
  }

  const result = await client.query(
    `INSERT INTO public.prospectos
      (google_id, name, address, city, zip_code, phone, website, rubro, google_types,
       rating, user_ratings_total, latitude, longitude, google_maps_uri, business_status, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    values,
  );
  return { row: result.rows[0], inserted: true };
}

export function createProspectosRepository(dbPool = pool) {
  return {
    async upsertMany(prospects = []) {
      const client = await dbPool.connect();
      const saved = [];
      let inserted = 0;
      try {
        await client.query('BEGIN');
        for (const prospect of prospects) {
          const result = await upsertOne(client, prospect);
          saved.push(result.row);
          if (result.inserted) inserted += 1;
        }
        await client.query('COMMIT');
        return { saved, inserted, updated: saved.length - inserted };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },

    async markAirtableResult(rows = []) {
      if (!rows.length) return;
      await dbPool.query(
        `UPDATE public.prospectos
         SET airtable_record_id = data.airtable_record_id,
             airtable_synced_at = NOW(),
             airtable_sync_error = NULL,
             updated_at = NOW()
         FROM (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id int, airtable_record_id text)) AS data
         WHERE public.prospectos.id = data.id`,
        [JSON.stringify(rows)],
      );
    },

    async markAirtableError(rows = [], error = '') {
      const ids = rows.map((row) => row.id).filter(Boolean);
      if (!ids.length) return;
      await dbPool.query(
        `UPDATE public.prospectos
         SET airtable_sync_error = $1,
             updated_at = NOW()
         WHERE id = ANY($2::int[])`,
        [String(error).slice(0, 500), ids],
      );
    },
  };
}
