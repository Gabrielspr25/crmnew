import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildProspectDedupeKey,
  normalizeApifyItems,
  validateApifyPreviewCriteria,
} from '../src/services/prospectosApifyService.js';
import { createAirtableClient } from '../src/services/prospectosAirtableService.js';
import { saveSelectedApifyProspects } from '../src/services/prospectosProspectionService.js';

test('preview Apify valida criterios mínimos y normaliza sin secretos ni persistencia', () => {
  const criteria = validateApifyPreviewCriteria({
    rubro: 'farmacia',
    zona: 'San Juan',
    cantidad: 25,
    filtros: { telefono: true, website: false },
  });
  assert.deepEqual(criteria, {
    rubro: 'farmacia',
    zona: 'San Juan',
    cantidad: 25,
    filtros: { telefono: true, website: false },
  });

  const prospects = normalizeApifyItems([
    {
      placeId: 'ChIJ-123',
      title: 'Farmacia Central',
      address: 'Ave Principal 1, San Juan, PR',
      city: 'San Juan',
      phone: '(787) 555-0101',
      website: 'https://farmacia.example',
      categoryName: 'Pharmacy',
      totalScore: 4.6,
      reviewsCount: 18,
      location: { lat: 18.42, lng: -66.06 },
      url: 'https://maps.google.com/?cid=123',
    },
  ], criteria);

  assert.equal(prospects.length, 1);
  assert.equal(prospects[0].google_id, 'ChIJ-123');
  assert.equal(prospects[0].name, 'Farmacia Central');
  assert.equal(prospects[0].source, 'apify_google_maps');
  assert.equal(prospects[0].rubro, 'farmacia');
  assert.equal(prospects[0].phone, '(787) 555-0101');
  assert.equal(prospects[0].dedupe_key, 'google:ChIJ-123');
  assert.equal(prospects[0].airtable_record_id, undefined);
});

test('dedupe prefiere placeId y cae a nombre+telefono o nombre+direccion+ciudad', () => {
  assert.equal(buildProspectDedupeKey({ google_id: 'abc' }), 'google:abc');
  assert.equal(buildProspectDedupeKey({ name: ' Panaderia Sol ', phone: '787-555-0101' }), 'name_phone:panaderia sol:7875550101');
  assert.equal(
    buildProspectDedupeKey({ name: ' Panaderia Sol ', address: 'Calle 1', city: 'Ponce' }),
    'name_address_city:panaderia sol:calle 1:ponce',
  );
});

test('normalizacion respeta filtros de telefono y website antes del preview', () => {
  const criteria = validateApifyPreviewCriteria({
    rubro: 'restaurante',
    zona: 'Ponce',
    cantidad: 10,
    filtros: { telefono: true, website: true },
  });
  const prospects = normalizeApifyItems([
    { placeId: 'ok', title: 'Rest Uno', phone: '787', website: 'https://uno.test' },
    { placeId: 'sin-phone', title: 'Rest Dos', website: 'https://dos.test' },
    { placeId: 'sin-web', title: 'Rest Tres', phone: '787' },
  ], criteria);

  assert.deepEqual(prospects.map((p) => p.google_id), ['ok']);
});

test('save guarda primero en CRM y luego sincroniza Airtable con los mismos aprobados', async () => {
  const calls = [];
  const prospects = [{ google_id: 'p1', name: 'Negocio Uno', source: 'apify_google_maps' }];
  const result = await saveSelectedApifyProspects({
    prospects,
    crmRepository: {
      async upsertMany(rows) {
        calls.push(['crm', rows.map((row) => row.google_id)]);
        return { saved: [{ ...rows[0], id: 10 }], inserted: 1, updated: 0 };
      },
      async markAirtableResult(rows) {
        calls.push(['mark', rows.map((row) => row.id)]);
      },
    },
    airtableClient: {
      async syncProspects(rows) {
        calls.push(['airtable', rows.map((row) => row.google_id)]);
        return { synced: [{ id: rows[0].id, airtable_record_id: 'rec123' }], failed: [] };
      },
    },
  });

  assert.equal(result.status, 'synced');
  assert.deepEqual(calls, [
    ['crm', ['p1']],
    ['airtable', ['p1']],
    ['mark', [10]],
  ]);
  assert.equal(result.crm.saved, 1);
  assert.equal(result.airtable.synced, 1);
});

test('save no llama Airtable si CRM falla y reporta parcial si Airtable falla despues', async () => {
  await assert.rejects(
    saveSelectedApifyProspects({
      prospects: [{ google_id: 'p1', name: 'Negocio Uno', source: 'apify_google_maps' }],
      crmRepository: {
        async upsertMany() {
          throw new Error('db down');
        },
      },
      airtableClient: {
        async syncProspects() {
          throw new Error('no debe llamarse');
        },
      },
    }),
    /db down/,
  );

  let airtableCalled = false;
  const partial = await saveSelectedApifyProspects({
    prospects: [{ google_id: 'p2', name: 'Negocio Dos', source: 'apify_google_maps' }],
    crmRepository: {
      async upsertMany(rows) {
        return { saved: [{ ...rows[0], id: 20 }], inserted: 1, updated: 0 };
      },
      async markAirtableError(rows, error) {
        assert.equal(rows[0].id, 20);
        assert.match(error, /airtable down/);
      },
    },
    airtableClient: {
      async syncProspects() {
        airtableCalled = true;
        throw new Error('airtable down');
      },
    },
  });

  assert.equal(airtableCalled, true);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.crm.saved, 1);
  assert.match(partial.airtable.error, /airtable down/);
});

test('cliente Airtable consulta metadata y envia solo campos existentes', async () => {
  const requests = [];
  const client = createAirtableClient({
    apiKey: 'test-key',
    baseId: 'base123',
    tableName: 'Clientes potenciales',
    async fetchImpl(url, options = {}) {
      requests.push({ url, options });
      if (String(url).includes('/meta/bases/')) {
        return {
          ok: true,
          async json() {
            return {
              tables: [{
                name: 'Clientes potenciales',
                fields: [{ name: 'Nombre' }, { name: 'Teléfono' }, { name: 'Ciudad' }, { name: 'Origen' }],
              }],
            };
          },
        };
      }
      return {
        ok: true,
        async json() {
          return { records: [{ id: 'recA' }] };
        },
      };
    },
  });

  const result = await client.syncProspects([{ id: 33, name: 'Negocio Uno', phone: '787', city: 'Ponce', website: 'https://x.test' }]);
  const createBody = JSON.parse(requests[1].options.body);

  assert.equal(result.synced[0].airtable_record_id, 'recA');
  assert.deepEqual(createBody.records[0].fields, {
    Nombre: 'Negocio Uno',
    'Teléfono': '787',
    Ciudad: 'Ponce',
    Origen: 'apify_google_maps',
  });
  assert.equal(createBody.records[0].fields.Website, undefined);
});
