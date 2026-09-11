import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const loaderSource = await readFile(new URL('../../Planes para web/constructor-publications.js', import.meta.url), 'utf8');
const logicSource = await readFile(new URL('../../Planes para web/ofertas-logic.js', import.meta.url), 'utf8');

function loaderContext(fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) })) {
  const window = {};
  const context = vm.createContext({ window, fetch: fetchImpl, Error, Object, Array, Map, Number, String, Promise });
  vm.runInContext(loaderSource, context);
  return window.ConstructorPublications;
}

test('normaliza el catalogo movil publicado sin inventar precios de linea', () => {
  const loader = loaderContext();
  const catalog = loader.mobileCatalog([
    {
      seccion_key: 'movil_planes_individuales',
      contenido: { filas: [{ codigo: 'IND35', descripcion: 'Individual 35', precio_regular: 35, renta_autopay: 30 }] },
    },
    {
      seccion_key: 'movil_multilinea_business_red',
      contenido: { filas: [
        { familia: 'Business Red Sin Fronteras', cantidad_lineas: 1, precio_regular: 100 },
        { familia: 'Business Red Sin Fronteras', cantidad_lineas: 2, precio_regular: 80 },
        { familia: 'Business Red Sin Fronteras', cantidad_lineas: 4, precio_regular: 35 },
      ] },
    },
  ]);

  assert.equal(catalog.individual[0].regular, 35);
  assert.equal(catalog.multiline[0].key, 'sinfronteras');
  assert.equal(catalog.multiline[0].lineCosts.length, 4);
  assert.equal(catalog.multiline[0].lineCosts[0], 100);
  assert.equal(catalog.multiline[0].lineCosts[1], 80);
  assert.equal(catalog.multiline[0].lineCosts[2], undefined);
  assert.equal(catalog.multiline[0].lineCosts[3], 35);
});

test('catalogo Business RED Plus calcula acumulados oficiales y no multiplica primera linea', () => {
  const loader = loaderContext();
  const catalog = loader.mobileCatalog([
    {
      seccion_key: 'movil_multilinea_business_red',
      contenido: {
        autopay_descuento: 10,
        filas: [
          { familia: 'Business Red Plus', cantidad_lineas: 1, codigo: 'BREDP1', precio_regular: 65 },
          { familia: 'Business Red Plus', cantidad_lineas: 2, codigo: 'BREDP2', precio_regular: 45 },
          { familia: 'Business Red Plus', cantidad_lineas: 3, codigo: 'BREDP3', precio_regular: 20 },
          { familia: 'Business Red Plus', cantidad_lineas: 4, codigo: 'BREDP4', precio_regular: 30 },
          { familia: 'Business Red Plus', cantidad_lineas: 5, codigo: 'BREDP5', precio_regular: 15 },
          { familia: 'Business Red Plus', cantidad_lineas: 6, codigo: 'BREDP6', precio_regular: 35 },
          { familia: 'Business Red Plus', cantidad_lineas: 7, codigo: 'BREDP7', precio_regular: 35 },
          { familia: 'Business Red Plus', cantidad_lineas: 8, codigo: 'BREDP8', precio_regular: 35 },
          { familia: 'Business Red Plus', cantidad_lineas: 9, codigo: 'BREDP9', precio_regular: 35 },
          { familia: 'Business Red Plus', cantidad_lineas: 10, codigo: 'BREDP10', precio_regular: 35 },
        ],
      },
    },
  ]);
  const plus = catalog.multiline.find(plan => plan.key === 'plus');
  const expectedRegularTotals = [65, 110, 130, 160, 175, 210, 245, 280, 315, 350];
  const expectedAutoPayTotals = [55, 90, 100, 120, 125, 150, 175, 200, 225, 250];

  assert.ok(plus);
  expectedRegularTotals.forEach((total, index) => {
    assert.equal(plus.lineTotals[index], total, `regular ${index + 1} lineas`);
    if (index > 0) assert.notEqual(plus.lineTotals[index], (index + 1) * plus.lineCosts[0], `no multiplicar BREDP1 para ${index + 1}`);
  });
  expectedAutoPayTotals.forEach((total, index) => {
    assert.equal(plus.autoPayTotals[index], total, `autopay ${index + 1} lineas`);
  });
  assert.deepEqual(JSON.parse(JSON.stringify(plus.lineCodes)), ['BREDP1', 'BREDP2', 'BREDP3', 'BREDP4', 'BREDP5', 'BREDP6', 'BREDP7', 'BREDP8', 'BREDP9', 'BREDP10']);
});

