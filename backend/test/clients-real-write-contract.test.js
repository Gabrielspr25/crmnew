import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const writeRoutesSource = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');

test('editar cliente real sincroniza business_name al completar una empresa incompleta', () => {
  assert.match(writeRoutesSource, /function isMissingClientIdentityValue\(value\)/);
  assert.match(writeRoutesSource, /if \(body\.name && !\('business_name' in body\)\)/);
  assert.match(writeRoutesSource, /SELECT business_name FROM clients WHERE id = \$1 FOR UPDATE/);
  assert.match(writeRoutesSource, /isMissingClientIdentityValue\(current\.rows\[0\]\?\.business_name\)/);
  assert.match(writeRoutesSource, /sets\.push\(`business_name = \$\$\{vals\.length\}`\)/);
});
