import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const miscRoute = readFileSync(new URL('src/routes/misc.js', root), 'utf8');
const importRoute = readFileSync(new URL('src/routes/importRoutes.js', root), 'utf8');
const directorioRoute = readFileSync(new URL('src/routes/directorioOperacionesRoutes.js', root), 'utf8');
const baseMigration = readFileSync(new URL('migrations/2026-07-06-ventaspro-nuevo-base.sql', root), 'utf8');

test('audit_log stores the requester IP address', () => {
  assert.match(baseMigration, /ip_address\s+TEXT/i);
  assert.match(miscRoute, /ip_address/);
  assert.match(miscRoute, /INSERT INTO ventaspro_nuevo\.audit_log\s*\([^)]*ip_address[^)]*\)/s);
  assert.match(miscRoute, /VALUES\s*\([^)]*\$6[^)]*\)/s);
});

test('audit writers pass req.ip to the audit helper', () => {
  assert.match(importRoute, /ip:\s*req\.ip/);
  assert.match(directorioRoute, /ip:\s*req\.ip/);
});
