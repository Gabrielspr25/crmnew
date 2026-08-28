import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const route = fs.readFileSync(new URL('src/routes/equiposRoutes.js', root), 'utf8');

test('el portal publico puede consultar equipos sin token', () => {
  assert.match(route, /equiposRouter\.get\('\/equipos-lista',\s*async \(req, res\) =>/);
  assert.match(route, /equiposRouter\.get\('\/equipos-lista\/uploads',\s*requireAuth/);
  assert.match(route, /equiposRouter\.post\('\/equipos-lista\/preview',\s*requireAuth/);
  assert.match(route, /equiposRouter\.post\('\/equipos-lista\/upload',\s*requireAuth/);
});
