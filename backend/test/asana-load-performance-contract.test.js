import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const route = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');

test('Asana carga oportunidades, llamadas y Mi dia en paralelo', () => {
  assert.match(app, /Promise\.all\(\[api\('\/api\/asana-real'\),loadCallAlerts\(\),api\('\/api\/asana-real\/agenda\?scope='/);
});

test('Asana reutiliza una carga reciente para abrir la pantalla con rapidez', () => {
  assert.match(route, /asanaListCache/);
  assert.match(route, /Date\.now\(\) - asanaListCache\.at < 30000/);
});
