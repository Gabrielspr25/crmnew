import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const parser = new URL('../../scripts/parse_equipos_pdf.py', import.meta.url);
const route = fs.readFileSync(new URL('../src/routes/fuentesComercialesRoutes.js', import.meta.url), 'utf8');
const fixture = 'C:/Users/Gabriel/Documents/Codex/2026-08-02/realtime-voice-chat-3/internet-go-agosto-2026.pdf';

test('el boletin agosto reconoce Internet On The Go, Claro Oficina e IoT antes de reemplazar Inalambrico', () => {
  assert.equal(fs.existsSync(fixture), true, 'falta el boletin de agosto para validar el parser');
  const run = spawnSync('python', [fileURLToPath(parser), fixture], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const parsed = JSON.parse(run.stdout);
  assert.deepEqual(parsed.secciones_detectadas, ['internet_on_the_go', 'claro_oficina', 'iot_telemetria']);
});

test('una fuente inalambrica valida actualiza solo Inalambrico y conserva el contenido publicado', () => {
  assert.match(route, /applyInalambricoFuenteAutomatica/);
  assert.match(route, /WHERE pagina='inalambrico' AND activo=true/);
  assert.match(route, /contenido=contenido/);
  assert.match(route, /secciones_detectadas/);
});
