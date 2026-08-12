import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseBusinessRedMultilineaText } from '../src/services/businessRedMultilineaPdf.js';

const pdfTextSample = `
PROCESO DE ACTIVACION PLAN VOLTE BUSINESS RED PLUS
1 linea BREDP1 $65 BREDP1 $65 $65/$55 $65/$55
2 lineas BREDP1 $65 BREDP2 $45 $55/$45 $110/$90
Business Wireline Small 3 lineas BREDP1 $65 BREDP3 $20 $43.33/$33.33 $130/$100
Business Regular 4 lineas BREDP1 $65 BREDP4 $30 $40/$30 $160/$120
Business Corporate 5 lineas BREDP1 $65 BREDP5 $15 $35/$25 $175/$125
Business Credit Limit 6 lineas BREDP1 $65 BREDP6 $35 $35/$25 $210/$150
Business BYOP Corporate 7 lineas BREDP1 $65 BREDP7 $35 $35/$25 $245/$175
Business BYOP DBA 8 lineas BREDP1 $65 BREDP8 $35 $35/$25 $280/$200
9 lineas BREDP1 $65 BREDP9 $35 $35/$25 $315/$225
10 lineas BREDP1 $65 BREDP10 $35 $35/$25 $350/$250

PROCESO DE ACTIVACION PLAN VOLTE BUSINESS RED EXTREME
1 linea BREDE1 $75 BREDE1 $75 $75/$65 $65/$55
2 lineas BREDE1 $75 BREDE2 $45 $60/$50 $120/$100
3 lineas BREDE1 $75 BREDE3 $15 $45/$35 $135/$105
4 lineas BREDE1 $75 BREDE4 $35 $42.50/$32.50 $170/$130
5 lineas BREDE1 $75 BREDE5 $30 $40/$30 $200/$150
6 lineas BREDE1 $75 BREDE6 $40 $40/$30 $240/$180
7 lineas BREDE1 $75 BREDE7 $40 $40/$30 $280/$210
8 lineas BREDE1 $75 BREDE8 $40 $40/$30 $320/$240
9 lineas BREDE1 $75 BREDE9 $40 $40/$30 $360/$270
10 lineas BREDE1 $75 BREDE10 $40 $40/$30 $400/$300

PROCESO DE ACTIVACION PLAN VOLTE BUSINESS RED SUPREME
1 linea BREDS1 $95 BREDS1 $95 $95/$85 $95/$85
2 lineas BREDS1 $95 BREDS2 $75 $85/$75 $170/$150
3 lineas BREDS1 $95 BREDS3 $40 $70/$60 $210/$180
4 lineas BREDS1 $95 BREDS4 $30 $60/$50 $240/$200
5 lineas BREDS1 $95 BREDS5 $35 $55/$45 $275/$225
6 lineas BREDS1 $95 BREDS6 $25 $50/$40 $300/$240
7 lineas BREDS1 $95 BREDS7 $50 $50/$40 $350/$280
8 lineas BREDS1 $95 BREDS8 $50 $50/$40 $400/$320
9 lineas BREDS1 $95 BREDS9 $50 $50/$40 $450/$360
10 lineas BREDS1 $95 BREDS10 $50 $50/$40 $500/$400

PROCESO DE ACTIVACION PLAN VOLTE BUSINESS RED SIN FRONTERAS
1 linea BREDSF1 $100 BREDSF1 $100 $100/$100 $100/$90
2 lineas BREDSF1 $100 BREDSF2 $80 $90/$80 $180/$160
3 lineas BREDSF1 $100 BREDSF3 $45 $75/$65 $225/$195
4 lineas BREDSF1 $100 BREDSF4 $35 $65/$55 $260/$220
5 lineas BREDSF1 $100 BREDSF5 $40 $60/$50 $300/$250
6 lineas BREDSF1 $100 BREDSF6 $30 $55/$45 $330/$270
7 lineas BREDSF1 $100 BREDSF7 $55 $55/$45 $385/$315
8 lineas BREDSF1 $100 BREDSF8 $55 $55/$45 $440/$360
9 lineas BREDSF1 $100 BREDSF9 $55 $55/$45 $495/$405
10 lineas BREDSF1 $100 BREDSF10 $55 $55/$45 $550/$450
`;

test('extrae los cuatro modulos Business Red multilinea desde el boletin PDF', () => {
  const result = parseBusinessRedMultilineaText(pdfTextSample, {
    fileName: 'Boletin Nuevos Planes Multilineas Business Red PYMES-SUB-240802-rv.pdf',
    sourceId: 'fuente-pdf',
  });

  assert.equal(result.modulos.length, 4);
  assert.deepEqual(result.modulos.map((m) => m.seccion_key), [
    'business_red_plus',
    'business_red_extreme',
    'business_red_supreme',
    'business_red_sin_fronteras',
  ]);

  const plus = result.modulos[0];
  assert.equal(plus.titulo, 'Business Red PLUS');
  assert.equal(plus.orden, 15);
  assert.equal(plus.contenido.lineas[0].codigo, 'BREDP1');
  assert.equal(plus.contenido.lineas[9].codigo, 'BREDP10');
  assert.equal(plus.contenido.activacion.filas[9].total_regular, '$350');
  assert.equal(plus.contenido.activacion.filas[9].total_autopay, '$250');

  const sinFronteras = result.modulos[3];
  assert.equal(sinFronteras.contenido.activacion.filas[0].total_autopay, '$90');
  assert.equal(sinFronteras.contenido.activacion.filas[9].codigo_sistema, 'BREDSF10');
});

test('admin expone el flujo para publicar planes Business Red desde fuente PDF', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');
  const route = await readFile(new URL('../src/routes/motorOfertasRoutes.js', import.meta.url), 'utf8');

  assert.match(app, /Business Red multilinea/);
  assert.match(app, /omPreviewBusinessRedPlanes/);
  assert.match(app, /api\/motor-ofertas\/preview-business-red-multilinea/);
  assert.match(app, /api\/motor-ofertas\/publicar-business-red-multilinea/);
  assert.match(route, /post\('\/preview-business-red-multilinea'/);
  assert.match(route, /post\('\/publicar-business-red-multilinea'/);
});
