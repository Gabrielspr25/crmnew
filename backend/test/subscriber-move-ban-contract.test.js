import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildSubscriberChanges } from '../src/services/subscriberHistoryService.js';

const writeRoutes = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

function subscriberPutHandler() {
  const start = writeRoutes.indexOf("writeRouter.put('/subscribers-real/:id', requireAuth");
  const end = writeRoutes.indexOf("writeRouter.put('/subscribers-real/:id/gpon-review'");
  assert.ok(start >= 0 && end > start, 'handler PUT /subscribers-real/:id');
  return writeRoutes.slice(start, end);
}

test('edicion de suscriptor acepta ban_id y valida mismo cliente', () => {
  const handler = subscriberPutHandler();
  assert.match(handler, /body\.ban_id/);
  assert.match(handler, /ban_id = \$\$\{vals\.length\}/);
  assert.match(handler, /String\(fromBan\.client_id\) !== String\(toBan\.client_id\)/);
  assert.match(handler, /statusCode: 422/);
  assert.match(handler, /El BAN destino no existe/);
  assert.match(handler, /res\.status\(e\.statusCode \|\| 500\)/);
});

test('mover linea recalcula estado de ambos BANs y registra historial manual', () => {
  const handler = subscriberPutHandler();
  assert.match(handler, /UPDATE bans b SET status = CASE/);
  assert.match(handler, /\[banMove\.from\.id, banMove\.to\.id\]/);
  assert.match(handler, /ban_number: banMove\.from\.ban_number/);
  assert.match(handler, /ban_number: banMove\.to\.ban_number/);
  assert.match(handler, /source: 'manual'/);
});

test('historial registra cambio de BAN solo cuando ambos lados lo traen', () => {
  assert.deepEqual(
    buildSubscriberChanges({ ban_number: '111111111' }, { ban_number: '222222222' }),
    { ban_number: { old: '111111111', new: '222222222' } },
  );
  assert.deepEqual(buildSubscriberChanges({ plan: 'A' }, { plan: 'A' }), {});
});

test('modal editar suscriptor ofrece selector de BAN del cliente con confirmacion', () => {
  assert.match(app, /function cliSubscriberBanField\(s\)/);
  assert.match(app, /key:'ban_id',label:'BAN \(mover linea\)',type:'select'/);
  assert.match(app, /cliSubscriberFields\(st\.subscriber\|\|\{\},\{withBan:true\}\)/);
  assert.match(app, /¿Mover el suscriptor /);
  assert.match(app, /ban_number:'BAN'/);
});

test('agregar suscriptor no muestra selector de BAN', () => {
  assert.match(app, /openForm\('Agregar suscriptor',cliSubscriberFields\(\{status:'activo'\}\)/);
});
