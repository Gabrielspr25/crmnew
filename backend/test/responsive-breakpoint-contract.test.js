import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appPath = resolve(process.cwd(), '..', 'frontend', 'app.html');

test('el layout compacto global del CRM aplica solo en pantallas moviles reales', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /@media\(max-width:760px\)\{body\{display:block;\}\.side\{width:100%;max-height:none;display:flex;/);
  assert.doesNotMatch(html, /@media\(max-width:1440px\),\(hover:none\) and \(pointer:coarse\)\{body\{display:block;\}\.side\{width:100%;max-height:none;display:flex;/);
  assert.doesNotMatch(html, /@media\(max-width:1180px\),\(hover:none\) and \(pointer:coarse\)\{body\{display:block;\}\.side\{width:100%;max-height:none;display:flex;/);
  assert.doesNotMatch(html, /@media\(max-width:900px\)\{body\{display:block;\}\.side\{width:100%;max-height:none;display:flex;/);
});
