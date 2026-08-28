import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const db = readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');

test('el pool de PostgreSQL es configurable y mantiene un valor prudente', () => {
  assert.match(db, /DB_POOL_MAX/);
  assert.match(db, /max:\s*POOL_MAX/);
  assert.match(db, /Math\.min\(50/);
});

test('los HTML tienen cache corto y ETag para no descargarse en cada navegación', () => {
  assert.match(server, /etag:\s*true/);
  assert.match(server, /public, max-age=60/);
  assert.doesNotMatch(server, /Cache-Control', 'no-store, must-revalidate'/);
});
