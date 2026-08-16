import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const migrationUrl = new URL('../migrations/2026-08-16-bases-informativas-publicaciones.sql', import.meta.url);
const sql = fs.readFileSync(migrationUrl, 'utf8');

test('la migracion crea una base informativa generica por categoria y ciclo de vida', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.bases_informativas_publicaciones/i);

  for (const categoria of ['fijo', 'claro_tv', 'movil', 'servicios', 'inalambrico', 'cloud']) {
    assert.match(sql, new RegExp(`'${categoria}'`));
  }

  for (const estado of [
    'borrador',
    'pendiente_validacion',
    'validada',
    'aprobada',
    'publicada',
    'reemplazada',
    'archivada',
  ]) {
    assert.match(sql, new RegExp(`'${estado}'`));
  }

  assert.match(sql, /numero BIGSERIAL UNIQUE NOT NULL/i);
  assert.match(sql, /fecha_actualizacion_base DATE NOT NULL/i);
  assert.match(sql, /fuente_comercial_id UUID REFERENCES public\.fuentes_comerciales\(id\) ON DELETE RESTRICT/i);
  assert.match(sql, /fuente_sha256 CHAR\(64\) NOT NULL/i);
});

test('la migracion conserva las salidas de extraccion, normalizacion, auditoria y validacion', () => {
  for (const columna of [
    'registros_normalizados',
    'candidatos_publicos',
    'modulos_generados',
    'contenido_excluido',
    'duplicados',
  ]) {
    assert.match(sql, new RegExp(`${columna} JSONB NOT NULL DEFAULT '\\[\\]'::jsonb`, 'i'));
    assert.match(sql, new RegExp(`jsonb_typeof\\(${columna}\\) = 'array'`, 'i'));
  }

  for (const columna of ['extraccion_original', 'auditoria', 'validacion', 'diferencias']) {
    assert.match(sql, new RegExp(`${columna} JSONB NOT NULL DEFAULT '\\{\\}'::jsonb`, 'i'));
    assert.match(sql, new RegExp(`jsonb_typeof\\(${columna}\\) = 'object'`, 'i'));
  }

  assert.match(sql, /observaciones TEXT/i);
});

test('solo una publicacion puede quedar vigente por categoria', () => {
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS bases_informativas_publicaciones_una_publicada_idx/i);
  assert.match(sql, /ON public\.bases_informativas_publicaciones \(categoria\)/i);
  assert.match(sql, /WHERE estado = 'publicada'/i);
});

test('usuarios se guardan como texto sin inventar referencias a tablas de usuarios', () => {
  for (const columna of [
    'cargada_por TEXT NOT NULL',
    'validada_por TEXT',
    'aprobada_por TEXT',
    'publicada_por TEXT',
  ]) {
    assert.match(sql, new RegExp(columna, 'i'));
  }

  assert.doesNotMatch(sql, /REFERENCES\s+public\.(users|usuarios|app_users|user_profiles)/i);
});

test('la publicacion proyecta a planes_modulos de forma transaccional y no alimenta borradores', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.publicar_base_informativa\(\s*p_publicacion_id UUID,\s*p_usuario TEXT\s*\)/i);
  assert.doesNotMatch(sql, /publicar_base_informativa\([\s\S]*p_modulos/i);
  assert.doesNotMatch(sql, /p_modulos JSONB/i);
  assert.match(sql, /SELECT \*[\s\S]+FROM public\.bases_informativas_publicaciones[\s\S]+FOR UPDATE/i);
  assert.match(sql, /IF v_publicacion\.estado <> 'aprobada' THEN/i);
  assert.match(sql, /v_modulos := v_publicacion\.modulos_generados/i);
  assert.match(sql, /UPDATE public\.bases_informativas_publicaciones[\s\S]+SET estado = 'reemplazada'/i);
  assert.match(sql, /INSERT INTO public\.planes_modulos/i);
  assert.match(sql, /ON CONFLICT \(pagina, seccion_key\) DO UPDATE/i);
  assert.match(sql, /UPDATE public\.bases_informativas_publicaciones[\s\S]+SET estado = 'publicada'/i);
  assert.match(sql, /EXCEPTION[\s\S]+RAISE/i);
});

test('la migracion congela campos comerciales despues de aprobacion', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.fn_bases_informativas_bloquear_aprobada/i);
  assert.match(sql, /OLD\.estado IN \('aprobada', 'publicada', 'reemplazada', 'archivada'\)/i);

  for (const columna of [
    'fuente_comercial_id',
    'fuente_nombre',
    'fuente_sha256',
    'extraccion_original',
    'registros_normalizados',
    'candidatos_publicos',
    'modulos_generados',
    'contenido_excluido',
    'auditoria',
    'duplicados',
    'validacion',
    'diferencias',
  ]) {
    assert.match(sql, new RegExp(`OLD\\.${columna} IS DISTINCT FROM NEW\\.${columna}`, 'i'));
  }

  assert.match(sql, /CREATE TRIGGER trg_bases_informativas_bloquear_aprobada/i);
});

test('el mapeo canonico de categorias a paginas queda definido', () => {
  const mappings = {
    fijo: 'fijos',
    claro_tv: 'claro_tv',
    movil: 'moviles',
    inalambrico: 'inalambrico',
    servicios: 'servicios',
    cloud: 'cloud',
  };

  for (const [categoria, pagina] of Object.entries(mappings)) {
    assert.match(sql, new RegExp(`WHEN '${categoria}' THEN '${pagina}'`, 'i'));
  }
});

test('publicar usa bloqueo transaccional por categoria y retira modulos ausentes', () => {
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\('bases_informativas_publicaciones:' \|\| v_publicacion\.categoria\)\)/i);
  assert.match(sql, /UPDATE public\.planes_modulos[\s\S]+SET activo = false[\s\S]+WHERE pagina = v_pagina/i);
  assert.match(sql, /NOT \(seccion_key = ANY\(v_secciones_generadas\)\)/i);
});

test('la funcion contempla reversa atomica si falla un modulo', () => {
  assert.match(sql, /IF v_seccion_key IS NULL THEN[\s\S]+RAISE EXCEPTION/i);
  assert.match(sql, /IF jsonb_typeof\(v_modulos\) <> 'array' THEN[\s\S]+RAISE EXCEPTION/i);
  assert.match(sql, /EXCEPTION[\s\S]+WHEN OTHERS THEN[\s\S]+RAISE/i);
});

test('la migracion mantiene ofertas_movil_versiones separado', () => {
  assert.doesNotMatch(sql, /ALTER TABLE public\.ofertas_movil_versiones/i);
  assert.doesNotMatch(sql, /REFERENCES public\.ofertas_movil_versiones/i);
  assert.doesNotMatch(sql, /DROP TABLE public\.ofertas_movil_versiones/i);
});