test('rechaza modulos sin metadata de publicacion vigente', async () => {
  const payloads = {
    '/api/ofertas-movil/vigente': { version: { datos: [{ id: 'oferta-1' }] } },
    '/api/planes-modulos/moviles': { modulos: [{ seccion_key: 'movil_planes_individuales', contenido: { filas: [{ precio_regular: 35 }] } }] },
    '/api/planes-modulos/fijos': { modulos: [] },
    '/api/planes-modulos/claro_tv': { modulos: [] },
    '/api/equipos-lista': { ok: true, total: 1, data: [{ modelo: 'Equipo Uno', precio_regular: '199.99', activo: true }] },
  };
  const loader = loaderContext(async endpoint => ({ ok: true, status: 200, json: async () => payloads[endpoint] }));
  const result = await loader.load();

  assert.equal(result.mobileCatalog.individual.length, 0);
  assert.equal(result.ready, false);
});

test('valida equipos de ofertas contra la Lista de Precios publicada', async () => {
  const payloads = {
    '/api/ofertas-movil/vigente': { version: { datos: [{ id: 'oferta-1', equipos: [{ marca: 'Apple', modelo: 'iPhone 17 256GB', precio: 999.99 }] }] } },
    '/api/planes-modulos/moviles': {
      publicacion: { numero: '1' },
      modulos: [{ seccion_key: 'movil_planes_individuales', contenido: { filas: [{ codigo: 'IND35', descripcion: 'Individual', precio_regular: 35 }] } }],
    },
    '/api/planes-modulos/fijos': { publicacion: { numero: '1' }, modulos: [{ seccion_key: 'fijo', titulo: 'Fijo', contenido: { filas: [] } }] },
    '/api/planes-modulos/claro_tv': { publicacion: { numero: '1' }, modulos: [{ seccion_key: 'tv', titulo: 'TV', contenido: { filas: [] } }] },
    '/api/equipos-lista': { ok: true, total: 1, data: [{ item_code: 'IP17', marca: 'apple', modelo: 'IPH 17 256GB BLACK', categoria: 'celular', precio_regular: '999.99', activo: true }] },
  };
  const loader = loaderContext(async endpoint => ({ ok: true, status: 200, json: async () => payloads[endpoint] }));
  const result = await loader.load();

  assert.equal(result.offers[0].equipos[0].precio, 999.99);
  assert.equal(result.offers[0].equipos[0].itemCode, 'IP17');
  assert.equal(result.ready, true);
});

test('motor equipara nombres oficiales de eventos y familias con la interfaz', () => {
  const window = {
    OFERTAS_DATA: [{
      id: 'sin-fronteras-porta',
      tipo: 'multilinea',
      beneficio: 'credito',
      eventos: ['linea_nueva'],
      familias: ['sin_fronteras'],
      equipos: [],
      planMin: 0,
      planMaxEnforced: false,
    }],
    CONSTRUCTOR_PLAN_AMOUNTS: { sinfronteras: 100 },
    CONSTRUCTOR_PLAN_LABELS: { sinfronteras: 'Business Red Sin Fronteras' },
  };
  const context = vm.createContext({ window, console, Number, String, Array, Object, Math });
  vm.runInContext(logicSource, context);

  const matches = window.OfertasLogic.getOfertasAplicables({
    tipo: 'multilinea',
    planMulti: 'sinfronteras',
    beneficio: 'todos',
    lineEvent: 'nueva',
  });
  assert.equal(matches.length, 1);
});
