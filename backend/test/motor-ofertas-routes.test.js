import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('las rutas del motor exigen autenticacion y reservan preview/aprobacion para admin', () => {
  const source = readFileSync(new URL('../src/routes/motorOfertasRoutes.js', import.meta.url), 'utf8');
  assert.match(source, /motorOfertasRouter\.use\(requireAuth\)/);
  assert.match(source, /motorOfertasRouter\.post\('\/preview', requireAdmin/);
  assert.match(source, /motorOfertasRouter\.post\('\/aprobar', requireAdmin/);
  assert.match(source, /motorOfertasRouter\.post\('\/elegibles'/);
});
