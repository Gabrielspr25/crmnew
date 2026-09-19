import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const app = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Clientes usa vencimiento como campo comercial principal y activacion como historial', () => {
  assert.match(app, /Vencimiento \/ proxima renovacion/);
  assert.match(app, /Inicio contrato \(uso CRM\)/);
  assert.match(app, /Fecha activacion \(historial\)/);
  assert.match(app, /function cliContractStartDisplay\(/);
  assert.match(app, /function cliActivationHistoryDisplay\(/);
  assert.match(app, /subscriber-label">Inicio contrato/);
  assert.match(app, /subscriber-label">Vence \/ renueva/);
  assert.doesNotMatch(app, /subscriber-label">Activacion/);
});
