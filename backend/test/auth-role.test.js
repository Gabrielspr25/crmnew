import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeRole, requireAdmin, requireStrictAuth } from '../src/auth.js';

test('normaliza roles administrativos devueltos por Tango', () => {
  assert.equal(normalizeRole('Administrador'), 'admin');
  assert.equal(normalizeRole('ADMIN'), 'admin');
  assert.equal(normalizeRole('super admin'), 'admin');
  assert.equal(normalizeRole('super_admin'), 'admin');
  assert.equal(normalizeRole('Supervisor'), 'supervisor');
  assert.equal(normalizeRole('Vendedor'), 'vendedor');
});

test('expone autenticacion estricta para las rutas que no permiten DEV_LOGIN', () => {
  assert.equal(typeof requireStrictAuth, 'function');
});

test('autoriza las sesiones administrativas existentes de Tango', () => {
  const req = { user: { rol: 'super admin' } };
  const res = { status: () => ({ json: () => assert.fail('no debe rechazar administrador') }) };
  let passed = false;
  requireAdmin(req, res, () => { passed = true; });
  assert.equal(passed, true);
  assert.equal(req.user.rol, 'admin');
});
