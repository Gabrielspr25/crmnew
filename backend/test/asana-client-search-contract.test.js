import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const asanaSource = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const frontendSource = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('la búsqueda de clientes para seguimiento usa solo líneas activas o suspendidas', () => {
  assert.match(asanaSource, /asana-real\/client-search/);
  assert.match(asanaSource, /ACTIVE_OR_SUSPENDED_SUB_SQL/);
  assert.match(asanaSource, /s\.phone::text ILIKE \$1/);
  assert.match(asanaSource, /LIMIT 12/);
  assert.match(asanaSource, /opportunity_id/);
});

test('Asana permite filtrar oportunidades visibles y buscar clientes activos desde la misma pantalla', () => {
  assert.match(frontendSource, /function filterAsanaRows\(raw\)/);
  assert.match(frontendSource, /async function buscarClienteAsana\(raw\)/);
  assert.match(frontendSource, /\/api\/asana-real\/client-search\?q=/);
  assert.match(frontendSource, /Enviar a seguimiento/);
  assert.match(frontendSource, /Abrir Asana/);
  assert.match(frontendSource, /onclick="enviarSeguimientoDesdeAsana\([^"\r\n]+\)">Abrir Asana<\/button>/);
});
