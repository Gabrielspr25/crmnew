import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildVigenciaAlertas, estadoVigencia } from '../src/services/vigenciaAlertas.js';

const fuentes = [
  { id: 'f-fijos-viejo', familia: 'fijos', nombre_original: 'Planes Fijos junio.pdf', vigencia_desde: '2026-06-01', vigencia_hasta: '2026-06-30', creado_en: '2026-06-01T10:00:00Z' },
  { id: 'f-fijos', familia: 'fijos', nombre_original: 'Planes Fijos agosto.pdf', vigencia_desde: '2026-08-01', vigencia_hasta: '2026-08-31', creado_en: '2026-08-01T10:00:00Z' },
  { id: 'f-moviles', familia: 'ofertas_moviles', nombre_original: 'Ofertas 27 de agosto al 16 de septiembre.xlsx', vigencia_desde: '2026-08-27', vigencia_hasta: '2026-09-16', creado_en: '2026-08-27T10:00:00Z' },
  { id: 'f-equipos', familia: 'equipos', nombre_original: 'Lista de equipos.xlsx', vigencia_desde: '2026-09-03', vigencia_hasta: '2026-10-28', creado_en: '2026-09-03T10:00:00Z' },
  { id: 'f-benef', familia: 'beneficios', nombre_original: 'Boletin Claro Full.pdf', vigencia_desde: '2026-07-23', vigencia_hasta: null, creado_en: '2026-07-23T10:00:00Z' },
  { id: 'f-tv', familia: 'claro_tv', nombre_original: 'Claro TV.pdf', vigencia_desde: '2026-09-01', vigencia_hasta: '2026-09-07', creado_en: '2026-09-01T10:00:00Z' },
];

test('clasifica vencida, por vencer, vigente y sin fecha fin con el umbral de dias', () => {
  assert.deepEqual(estadoVigencia({ fechaFin: '2026-08-31', today: '2026-09-07' }), { estado: 'vencida', dias_restantes: -7 });
  assert.deepEqual(estadoVigencia({ fechaFin: '2026-09-07', today: '2026-09-07' }), { estado: 'por_vencer', dias_restantes: 0 });
  assert.deepEqual(estadoVigencia({ fechaFin: '2026-10-07', today: '2026-09-07' }), { estado: 'por_vencer', dias_restantes: 30 });
  assert.deepEqual(estadoVigencia({ fechaFin: '2026-10-08', today: '2026-09-07' }), { estado: 'vigente', dias_restantes: 31 });
  assert.deepEqual(estadoVigencia({ fechaFin: '2026-10-08', today: '2026-09-07', diasAlerta: 45 }), { estado: 'por_vencer', dias_restantes: 31 });
  assert.deepEqual(estadoVigencia({ fechaFin: null, today: '2026-09-07' }), { estado: 'sin_fecha_fin', dias_restantes: null });
});

test('toma el documento mas reciente de cada familia y ordena las alertas por urgencia', () => {
  const result = buildVigenciaAlertas({ fuentes, today: '2026-09-07' });

  assert.equal(result.hoy, '2026-09-07');
  assert.equal(result.dias_alerta, 30);
  assert.deepEqual(result.alertas.map((item) => [item.familia, item.estado, item.dias_restantes, item.accion]), [
    ['fijos', 'vencida', -7, 'subir_documento_nuevo'],
    ['claro_tv', 'por_vencer', 0, 'buscar_documento_nuevo'],
    ['ofertas_moviles', 'por_vencer', 9, 'buscar_documento_nuevo'],
  ]);
  assert.equal(result.alertas[0].fuente_id, 'f-fijos');
  assert.equal(result.alertas[0].archivo, 'Planes Fijos agosto.pdf');
  assert.equal(result.alertas[0].mensaje, 'Vencido hace 7 dias');
  assert.equal(result.alertas[1].mensaje, 'Vence hoy');
  assert.equal(result.alertas[2].mensaje, 'Vence en 9 dias');
  assert.deepEqual(result.sin_fecha_fin.map((item) => item.familia), ['beneficios']);
  assert.deepEqual(result.vigentes.map((item) => [item.familia, item.dias_restantes]), [['equipos', 51]]);
  assert.deepEqual(result.resumen, { familias: 5, vencidas: 1, por_vencer: 2, sin_fecha_fin: 1, vigentes: 1 });
});

test('sin fuentes no inventa alertas', () => {
  const result = buildVigenciaAlertas({ fuentes: [], today: '2026-09-07' });
  assert.deepEqual(result.alertas, []);
  assert.deepEqual(result.resumen, { familias: 0, vencidas: 0, por_vencer: 0, sin_fecha_fin: 0, vigentes: 0 });
});

test('la ruta de alertas lee el ultimo documento por familia con sesion y sin escribir', () => {
  const route = readFileSync(new URL('../src/routes/fuentesComercialesRoutes.js', import.meta.url), 'utf8');
  const handler = route.match(/fuentesComercialesRouter\.get\('\/alertas-vencimiento'[\s\S]*?\n\}\);/)?.[0] || '';
  assert.ok(handler, 'ruta alertas-vencimiento no encontrada');
  assert.match(handler, /SELECT DISTINCT ON \(familia\)/);
  assert.match(handler, /buildVigenciaAlertas/);
  assert.doesNotMatch(handler, /INSERT|UPDATE|DELETE/);
  assert.ok(route.indexOf("fuentesComercialesRouter.use(requireAuth)") < route.indexOf("fuentesComercialesRouter.get('/alertas-vencimiento'"));
});
