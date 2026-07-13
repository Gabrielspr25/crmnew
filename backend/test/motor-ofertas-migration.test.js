import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migrationUrl = new URL(
  '../migrations/2026-07-12-motor-ofertas-versionado.sql',
  import.meta.url
);

async function readMigration() {
  try {
    return await readFile(migrationUrl, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

test('crea las seis tablas del motor en public', async () => {
  const sql = await readMigration();
  for (const table of [
    'motor_ofertas_versiones',
    'motor_ofertas_fuentes',
    'motor_ofertas',
    'motor_ofertas_equipos',
    'motor_ofertas_contradicciones',
    'motor_ofertas_historial',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  }
});

test('el estado de version contiene solo los seis estados aprobados', async () => {
  const sql = await readMigration();
  const block = sql.match(
    /motor_ofertas_versiones_estado_chk[\s\S]*?CHECK \(estado IN \(([\s\S]*?)\)\)/
  )?.[1];
  assert.ok(block, 'falta el CHECK de estado de version');
  const states = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(states, [
    'borrador',
    'pendiente_revision',
    'aprobada',
    'vigente',
    'reemplazada',
    'archivada',
  ]);
  assert.ok(!states.includes('contradiccion'));
  assert.ok(!states.includes('vencida'));
});

test('solo permite una version vigente por dominio', async () => {
  const sql = await readMigration();
  assert.match(
    sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS motor_ofertas_versiones_vigente_uk[\s\S]*?WHERE estado = 'vigente'/
  );
});

test('separa contradicciones y vigencia del estado de version', async () => {
  const sql = await readMigration();
  assert.match(sql, /public\.motor_ofertas_contradicciones/);
  assert.match(sql, /vigencia_documental/);
  assert.match(sql, /motor_ofertas_fuentes_vigencia_chk/);
  assert.match(sql, /motor_ofertas_vigencia_documental_chk/);
});

test('historial es append-only y las versiones no usan borrado en cascada', async () => {
  const sql = await readMigration();
  assert.match(sql, /motor_ofertas_historial_append_only/);
  assert.doesNotMatch(
    sql,
    /REFERENCES public\.motor_ofertas_versiones\(id\) ON DELETE CASCADE/
  );
});

test('snapshots de equipo pueden enlazar el catalogo actual sin depender de el', async () => {
  const sql = await readMigration();
  assert.match(
    sql,
    /equipo_lista_id INTEGER REFERENCES public\.equipos_lista\(id\) ON DELETE SET NULL/
  );
  assert.match(sql, /snapshot JSONB NOT NULL/);
});
