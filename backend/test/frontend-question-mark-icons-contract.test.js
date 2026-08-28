import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const frontendPath = process.env.FRONTEND_HTML_PATH
  ? resolve(process.env.FRONTEND_HTML_PATH)
  : resolve(process.cwd(), '..', 'frontend', 'app.html');

test('el frontend no muestra signos ? como iconos rotos en botones, titulos o tarjetas', async () => {
  const html = await readFile(frontendPath, 'utf8');
  const checks = [
    ['botones con signo roto', />\?+\s*[^<]*<\/button>/g],
    ['titulos con signo roto', /<h[1-4][^>]*>\?+\s*/g],
    ['iconos dz rotos', /class="dz-ico">\?+</g],
    ['iconos lic rotos', /class="lic [^"]*">\?+</g],
    ['alertas de exito con signo roto', /alert\('\?+\s*/g],
    ['textContent con signo roto', /textContent\s*=\s*'\?+\s*/g],
    ['tabs de ofertas con signo roto', /\['[^']+','\?+\s*/g],
    ['controles de paso con signo roto', /onclick="paso(?:Move|Del)\([^"]+"\>\?+<\/button>/g],
    ['toggle de comisiones con signo roto', /textContent==='\?';ar\.textContent=open\?'\?':'\?'/g],
  ];

  const failures = [];
  for (const [label, pattern] of checks) {
    const matches = [...html.matchAll(pattern)].map(match => match[0].slice(0, 120));
    if (matches.length) failures.push(`${label}: ${matches.slice(0, 5).join(' | ')}`);
  }

  assert.deepEqual(failures, []);
});
