import { Router } from 'express';
import { query as dbQuery } from '../db.js';
import { requireAuth } from '../auth.js';

export const placesRouter = Router();

// Principales municipios de Puerto Rico para búsqueda "Todo Puerto Rico"
const MAIN_MUNICIPALITIES = [
  'San Juan', 'Bayamón', 'Carolina', 'Ponce', 'Caguas',
  'Guaynabo', 'Mayagüez', 'Arecibo', 'Trujillo Alto', 'Toa Baja'
];

async function fetchFromGoogle(textQuery) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('La clave GOOGLE_PLACES_API_KEY no está configurada en el backend.');
  }

  const url = 'https://places.googleapis.com/v1/places:searchText';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.location,places.websiteUri,places.addressComponents'
    },
    body: JSON.stringify({
      textQuery: textQuery,
      languageCode: 'es'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Places API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.places || [];
}

// GET /api/places/search -> Buscar en Google Places
placesRouter.get('/search', requireAuth, async (req, res) => {
  const { query, location } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Falta el parámetro de búsqueda (query)' });
  }

  try {
    let places = [];

    if (location === 'All') {
      // Búsqueda cruzada: Búsqueda general + búsquedas en municipios clave para máxima cobertura
      const searchPromises = [
        fetchFromGoogle(`${query} en Puerto Rico`),
        ...MAIN_MUNICIPALITIES.slice(0, 5).map(mun => fetchFromGoogle(`${query} en ${mun}, Puerto Rico`))
      ];

      const resultsArray = await Promise.allSettled(searchPromises);
      const allResults = [];

      for (const result of resultsArray) {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
        } else {
          console.error('Error en búsqueda de municipio individual:', result.reason);
        }
      }

      // Deduplicar por ID único de Place
      const seenIds = new Set();
      places = allResults.filter(place => {
        if (seenIds.has(place.id)) return false;
        seenIds.add(place.id);
        return true;
      });
    } else {
      // Búsqueda en un municipio específico
      const locText = location ? `${location}, Puerto Rico` : 'Puerto Rico';
      places = await fetchFromGoogle(`${query} en ${locText}`);
    }

    // Formatear respuesta para el frontend del CRM
    const formatted = places.map(p => {
      // Extraer la ciudad de los componentes de dirección
      let city = '';
      if (p.addressComponents) {
        const locality = p.addressComponents.find(c => c.types.includes('locality'));
        const sublocality = p.addressComponents.find(c => c.types.includes('sublocality') || c.types.includes('administrative_area_level_2'));
        city = (locality || sublocality || {}).longText || '';
      }

      return {
        google_id: p.id,
        name: p.displayName?.text || 'Sin Nombre',
        address: p.formattedAddress || 'Sin Dirección',
        phone: p.nationalPhoneNumber || '',
        website: p.websiteUri || '',
        city: city || location || 'Puerto Rico',
        latitude: p.location?.latitude || null,
        longitude: p.location?.longitude || null
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error al realizar búsqueda en Google Places:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/places/import -> Guardar los negocios seleccionados en PostgreSQL
placesRouter.post('/import', requireAuth, async (req, res) => {
  const { clients } = req.body || {};
  if (!Array.isArray(clients) || clients.length === 0) {
    return res.status(400).json({ error: 'Falta la lista de clientes a importar' });
  }

  const salesperson = req.user?.nombre || req.user?.nick || 'Sistema';

  try {
    const imported = [];
    const skipped = [];

    for (const c of clients) {
      if (!c.name) continue;

      // Verificar duplicados para no corromper la BD
      const exists = await dbQuery('SELECT id FROM clients WHERE name = $1', [c.name]);
      if (exists.rows.length > 0) {
        skipped.push({ name: c.name, reason: 'Ya existe' });
        continue;
      }

      // En el campo 'contact_person' guardamos la URL web del negocio
      // Los campos de lat/long se adjuntan al final del campo de dirección para no modificar la estructura de la base de datos
      const addressString = c.latitude && c.longitude
        ? `${c.address} (Coordenadas: ${c.latitude}, ${c.longitude})`
        : c.address;

      const r = await dbQuery(
        `INSERT INTO clients (name, address, phone, city, salesperson, contact_person)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [c.name, addressString || '', c.phone || '', c.city || '', salesperson, c.website || '']
      );

      if (r.rows[0]) {
        imported.push(r.rows[0]);
      }
    }

    res.status(201).json({
      message: `Proceso completado: se importaron ${imported.length} clientes.`,
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skipped
    });
  } catch (error) {
    console.error('Error al importar negocios al CRM:', error);
    res.status(500).json({ error: error.message });
  }
});
