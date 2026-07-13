import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

test('archiva el Buffer por SHA-256 en una ruta relativa con nombre seguro', async (t) => {
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
  assert.equal(result.archivedName, `${expectedSha256}-Tabla_ Ofertas_.xlsx`);
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

test('reutiliza un archivo existente con el mismo hash sin reescribirlo', async (t) => {
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

  const second = await archiveOfferSource(source);

  assert.deepEqual(second, first);
  assert.deepEqual(
    await readFile(archivedPath),
    Buffer.from('contenido existente')
  );
});

test('construye un manifiesto estable ordenado por type y sha256', async () => {
  const { buildSourcesManifest } = await loadService();
  const sources = [
    { type: 'lista_precios', sha256: 'b'.repeat(64) },
    { type: 'tabla_financiamiento', sha256: 'c'.repeat(64) },
    { type: 'tabla_financiamiento', sha256: 'a'.repeat(64) },
  ];
  const expectedEntries = [sources[0], sources[2], sources[1]];
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
    { type: 'tabla_financiamiento', sha256: 'c'.repeat(64) },
    { type: 'tabla_financiamiento', sha256: 'a'.repeat(64) },
  ]);
});
