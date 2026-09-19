import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildBasesInformativasPreviews } from '../src/services/basesInformativasPreview.js';
import { createPreviewBaseHandler, createGuardarBaseBorradoresHandler } from '../src/routes/fuentesComercialesRoutes.js';

const fuente = {
  id: '11111111-1111-4111-8111-111111111111',
  familia: 'fijos',
  documento_tipo: 'pdf',
  nombre_original: 'LISTADO-260330.pdf',
  ruta_relativa: 'LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf',
  sha256: 'a'.repeat(64),
  fecha_actualizacion_base: '2026-03-30',
};
const uploadDir = fileURLToPath(new URL('../../Planes para web/Estructura de planes/planes/', import.meta.url));

// Synthetic rows exercise the existing counts without changing commercial fixtures.
function parsedFixture() {
  const sections = {
    fijo_telefonia: 40,
    fijo_internet_2play: 25,
    fijo_valores_agregados_vendibles: 16,
    fijo_equipos_accesorios_internet: 1,
    claro_tv_planes: 6,
    claro_tv_servicios_complementos: 3,
  };
  const modulos = Object.fromEntries(Object.entries(sections).map(([categoria, count]) => [categoria, {
    filas: Array.from({ length: count }, (_, i) => ({
      categoria, codigo: `${categoria}-${i}`, descripcion: `Example ${i}`, precio: 10,
      pagina: 1, tecnologia: 'COBRE/VRAD', llave_normalizada: `${categoria}|${i}`,
    })),
  }]));
  Object.assign(modulos.fijo_internet_2play.filas[0], { codigo: 'A878', descripcion: 'BUS PRUS ILIM + 100M/15M' });
  Object.assign(modulos.fijo_internet_2play.filas[1], { codigo: 'A878', descripcion: 'BUS PRUS ILIM + 100M/15M (2L) BUNDLE' });
  for (const i of [0, 1]) Object.assign(modulos.fijo_valores_agregados_vendibles.filas[i], {
    codigo: '1186', descripcion: 'PLAN MUNDIAL', precio: 0,
    tecnologia: i ? 'COBRE/VRAD/GPON' : 'COBRE/VRAD',
  });
  return { modulos, registros_normalizados_total: 91, auditoria_original: { total_filas: 91, duplicados_exactos_total: 0 } };
}

function publishedFixture(parsed = parsedFixture()) {
  return ['fijo', 'claro_tv'].map((categoria) => ({
    categoria, fuente_sha256: 'b'.repeat(64), fuente_nombre: 'missing-original.pdf',
    modulos_generados: Object.entries(parsed.modulos)
      .filter(([key]) => key.startsWith(categoria === 'fijo' ? 'fijo_' : 'claro_tv_'))
      .map(([seccion_key, contenido]) => ({
        pagina: categoria === 'fijo' ? 'fijos' : 'claro_tv', seccion_key,
        contenido: structuredClone(contenido),
      })),
  }));
}

function previewFrom(previous, parsed = parsedFixture()) {
  return buildBasesInformativasPreviews({
    parsed, fuente, publicacionesAnteriores: Object.fromEntries(previous.map((p) => [p.categoria, p])),
  });
}

function fingerprintFixture() {
  return previewFrom([]).previews.map((p) => ({
    id: fuente.id, numero: 1, categoria: p.categoria, modulos_generados: p.modulos_generados,
  }));
}

function extraModule() {
  return { pagina: 'claro_tv', seccion_key: 'claro_tv_equipos', contenido: { filas: [
    { categoria: 'claro_tv_equipos', codigo: 'STB', descripcion: 'Con contrato', precio: 40, llave_normalizada: 'stb-1' },
    { categoria: 'claro_tv_equipos', codigo: 'STB', descripcion: 'Sin contrato', precio: 45, llave_normalizada: 'stb-2' },
  ] } };
}

async function invoke(handlerFactory, previous, options = {}) {
  const queries = [];
  const parserCalls = [];
  const pool = { async query(sql, params) {
    queries.push({ sql, params });
    if (/FROM public\.fuentes_comerciales/.test(sql)) return { rows: [options.fuente || fuente] };
    if (/SELECT DISTINCT ON \(categoria\)/.test(sql)) return { rows: previous };
    throw new Error('Unexpected write or query');
  }, async connect() {
    assert.equal(options.allowInsert, true);
    return {
      async query(sql, params) {
        queries.push({ sql, params });
        if (/^(BEGIN|COMMIT|ROLLBACK)\b/.test(sql) || /pg_advisory_xact_lock/.test(sql)) return { rows: [] };
        if (/^SELECT/.test(sql) && /auditoria->>'preview_fingerprint'/.test(sql)) return { rows: [] };
        if (/INSERT INTO public\.bases_informativas_publicaciones/.test(sql)) {
          return { rows: [{ id: fuente.id, categoria: params[0], estado: 'borrador' }] };
        }
        throw new Error('Unexpected transactional query');
      },
      release() {},
    };
  } };
  const handler = handlerFactory({ pool, uploadDir: options.uploadDir || uploadDir, logger: { error() {} }, runParser: async (...args) => {
    parserCalls.push(args);
    options.duringParse?.();
    return options.parsed || parsedFixture();
  } });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; } };
  await handler({ params: { id: fuente.id }, body: options.body || {}, user: { nick: 'test' } }, res);
  return { ...res, queries, parserCalls };
}

