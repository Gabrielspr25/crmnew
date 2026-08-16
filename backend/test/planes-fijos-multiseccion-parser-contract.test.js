import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const parser = new URL('../../scripts/parse_planes_fijos_pdf.py', import.meta.url);
const pdf = new URL('../../Planes para web/Estructura de planes/planes/LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf', import.meta.url);
const categoriasPublicables = [
  'fijo_telefonia',
  'fijo_internet_2play',
  'fijo_valores_agregados_vendibles',
  'fijo_equipos_accesorios_internet',
  'claro_tv_planes',
  'claro_tv_servicios_complementos',
];
const categoriasEsperadas = [
  ...categoriasPublicables,
  'claro_tv_equipos',
  'internet_equipos_ofertas',
  'referencia_interna',
  'contenido_temporal_excluido',
  'terminos_contrato',
  'revision_manual',
];

function runParser() {
  assert.equal(fs.existsSync(fileURLToPath(pdf)), true, 'falta el PDF de estructura de planes fijos');
  const run = spawnSync('python', [fileURLToPath(parser), fileURLToPath(pdf)], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

function filas(parsed, seccion) {
  return parsed.modulos[seccion].filas;
}

function todasLasFilas(parsed) {
  return Object.values(parsed.modulos).flatMap((modulo) => modulo.filas);
}

test('parser conserva auditoria completa y genera salida normalizada deduplicada', () => {
  const parsed = runParser();
  const totalNormalizado = todasLasFilas(parsed).length;

  assert.deepEqual(Object.keys(parsed.modulos), categoriasEsperadas);
  assert.deepEqual(parsed.categorias_candidatas_portal, categoriasPublicables);
  assert.equal(parsed.auditoria_original.total_filas, 139);
  assert.equal(parsed.auditoria_original.llaves_unicas, 131);
  assert.equal(parsed.auditoria_original.duplicados_exactos_total, 8);
  assert.equal(parsed.registros_normalizados_total, 131);
  assert.equal(totalNormalizado, parsed.registros_normalizados_total);
  assert.deepEqual(parsed.errores, []);
});

test('duplicados exactos quedan registrados y no se publican dos veces', () => {
  const parsed = runParser();
  const duplicados = parsed.auditoria_original.duplicados_exactos;
  const publicados = parsed.salida_candidata_publicacion.filas;
  const publicadasPorLlave = new Map();

  assert.equal(duplicados.length, 8);
  assert.equal(duplicados.every((d) => d.ocurrencias.length === 2), true);
  assert.equal(duplicados.every((d) => d.ocurrencias.every((o) => o.pagina && o.texto_original)), true);

  for (const fila of publicados) {
    publicadasPorLlave.set(fila.llave_normalizada, (publicadasPorLlave.get(fila.llave_normalizada) || 0) + 1);
  }
  assert.equal([...publicadasPorLlave.values()].some((count) => count > 1), false);
});

test('A654 conserva conceptos distintos por seccion y descripcion', () => {
  const parsed = runParser();
  const a654 = parsed.auditoria_original.filas.filter((fila) => fila.codigo === 'A654');
  const conceptos = new Set(a654.map((fila) => `${fila.categoria}|${fila.encabezado_origen}|${fila.descripcion}`));

  assert.equal(a654.length, 3);
  assert.equal(conceptos.size, 2);
  assert.ok(a654.some((fila) => fila.encabezado_origen.includes('Equipos / Ofertas Internet') && /WIFI BEACON/i.test(fila.descripcion)));
  assert.ok(a654.some((fila) => fila.encabezado_origen.includes('Valores Agregados') && /DOBLE VELOCIDAD/i.test(fila.descripcion)));
});

test('equipos TV e internos no aparecen como productos publicos', () => {
  const parsed = runParser();
  const planesPublicos = [
    ...filas(parsed, 'fijo_telefonia'),
    ...filas(parsed, 'fijo_internet_2play'),
    ...filas(parsed, 'claro_tv_planes'),
  ];
  const candidatos = parsed.salida_candidata_publicacion.filas;

  assert.equal(planesPublicos.some((fila) => /STB|DONGLE|CONTROL REMOTO|BEACON/i.test(fila.descripcion)), false);
  assert.equal(filas(parsed, 'claro_tv_servicios_complementos').some((fila) => ['REAKNG', 'IPLYB', 'NPVR250'].includes(fila.codigo)), true);
  assert.equal(filas(parsed, 'claro_tv_equipos').every((fila) => /STB|DONGLE|CONTROL REMOTO/i.test(fila.descripcion)), true);
  assert.equal(candidatos.some((fila) => ['2633', '2635', '7240', '7241', '9063', '7268', '9925', '9926', '9927', '9938', '3337'].includes(fila.codigo)), false);
});

test('80184H WiFi Beacon se publica en Fijo como equipo accesorio de Internet', () => {
  const parsed = runParser();
  const accesorios = filas(parsed, 'fijo_equipos_accesorios_internet');
  const beacon = accesorios.find((fila) => fila.codigo === '80184H');
  const candidatos = parsed.salida_candidata_publicacion.filas;

  assert.equal(accesorios.length, 1);
  assert.ok(beacon);
  assert.match(beacon.descripcion, /WIFI BEACON/i);
  assert.equal(beacon.precio, 59.99);
  assert.equal(beacon.tecnologia, 'COBRE/VRAD/GPON');
  assert.match(beacon.texto_original, /7012713/);
  assert.match(beacon.encabezado_origen, /Equipos \/ Ofertas Internet/);
  assert.equal(candidatos.some((fila) => fila.categoria === 'fijo_equipos_accesorios_internet' && fila.codigo === '80184H'), true);
  assert.equal(filas(parsed, 'contenido_temporal_excluido').some((fila) => fila.codigo === '80184H'), false);
});

test('referencia interna, temporales y revision manual reconcilian con la auditoria', () => {
  const parsed = runParser();
  const totalNormalizado = todasLasFilas(parsed).length;

  assert.ok(filas(parsed, 'referencia_interna').some((fila) => fila.codigo === '9063'));
  assert.ok(filas(parsed, 'referencia_interna').some((fila) => fila.codigo === '9925'));
  assert.ok(filas(parsed, 'contenido_temporal_excluido').some((fila) => fila.codigo === '7336' && /Affinity/i.test(fila.motivo_exclusion)));
  assert.equal(filas(parsed, 'revision_manual').length, 0);
  assert.equal(totalNormalizado + parsed.auditoria_original.duplicados_exactos_total, parsed.auditoria_original.total_filas);
});

test('fallas ajenas permanecen documentadas como preexistentes', () => {
  const parsed = runParser();

  assert.deepEqual(parsed.pruebas_fallidas_ajenas_preexistentes, [
    'backend/test/client-profile-line-tabs-contract.test.js',
    'backend/test/clients-search-ui-contract.test.js',
    'backend/test/portal-ofertas-auth-launch.test.js',
  ]);
});
