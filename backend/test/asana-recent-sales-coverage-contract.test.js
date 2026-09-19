import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const routes = await readFile(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Asana oculta ventas recientes completas sin ocultar crecimiento parcial', () => {
  assert.match(routes, /CURRENT_DATE - INTERVAL '6 months'/);
  assert.match(routes, /recent_sale_review/);
  assert.match(routes, /venta_reciente_completa/);
  assert.match(routes, /venta_reciente_parcial/);
  assert.match(routes, /crecimiento_pendiente/);
  assert.match(routes, /recent_sale_filter/);
  assert.match(routes, /COALESCE\(recent_sale_filter\.action,''\) <> 'sacar_de_nueva_oportunidad'/);
  assert.match(routes, /ventaspro_nuevo\.sales/);
  assert.match(routes, /FROM subscriber_reports sr/);
  assert.match(app, /function asanaRecentSaleBadge\(/);
  assert.match(app, /Venta reciente completa/);
  assert.match(app, /Venta reciente parcial/);
  assert.match(app, /Crecimiento pendiente/);
  assert.match(app, /asanaRecentSaleBadge\(o\.recent_sale_review\)/);
});
