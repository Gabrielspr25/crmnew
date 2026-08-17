import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const parser = new URL('../../scripts/parse_planes_moviles_pdf.py', import.meta.url);
const basePdfPath = 'C:/Users/Gabriel/Dropbox/Boletines Vigentes PYMES/6 AL 26 DE AGOSTO 2026/Boletin Planes Vigentes Update Plus y Financiamiento 20260619-PYM-CORP.pdf';
const byopPdfPath = 'C:/Users/Gabriel/Dropbox/Boletines Vigentes PYMES/6 AL 26 DE AGOSTO 2026/Boletin Nuevo Plan Multilinea Business Red Plus-BYOP-BAN-17 marzo de 2026.pdf';

function runParser(pdfPath) {
  assert.equal(fs.existsSync(pdfPath), true, `falta PDF real: ${pdfPath}`);
  const run = spawnSync('python', [fileURLToPath(parser), pdfPath], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

test('parser movil extrae solo candidatos PYMES publicables del PDF base', () => {
  const parsed = runParser(basePdfPath);

  assert.equal(parsed.documento.tipo, 'planes_moviles_base');
  assert.equal(parsed.fecha_actualizacion_base_detectada, '2026-06-20');
  assert.equal(parsed.modulos.planes_individuales.filas.length, 11);
  assert.equal(parsed.modulos.planes_multilinea_opciones.filas.length, 36);
  assert.equal(parsed.modulos.referencia_operativa.filas.length, 4);
  assert.equal(parsed.modulos.segmento_no_incluido.filas.length, 8);
  assert.equal(parsed.resumen.candidatos_publicos, 47);
  assert.equal(parsed.modulos.segmento_no_incluido.filas.every((row) => row.segmento_no_incluido === 'gobierno'), true);
  assert.equal(parsed.modulos.planes_individuales.filas.filter((row) => row.codigo === 'BREDSF').length, 1);
  assert.deepEqual(
    parsed.modulos.planes_individuales.filas.find((row) => row.codigo === 'BREDSF').trazas_auditoria.map((trace) => trace.pagina).sort(),
    [16, 23]
  );
});

test('parser movil no publica la linea 1 como opcion multilinea vendible', () => {
  const parsed = runParser(basePdfPath);
  const publicCodes = parsed.modulos.planes_multilinea_opciones.filas.map((row) => row.codigo);
  const referenceCodes = parsed.modulos.referencia_operativa.filas.map((row) => row.codigo).sort();

  assert.equal(publicCodes.some((code) => ['BREDP1', 'BREDE1', 'BREDS1', 'BREDSF1'].includes(code)), false);
  assert.deepEqual(referenceCodes, ['BREDE1', 'BREDP1', 'BREDS1', 'BREDSF1']);
});

test('parser movil extrae Business Red Plus BYOP-BAN como plan por BAN sin generar lineas', () => {
  const parsed = runParser(byopPdfPath);
  const byop = parsed.modulos.planes_multilinea_byop_ban.filas;

  assert.equal(parsed.documento.tipo, 'planes_moviles_byop_ban');
  assert.equal(byop.length, 1);
  assert.equal(byop[0].familia, 'Business Red Plus BYOP-BAN');
  assert.equal(byop[0].codigo, 'BREDP1015');
  assert.equal(byop[0].precio_regular, 150);
  assert.equal(byop[0].modelo_cobro, 'por_ban');
  assert.equal(byop[0].capacidad_maxima_lineas, 10);
  assert.deepEqual(byop[0].requisitos_permanentes, ['BYOP', 'AutoPay']);
  assert.equal(byop[0].promedio_10_lineas, 15);
  assert.equal(byop[0].precio_regular_descripcion, '$150.00 por BAN');
  assert.equal(parsed.modulos.planes_multilinea_opciones.filas.length, 0);
});
