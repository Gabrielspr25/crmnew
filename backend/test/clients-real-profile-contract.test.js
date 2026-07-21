import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const routePath = resolve(process.cwd(), 'src', 'routes', 'clientsReal.js');

test('la ficha del cliente no consulta activation_date inexistente en bans', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.doesNotMatch(source, /SELECT id, ban_number, account_type, status, credit_class, activation_date, source/);
  assert.match(source, /SELECT id, ban_number, account_type, status, credit_class, source/);
});