test('preview returns a stable fingerprint independent of JSON object key order', async () => {
  const previous = fingerprintFixture();
  const first = await invoke(createPreviewBaseHandler, previous);
  assert.match(first.payload.preview_fingerprint, /^[0-9a-f]{64}$/);
  const reverseKeys = (value) => Array.isArray(value) ? value.map(reverseKeys)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)])) : value;
  const second = await invoke(createPreviewBaseHandler, reverseKeys(previous));
  assert.equal(second.payload.preview_fingerprint, first.payload.preview_fingerprint);
});

for (const [name, change] of [
  ['published snapshot', (p, options) => { p[0].modulos_generados[0].contenido.filas[0].precio = 99; }],
  ['published version with identical content', (p) => { p[0].id = '22222222-2222-4222-8222-222222222222'; }],
  ['analyzed candidates', (p, options) => { options.parsed = parsedFixture(); options.parsed.modulos.fijo_telefonia.filas[0].precio = 77; }],
  ['source validity', (p, options) => { options.fuente = { ...fuente, vigencia_hasta: '2026-12-31' }; }],
]) {
  test(`saving rejects changed ${name} before any insert`, async () => {
    const previous = fingerprintFixture();
    const shown = await invoke(createPreviewBaseHandler, previous);
    const options = { allowInsert: true, body: { preview_fingerprint: shown.payload.preview_fingerprint || '0'.repeat(64) } };
    change(previous, options);
    const saved = await invoke(createGuardarBaseBorradoresHandler, previous, options);
    assert.equal(saved.statusCode, 409);
    assert.equal(saved.payload.codigo, 'preview_desactualizado');
    assert.ok(saved.queries.every(({ sql }) => !/\bINSERT\b|\bUPDATE\b|\bDELETE\b/.test(sql)));
  });
}

test('matching fingerprint saves the reviewed result using only the injected database double', async () => {
  const previous = fingerprintFixture();
  const shown = await invoke(createPreviewBaseHandler, previous);
  assert.match(shown.payload.preview_fingerprint, /^[0-9a-f]{64}$/);
  const saved = await invoke(createGuardarBaseBorradoresHandler, previous, {
    allowInsert: true, body: { preview_fingerprint: shown.payload.preview_fingerprint },
  });
  assert.equal(saved.statusCode, 201);
  const inserts = saved.queries.filter(({ sql }) => /INSERT/.test(sql));
  assert.equal(inserts.length, 2);
  for (const { params } of inserts) {
    assert.deepEqual(JSON.parse(params[9]), shown.payload.previews[params[0]].modulos_generados);
    assert.deepEqual(JSON.parse(params[14]), shown.payload.previews[params[0]].diferencias);
  }
});

test('invalid fingerprint is rejected before processing or inserts', async () => {
  const saved = await invoke(createGuardarBaseBorradoresHandler, publishedFixture(), {
    allowInsert: true, body: { preview_fingerprint: '' },
  });
  assert.equal(saved.statusCode, 400);
  assert.equal(saved.payload.codigo, 'preview_fingerprint_invalido');
  assert.equal(saved.queries.length, 0);
  assert.equal(saved.parserCalls.length, 0);
});

test('fingerprint detects different original bytes even when the parser result is identical', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'base-fingerprint-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pdf = path.join(root, 'test.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\nfirst');
  const options = { fuente: { ...fuente, ruta_relativa: 'test.pdf' }, uploadDir: root };
  const shown = await invoke(createPreviewBaseHandler, publishedFixture(), options);
  fs.writeFileSync(pdf, '%PDF-1.4\nsecond');
  const saved = await invoke(createGuardarBaseBorradoresHandler, publishedFixture(), {
    ...options, allowInsert: true, body: { preview_fingerprint: shown.payload.preview_fingerprint || '0'.repeat(64) },
  });
  assert.equal(saved.statusCode, 409);
  assert.equal(saved.payload.codigo, 'preview_desactualizado');
  assert.ok(saved.queries.every(({ sql }) => !/INSERT/.test(sql)));
});

test('an original changed during parsing is rejected without returning a trustworthy preview', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'base-original-change-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pdf = path.join(root, 'test.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\nfirst');
  const shown = await invoke(createPreviewBaseHandler, fingerprintFixture(), {
    fuente: { ...fuente, ruta_relativa: 'test.pdf' }, uploadDir: root,
    duringParse: () => fs.writeFileSync(pdf, '%PDF-1.4\nsecond'),
  });
  assert.equal(shown.statusCode, 409);
  assert.equal(shown.payload.codigo, 'preview_desactualizado');
  assert.equal(shown.payload.preview_fingerprint, undefined);
});

