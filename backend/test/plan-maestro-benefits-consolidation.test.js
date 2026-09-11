import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { buildBenefitsConsolidation } from '../src/services/benefitsConsolidation.js';

const report = JSON.parse(await readFile(new URL('../../docs/constructor/servicios-benefits-consolidado-local.json', import.meta.url), 'utf8'));

test('consolidacion local de Benefits conserva fuentes y no activa autoaplica', () => {
  assert.equal(report.ok, true);
  assert.equal(report.resumen.autoaplica, false);
  assert.ok(report.resumen.fuentes_evaluadas >= 35);
  assert.ok(report.resumen.detecciones > 0);
  for (const detection of report.detecciones) {
    assert.match(detection.fuente.sha256, /^[A-F0-9]{64}$/);
    assert.equal(detection.autoaplica, undefined);
    assert.ok(detection.estado);
  }
});

test('consolidacion detecta Benefits minimos requeridos por categoria', () => {
  const categories = new Set(report.beneficios.map((item) => item.categoria));
  for (const category of [
    'Streaming',
    'Pago de balance de equipo',
    'Meses gratis',
    'Convergencia',
    'Fijo',
    'Movil',
    'Inalambrico / IoT',
    'Portabilidad',
    'Pago de penalidad',
    'Doble velocidad',
    'Doble data',
    'Descuentos porcentuales',
    'Accesorios',
    'Tabletas',
    'Modems / MIFI',
    'Affinity',
  ]) {
    assert.equal(categories.has(category), true, `falta categoria ${category}`);
  }
});

test('Benefits publicados se identifican desde reglas vigentes y confirmadas', () => {
  const published = report.beneficios.filter((item) => item.publicado);
  assert.ok(published.length >= 9);
  assert.ok(report.reglas_publicadas_detectadas.every((row) => row.estado_confianza === 'confirmado'));
  assert.ok(report.reglas_publicadas_detectadas.every((row) => row.estado_publicacion === 'vigente'));
  assert.ok(report.reglas_publicadas_detectadas.every((row) => row.autoaplica === false));
});

test('servicio puro marca vencidas y no publicadas sin inferir vigencia', () => {
  const consolidation = buildBenefitsConsolidation({
    today: '2026-09-04',
    inventory: {
      fuentes: [
        {
          nombre: 'BOLETIN OFERTAS PYMES 2026 - DEL 1 JUN@31 JUL 26.pdf',
          extension: '.pdf',
          sha256: 'A'.repeat(64),
          dominio_inferido: 'fijo',
          vigencia_inferida: { texto: '1 jun@31 jul 26' },
        },
      ],
    },
    textBySource: {
      'BOLETIN OFERTAS PYMES 2026 - DEL 1 JUN@31 JUL 26.txt': '3 meses gratis y doble velocidad para cliente convergente',
    },
    publishedRows: [],
  });

  assert.ok(consolidation.detecciones.length > 0);
  assert.ok(consolidation.detecciones.every((item) => item.vigencia_estado === 'vencida'));
  assert.ok(consolidation.detecciones.every((item) => item.publicado === false));
  assert.ok(consolidation.detecciones.every((item) => item.estado === 'vencida_no_publicable'));
});
