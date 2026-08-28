function cleanText(value) {
  return String(value || '').trim();
}

function airtableConfig(options = {}) {
  return {
    apiKey: options.apiKey || process.env.AIRTABLE_API_KEY,
    baseId: options.baseId || process.env.AIRTABLE_BASE_ID,
    tableName: options.tableName || process.env.AIRTABLE_TABLE_NAME,
  };
}

const FIELD_ALIASES = {
  name: ['Nombre', 'Name', 'Negocio', 'Empresa'],
  phone: ['Teléfono', 'Telefono', 'Phone', 'Teléfono principal'],
  address: ['Dirección', 'Direccion', 'Address'],
  city: ['Ciudad', 'Pueblo', 'City'],
  website: ['Website', 'Web', 'Sitio web', 'Página web', 'Pagina web'],
  rubro: ['Rubro', 'Categoría', 'Categoria', 'Industry'],
  source: ['Origen', 'Fuente', 'Source'],
  google_id: ['Google ID', 'GoogleId', 'Place ID', 'PlaceId'],
  crm_id: ['CRM Prospecto ID', 'CRMProspectoId', 'Prospecto ID'],
};

function pickField(existingFields, aliases) {
  return aliases.find((name) => existingFields.has(name)) || null;
}

function prospectValue(prospect, key) {
  if (key === 'source') return prospect.source || 'apify_google_maps';
  if (key === 'crm_id') return prospect.id ? String(prospect.id) : '';
  return prospect[key] || '';
}

function toAirtableFields(prospect, fieldMap) {
  const fields = {};
  for (const [key, airtableField] of Object.entries(fieldMap)) {
    const value = prospectValue(prospect, key);
    if (airtableField && value !== '') fields[airtableField] = value;
  }
  return fields;
}

async function loadFieldMap(fetchImpl, config) {
  const url = `https://api.airtable.com/v0/meta/bases/${encodeURIComponent(config.baseId)}/tables`;
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Airtable metadata ${response.status}: ${detail.slice(0, 180)}`);
  }

  const body = await response.json();
  const table = (Array.isArray(body.tables) ? body.tables : []).find((item) => item.name === config.tableName);
  if (!table) throw new Error(`Airtable no encontró la tabla ${config.tableName}.`);

  const existingFields = new Set((table.fields || []).map((field) => field.name));
  const map = {};
  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
    const field = pickField(existingFields, aliases);
    if (field) map[key] = field;
  }
  if (!map.name) throw new Error('Airtable no tiene un campo reconocido para el nombre del negocio.');
  return map;
}

export function createAirtableClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const config = airtableConfig(options);

  return {
    async syncProspects(prospects = []) {
      if (!prospects.length) return { synced: [], failed: [] };
      if (!config.apiKey || !config.baseId || !config.tableName) {
        const err = new Error('Airtable no configurado en backend.');
        err.statusCode = 503;
        throw err;
      }

      const fieldMap = await loadFieldMap(fetchImpl, config);
      const url = `https://api.airtable.com/v0/${encodeURIComponent(config.baseId)}/${encodeURIComponent(config.tableName)}`;
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: prospects.map((prospect) => ({ fields: toAirtableFields(prospect, fieldMap) })),
          typecast: true,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Airtable ${response.status}: ${detail.slice(0, 180)}`);
      }

      const body = await response.json();
      const records = Array.isArray(body.records) ? body.records : [];
      return {
        synced: records.map((record, index) => ({
          id: prospects[index]?.id,
          airtable_record_id: cleanText(record.id),
        })).filter((row) => row.id && row.airtable_record_id),
        failed: [],
      };
    },
  };
}
