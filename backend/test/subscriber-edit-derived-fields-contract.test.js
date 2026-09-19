import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const writeRoutes = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');

test('editar suscriptor deriva PRODUCT_TYPE e intervalo de contrato desde campos comerciales', () => {
  assert.match(appHtml, /function cliProductTypeFromLineKind\(lineKind\)/);
  assert.match(appHtml, /if\(!v\.product_type&&v\.line_kind\) v\.product_type=cliProductTypeFromLineKind\(v\.line_kind\)/);
  assert.match(appHtml, /function cliContractEndFromStartAndTerm\(start,term\)/);
  assert.match(appHtml, /if\(v\.contract_start_date&&v\.contract_term&&!v\.contract_end_date\) v\.contract_end_date=cliContractEndFromStartAndTerm\(v\.contract_start_date,v\.contract_term\)/);
  assert.match(appHtml, /if\(!v\.contract_start_date&&v\.activation_date\) v\.contract_start_date=v\.activation_date/);

  assert.match(writeRoutes, /function productTypeFromLineKind\(lineKind\)/);
  assert.match(writeRoutes, /if \(!body\.product_type && body\.line_kind\) body\.product_type = productTypeFromLineKind\(body\.line_kind\);/);
  assert.match(writeRoutes, /function contractEndFromStartAndTerm\(start, term\)/);
  assert.match(writeRoutes, /if \(!body\.contract_start_date && body\.activation_date\) body\.contract_start_date = body\.activation_date;/);
  assert.match(writeRoutes, /if \(body\.contract_start_date && body\.contract_term && !body\.contract_end_date\) \{/);
});