test('unrelated published categories do not invalidate the reviewed fingerprint', async () => {
  const previous = fingerprintFixture();
  const shown = await invoke(createPreviewBaseHandler, previous);
  previous.push({ categoria: 'inalambrico', id: 'unrelated', modulos_generados: [] });
  const repeated = await invoke(createPreviewBaseHandler, previous);
  assert.equal(repeated.payload.preview_fingerprint, shown.payload.preview_fingerprint);
});

test('legacy preview compares stored rows and extra sections without reading the previous PDF', async () => {
  const previous = publishedFixture();
  previous[0].modulos_generados[0].contenido.filas[0].precio = 999;
  previous[1].modulos_generados.push(extraModule());
  const before = structuredClone(previous);
  const res = await invoke(createPreviewBaseHandler, previous);
  assert.equal(res.statusCode, 200);
  assert.equal(res.parserCalls.length, 1);
  assert.equal(res.parserCalls[0][1], path.join(uploadDir, fuente.ruta_relativa));
  assert.deepEqual(previous, before);
  const fijo = res.payload.previews.fijo.diferencias.registros;
  assert.equal(fijo.resumen.total_anterior, 82);
  assert.ok(fijo.modificados.some((r) => r.cambios.some((c) => c.campo === 'precio' && c.antes === 999 && c.ahora === 10)));
  const tv = res.payload.previews.claro_tv.diferencias;
  assert.equal(tv.registros.resumen.total_anterior, 11);
  assert.deepEqual(tv.registros.eliminados.map((r) => r.registro.precio), [40, 45]);
  assert.deepEqual(tv.modulos.eliminados, [{ seccion_key: 'claro_tv_equipos' }]);
  assert.ok(res.queries.every(({ sql }) => !/\bINSERT\b|\bUPDATE\b|\bDELETE\b/.test(sql)));
});

test('snapshot identities normalize A878 without merging the two published 1186 occurrences', () => {
  const previous = publishedFixture();
  const before = structuredClone(previous);
  const { diferencias } = previewFrom(previous).previews.find((p) => p.categoria === 'fijo');
  assert.equal(diferencias.registros.resumen.total_anterior, 82);
  assert.equal(diferencias.registros.resumen.total_actual, 81);
  assert.equal(diferencias.registros.resumen.nuevos, 0);
  assert.equal(diferencias.registros.resumen.eliminados, 1);
  assert.equal(diferencias.registros.eliminados[0].registro.codigo, '1186');
  assert.equal(diferencias.registros.eliminados[0].registro.tecnologia, 'COBRE/VRAD');
  assert.equal(diferencias.registros.sin_cambios.filter((r) => r.codigo === 'A878').length, 2);
  assert.deepEqual(previous, before);
});

test('duplicate identity matching is independent of published row order', () => {
  const previous = publishedFixture();
  const expected = previewFrom(previous).previews[0].diferencias.registros;
  previous[0].modulos_generados.forEach((m) => m.contenido.filas.reverse());
  const actual = previewFrom(previous).previews[0].diferencias.registros;
  assert.deepEqual(actual, expected);
});

for (const [name, corrupt] of [
  ['missing row code', (p) => { delete p[0].modulos_generados[0].contenido.filas[0].codigo; }],
  ['unknown row format', (p) => { p[0].modulos_generados[0].contenido.filas[0] = ['unrecognized']; }],
  ['unknown module content', (p) => { p[0].modulos_generados[0].contenido = { html: 'unknown' }; }],
  ['duplicate sections', (p) => { p[0].modulos_generados.push(structuredClone(p[0].modulos_generados[0])); }],
  ['unknown A878 variant', (p) => { p[0].modulos_generados[1].contenido.filas[0].descripcion = 'Unknown commercial variant'; }],
  ['row in conflicting section', (p) => { p[0].modulos_generados[0].contenido.filas[0].seccion_key = 'claro_tv_planes'; }],
  ['unknown category without explicit identity', (p) => {
    p[0].modulos_generados.push({ seccion_key: 'unknown', contenido: { filas: [{ codigo: 'X' }] } });
  }],
  ['ambiguous duplicate identity', (p) => {
    const rows = p[0].modulos_generados[0].contenido.filas;
    rows[0].precio = 20;
    rows.push({ ...rows[0], precio: 30, llave_normalizada: 'other' });
  }],
]) {
  test(`uncomparable snapshot blocks preview and saving: ${name}`, async () => {
    const previous = publishedFixture();
    corrupt(previous);
    for (const handler of [createPreviewBaseHandler, createGuardarBaseBorradoresHandler]) {
      const res = await invoke(handler, previous);
      assert.equal(res.statusCode, 422);
      assert.equal(res.payload.codigo, 'snapshot_publicado_no_comparable');
      assert.equal(res.payload.requiere_revision, true);
      assert.ok(res.queries.every(({ sql }) => !/\bINSERT\b|\bUPDATE\b|\bDELETE\b/.test(sql)));
    }
  });
}
