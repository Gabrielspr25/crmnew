import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
const frontend = fs.readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('el perfil vendedor no puede operar campañas y solo usa correo 1 a 1', () => {
  const routes = read('routes/correosRoutes.js');
  const scope = read('services/sellerScope.js');
  assert.match(routes, /requireCampaignAdmin/);
  assert.match(scope, /correo 1 a 1/i);
  assert.match(frontend, /applySellerProfile/);
  assert.match(frontend, /coMode='one'/);
});

test('el perfil vendedor recibe solo sus metas y seguimiento propio', () => {
  const goals = read('routes/goals.js');
  const asana = read('routes/asanaReal.js');
  assert.match(goals, /sellerScope/);
  assert.match(asana, /sellerScope/);
  assert.match(asana, /No puedes abrir un seguimiento asignado a otro vendedor/);
});
