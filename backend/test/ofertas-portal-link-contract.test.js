import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('el enlace Ofertas Web abre directamente el constructor nuevo', () => {
  const html = fs.readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
  assert.match(html, /\/constructor\/oferta-const\.html\?crm_client_id=/);
  assert.match(html, /new URL\('\/constructor\/oferta-const\.html',window\.location\.origin\)/);
  assert.doesNotMatch(html, /ofertas\.ss-group\.cloud\/oferta-const\.html/);
});
