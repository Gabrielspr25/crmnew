import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInalambricoModuleContent, inalambricoVigenciaDesdeNombre } from '../src/routes/fuentesComercialesRoutes.js';

const parser = new URL('../../scripts/parse_equipos_pdf.py', import.meta.url);
const route = fs.readFileSync(new URL('../src/routes/fuentesComercialesRoutes.js', import.meta.url), 'utf8');
const fixture = new URL('../../documentos-ofertas/inalambrico-iot/2026-07-25--Boletin-INT-Go-Claro-Oficina-IoT-1al30junio2026-CORP.pdf', import.meta.url);

function parseFixture() {
  assert.equal(fs.existsSync(fileURLToPath(fixture)), true, 'falta el boletin canonico de inalambrico/IoT');
  const run = spawnSync('python', [fileURLToPath(parser), fileURLToPath(fixture)], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

test('detecta vigencia inalambrica desde nombres con meses en espanol sin parchear un mes especifico', () => {
  assert.deepEqual(
    inalambricoVigenciaDesdeNombre('Boletin INT Go, Claro Oficina y IoT 1al31ago2026- CORP.pdf'),
    { desde: '2026-08-01T04:00:00.000Z', hasta: '2026-08-31T04:00:00.000Z' }
  );
  assert.deepEqual(
    inalambricoVigenciaDesdeNombre('Boletin INT Go, Claro Oficina y IoT 1al30sept2026- CORP.pdf'),
    { desde: '2026-09-01T04:00:00.000Z', hasta: '2026-09-30T04:00:00.000Z' }
  );
  assert.deepEqual(
    inalambricoVigenciaDesdeNombre('Boletin INT Go, Claro Oficina y IoT 1al31oct2026- CORP.pdf'),
    { desde: '2026-10-01T04:00:00.000Z', hasta: '2026-10-31T04:00:00.000Z' }
  );
  assert.deepEqual(
    inalambricoVigenciaDesdeNombre('Boletin INT Go, Claro Oficina y IoT 15al15ene2027- CORP.pdf'),
    { desde: '2027-01-15T04:00:00.000Z', hasta: '2027-01-15T04:00:00.000Z' }
  );
  assert.equal(inalambricoVigenciaDesdeNombre('Boletin INT Go sin vigencia clara.pdf'), null);
});

test('el parser reconstruye filas completas de MiFi cuando el PDF nuevo entrega una linea textual continua', () => {
  const code = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.dirname(fileURLToPath(parser)))})
import parse_equipos_pdf as parser
text = """MiFi's exclusivos para Internet On The Go
33638H 7013126 Franklin JEXstream RG2100 5G $249.99 $25.00 $12.50 $10.00 $8.33 $299.99 $299.99 $299.99 $299.99 $139.99 $99.99 $99.99 $0.00"""
print(json.dumps(parser.parse_main_equipment_lines(text), ensure_ascii=True))
`;
  const run = spawnSync('python', ['-c', code], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const parsed = JSON.parse(run.stdout);
  assert.deepEqual(parsed.claro_oficina, []);
  assert.equal(parsed.internet_on_the_go.length, 1);
  assert.deepEqual(parsed.internet_on_the_go[0], {
    item_code: '33638H',
    material_sap: '7013126',
    modelo: 'Franklin JEXstream RG2100 5G',
    precio_regular: 249.99,
    fin_12: 25,
    fin_24: 12.5,
    fin_30: 10,
    fin_36: 8.33,
    cle_09: 299.99,
    cle_14: 299.99,
    cle_19: 299.99,
    cle_29: 299.99,
    cle_39: 139.99,
    cle_49: 99.99,
    cle_59: 99.99,
    // El boletin dice "$0.00" con plan $69: el equipo es gratis con ese plan. Antes el parser lo convertia en
    // null (sin dato) y el vendedor no veia el "gratis".
    cle_69: 0,
  });
});

test('el boletin agosto reconoce Internet On The Go, Claro Oficina e IoT antes de reemplazar Inalambrico', () => {
  const parsed = parseFixture();
  assert.deepEqual(parsed.secciones_detectadas, ['internet_on_the_go', 'claro_oficina', 'iot_telemetria']);
});

test('normaliza ofertas especiales de equipos por producto, plan, plazo y codigo', () => {
  const parsed = parseFixture();
  const offers = parsed.ofertas_especiales_normalizadas;

  assert.equal(offers.length, 5);

  assert.deepEqual(
    offers.map((offer) => [offer.equipo, offer.producto, offer.precio_oferta, offer.plazo_meses, offer.plan_minimo, offer.plan_exacto, offer.convergente, offer.codigos]),
    [
      ['Sense Connect SC421', 'Claro Hogar', 29.99, [24], 30, null, null, []],
      ['PCD R402X', 'Claro Oficina', 0, [24], 30, null, null, []],
      ['Franklin RT 410', 'Internet On The Go', 0, [24], 30, null, true, ['FIOF']],
      ['Franklin RT 410', 'Internet On The Go', 41.99, [24, 36], null, null, true, ['FIGU']],
      ['Franklin CG890', 'Claro Oficina', 0, [24], null, 50, null, []],
    ]
  );

  const rt410Fiof = parsed.financiamiento_of.find((item) => item.item_code === '32788H' && /RT\s*410/i.test(item.modelo || '') && /Gratis/i.test(item.nota || ''));
  assert.ok(rt410Fiof);
  assert.equal(rt410Fiof.material_sap, '7010844');
  assert.equal(rt410Fiof.precio_regular, 99.99);
  assert.equal(rt410Fiof.fin_24, 4.17);

  const rt410Figu = parsed.financiamiento_gu.find((item) => item.item_code === '32788H' && /RT\s*410/i.test(item.modelo || ''));
  assert.ok(rt410Figu);
  assert.equal(rt410Figu.precio_regular, 41.99);
  assert.equal(rt410Figu.fin_24, 1.75);
  assert.equal(rt410Figu.fin_36, 1.17);
});

test('una fuente inalambrica valida actualiza solo Inalambrico y conserva el contenido publicado', () => {
  assert.match(route, /applyInalambricoFuenteAutomatica/);
  assert.match(route, /WHERE pagina='inalambrico' AND activo=true/);
  assert.doesNotMatch(route, /contenido=contenido/);
  assert.match(route, /secciones_detectadas/);
  assert.match(route, /familia === 'inalambrico_iot' && fuenteRow\.documento_tipo === 'pdf' && modoPublicacion !== 'borrador'/);
  assert.match(route, /versioning\.action === 'reuse_failed'/);
  assert.match(route, /sourcePath\(fuenteRow\)/);
});

test('proyecta equipos, financiamiento y ofertas especiales sin inventar planes faltantes', () => {
  const parsed = parseFixture();
  const actual = {
    internet_on_the_go: {
      planes_solo: [{ codigo: 'IOTG30', precio: 30 }],
      planes_convergente: [{ codigo: 'IOTG30C', precio: 30 }],
      backup: [{ codigo: 'BACKUP20', precio: 20 }],
    },
    claro_oficina: {
      planes: [{ codigo: 'CO50', precio: 50 }],
    },
    iot_telemetria: {
      planes: [{ codigo: 'IOT10', precio: 10 }],
    },
    equipos_precios_inalambrico: {
      secciones: [],
      financiamiento_of: [],
      financiamiento_gu: [],
    },
  };

  const internet = buildInalambricoModuleContent('internet_on_the_go', actual.internet_on_the_go, parsed);
  const oficina = buildInalambricoModuleContent('claro_oficina', actual.claro_oficina, parsed);
  const iot = buildInalambricoModuleContent('iot_telemetria', actual.iot_telemetria, parsed);
  const precios = buildInalambricoModuleContent('equipos_precios_inalambrico', actual.equipos_precios_inalambrico, parsed);

  assert.deepEqual(internet.planes_solo, actual.internet_on_the_go.planes_solo);
  assert.deepEqual(internet.backup, actual.internet_on_the_go.backup);
  assert.equal(internet.financiamiento_of.length, 4);
  assert.equal(internet.financiamiento_gu.length, 1);
  assert.equal(internet.ofertas_especiales_normalizadas.length, 5);

  assert.deepEqual(oficina.planes, actual.claro_oficina.planes);
  assert.equal(oficina.equipos.length, 54);
  assert.equal(oficina.ofertas_especiales_normalizadas.length, 5);

  assert.deepEqual(iot.planes, actual.iot_telemetria.planes);
  assert.deepEqual(iot.secciones_detectadas, ['internet_on_the_go', 'claro_oficina', 'iot_telemetria']);

  assert.equal(precios.secciones.length, 1);
  assert.equal(precios.financiamiento_of.length, 4);
  assert.equal(precios.financiamiento_gu.length, 1);
  assert.equal(precios.ofertas_especiales_normalizadas.length, 5);
});
