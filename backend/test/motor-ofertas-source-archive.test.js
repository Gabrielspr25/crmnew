import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const servicePath = '../src/services/motorOfertasSourceArchive.js';

async function loadService() {
  try {
    return await import(servicePath);
  } catch (error) {
    assert.fail(`falta motorOfertasSourceArchive.js: ${error.message}`);
  }
}

async function createTempRoot(t) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'motor-ofertas-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  return rootDir;
}

test('archiva con clave fisica canonica independiente del nombre original', async (t) => {
  const { archiveOfferSource } = await loadService();
  const rootDir = await createTempRoot(t);
  const buffer = Buffer.from('contenido oficial');
  const expectedSha256 = createHash('sha256').update(buffer).digest('hex');

  const result = await archiveOfferSource({
    rootDir,
    type: 'tabla_financiamiento',
    originalName: '../../Tabla: Ofertas?.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });

  assert.equal(result.sha256, expectedSha256);
  assert.equal(result.originalName, '../../Tabla: Ofertas?.xlsx');
  assert.equal(
    result.archivedName,
    `${expectedSha256}-tabla_financiamiento.xlsx`
  );
  assert.equal(
    result.relativePath,
    path.join('tabla_financiamiento', result.archivedName)
  );
  assert.equal(path.isAbsolute(result.relativePath), false);
  assert.doesNotMatch(result.relativePath, /\.\./);
  assert.deepEqual(
    await readFile(path.join(rootDir, result.relativePath)),
    buffer
  );
});

test('rechaza contenido que no sea Buffer', async (t) => {
  const { archiveOfferSource } = await loadService();
  const rootDir = await createTempRoot(t);

  await assert.rejects(
    archiveOfferSource({
      rootDir,
      type: 'lista_precios',
      originalName: 'precios.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: 'contenido',
    }),
    /Buffer/
  );
});

test('rechaza rutas y tipos con segmentos suministrados por el cliente', async (t) => {
  const { archiveOfferSource } = await loadService();
  const rootDir = await createTempRoot(t);
  const baseSource = {
    rootDir,
    type: 'boletin',
    originalName: 'boletin.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('pdf'),
  };

  await assert.rejects(
    archiveOfferSource({ ...baseSource, relativePath: '../../fuera.pdf' }),
    /ruta/i
  );
  await assert.rejects(
    archiveOfferSource({ ...baseSource, type: '../boletin' }),
    /tipo/i
  );
});

test('rechaza un archivo existente cuyo contenido no coincide con el hash', async (t) => {
  const { archiveOfferSource } = await loadService();
  const rootDir = await createTempRoot(t);
  const source = {
    rootDir,
    type: 'seguro',
    originalName: 'seguro.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('contenido seguro'),
  };

  const first = await archiveOfferSource(source);
  const archivedPath = path.join(rootDir, first.relativePath);
  await writeFile(archivedPath, Buffer.from('contenido existente'));

  await assert.rejects(
    archiveOfferSource(source),
    /integridad/i
  );
});

test('rechaza una ruta canonica existente que no sea archivo regular', async (t) => {
  const { archiveOfferSource } = await loadService();
  const rootDir = await createTempRoot(t);
  const buffer = Buffer.from('contenido seguro');
  const digest = createHash('sha256').update(buffer).digest('hex');
  const canonicalPath = path.join(
    rootDir,
    'seguro',
    `${digest}-seguro.pdf`
  );
  await mkdir(canonicalPath, { recursive: true });

  await assert.rejects(
    archiveOfferSource({
      rootDir,
      type: 'seguro',
      originalName: 'seguro.pdf',
      mimeType: 'application/pdf',
      buffer,
    }),
    /archivo regular/i
  );
});

test('reutiliza un unico archivo fisico para el mismo hash con nombres distintos', async (t) => {
  const { archiveOfferSource } = await loadService();
  const rootDir = await createTempRoot(t);
  const buffer = Buffer.from('mismo contenido oficial');

  const first = await archiveOfferSource({
    rootDir,
    type: 'boletin',
    originalName: 'boletin-julio.pdf',
    mimeType: 'application/pdf',
    buffer,
  });
  const second = await archiveOfferSource({
    rootDir,
    type: 'boletin',
    originalName: 'copia-renombrada.pdf',
    mimeType: 'application/pdf',
    buffer,
  });

  assert.equal(second.archivedName, first.archivedName);
  assert.equal(second.relativePath, first.relativePath);
  assert.deepEqual(await readdir(path.join(rootDir, 'boletin')), [
    first.archivedName,
  ]);
});

test('publica una sola fuente canonica bajo llamadas concurrentes', async (t) => {
  const { archiveOfferSource } = await loadService();
  const rootDir = await createTempRoot(t);
  const buffer = Buffer.from('contenido concurrente');

  const results = await Promise.all(
    Array.from({ length: 12 }, (_, index) => archiveOfferSource({
      rootDir,
      type: 'lista_precios',
      originalName: `lista-${index}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    }))
  );

  assert.equal(new Set(results.map((result) => result.relativePath)).size, 1);
  assert.deepEqual(await readdir(path.join(rootDir, 'lista_precios')), [
    results[0].archivedName,
  ]);
  assert.deepEqual(
    await readFile(path.join(rootDir, results[0].relativePath)),
    buffer
  );
});

test('archiva aunque originalName exceda el limite usual del filesystem', async (t) => {
  const { archiveOfferSource } = await loadService();
  const rootDir = await createTempRoot(t);
  const originalName = `${'nombre-muy-largo-'.repeat(1000)}.xlsx`;

  const result = await archiveOfferSource({
    rootDir,
    type: 'tabla_financiamiento',
    originalName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('contenido largo'),
  });

  assert.equal(result.originalName, originalName);
  assert.match(result.archivedName, /^[a-f0-9]{64}-tabla_financiamiento\.xlsx$/);
  assert.deepEqual(
    await readFile(path.join(rootDir, result.relativePath)),
    Buffer.from('contenido largo')
  );
});

test('rechaza MIME sin extension canonica permitida', async (t) => {
  const { archiveOfferSource } = await loadService();
  const rootDir = await createTempRoot(t);

  await assert.rejects(
    archiveOfferSource({
      rootDir,
      type: 'boletin',
      originalName: 'boletin.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('binario'),
    }),
    /MIME/i
  );
});

test('construye un manifiesto estable ordenado por type y sha256', async () => {
  const { buildSourcesManifest } = await loadService();
  const sources = [
    { type: 'lista_precios', sha256: 'b'.repeat(64) },
    { type: 'tabla_financiamiento', sha256: 'a'.repeat(64) },
    { type: 'boletin', sha256: 'c'.repeat(64) },
  ];
  const expectedEntries = [sources[2], sources[0], sources[1]];
  const expectedSha256 = createHash('sha256')
    .update(JSON.stringify(expectedEntries))
    .digest('hex');

  const forward = buildSourcesManifest(sources);
  const reverse = buildSourcesManifest([...sources].reverse());

  assert.deepEqual(forward.entries, expectedEntries);
  assert.equal(forward.sha256, expectedSha256);
  assert.deepEqual(reverse, forward);
  assert.deepEqual(sources, [
    { type: 'lista_precios', sha256: 'b'.repeat(64) },
    { type: 'tabla_financiamiento', sha256: 'a'.repeat(64) },
    { type: 'boletin', sha256: 'c'.repeat(64) },
  ]);
});

test('manifiesto ignora renombrado, MIME y rutas de las fuentes', async () => {
  const { buildSourcesManifest } = await loadService();
  const sha = 'd'.repeat(64);

  const first = buildSourcesManifest([{
    type: 'boletin',
    sha256: sha,
    originalName: 'original.pdf',
    mimeType: 'application/pdf',
    relativePath: 'boletin/ruta-uno.pdf',
  }]);
  const renamed = buildSourcesManifest([{
    type: 'boletin',
    sha256: sha,
    originalName: 'renombrado.pdf',
    mimeType: 'application/x-pdf',
    relativePath: 'otra/ruta-dos.pdf',
  }]);

  assert.deepEqual(first, renamed);
  assert.deepEqual(first.entries, [{ type: 'boletin', sha256: sha }]);
});

test('manifiesto rechaza tipos duplicados', async () => {
  const { buildSourcesManifest } = await loadService();

  assert.throws(
    () => buildSourcesManifest([
      { type: 'seguro', sha256: 'a'.repeat(64) },
      { type: 'seguro', sha256: 'b'.repeat(64) },
    ]),
    /tipo duplicado/i
  );
});

test('manifiesto rechaza SHA-256 con formato invalido', async () => {
  const { buildSourcesManifest } = await loadService();

  assert.throws(
    () => buildSourcesManifest([
      { type: 'seguro', sha256: 'no-es-un-sha-256' },
    ]),
    /SHA-256/i
  );
});
