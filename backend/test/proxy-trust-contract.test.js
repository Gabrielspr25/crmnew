import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const server = fs.readFileSync(new URL('src/server.js', root), 'utf8');

test('express confia en un solo proxy frontal', () => {
  assert.match(server, /app\.set\('trust proxy',\s*1\);/);
});
