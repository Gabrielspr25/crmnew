import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { requireAdmin, requireAuth } from '../src/auth.js';
import {
  createCambiarEstadoBaseInformativaHandler,
  createGuardarBaseBorradoresHandler,
  createPreviewBaseHandler,
  createPublicarBaseInformativaHandler,
} from '../src/routes/fuentesComercialesRoutes.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar';
const UUID = '11111111-1111-4111-8111-111111111111';

function tokenFor(rol) {
  return jwt.sign({ nick: `user-${rol}`, rol }, SECRET, { expiresIn: '1h' });
}

function previewItem(categoria, total) {
  const candidatos = Array.from({ length: total }, (_, index) => ({
    categoria,
    seccion_key: categoria === 'fijo' ? 'fijo_telefonia' : 'claro_tv_planes',
    codigo: `${categoria}-${index + 1}`,
    descripcion: `${categoria} ${index + 1}`,
  }));
  return {
    categoria,
    pagina: categoria === 'fijo' ? 'fijos' : 'claro_tv',
    estado_sugerido: 'borrador',
    publicable: true,
    fuente_comercial_id: UUID,
    fuente_nombre: 'fuente.pdf',
    fuente_sha256: 'a'.repeat(64),
    fecha_actualizacion_base: '2026-08-16',
    registros_normalizados: candidatos,
    candidatos_publicos: candidatos,
    modulos_generados: [{ pagina: categoria, seccion_key: `${categoria}_modulo`, contenido: { filas: candidatos } }],
    contenido_excluido: [],
    auditoria: { original: {} },
    duplicados: [],
    validacion: { errores: [], advertencias: [] },
    diferencias: { modulos: {}, registros: {} },
    resumen: { total_candidatos: total },
  };
}

function buildPreviewResult(parsed, fuente) {
  return {
    fuente,
    previews: [
      previewItem('fijo', 81),
      previewItem('claro_tv', 9),
    ],
  };
}

function makePool(sourceRows = []) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      assert.doesNotMatch(sql, /\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);
      assert.doesNotMatch(sql, /planes_modulos/i);
      assert.match(sql, /FROM public\.fuentes_comerciales WHERE id=\$1 LIMIT 1/);
      return { rows: sourceRows };
    },
  };
}

function publicacionRow(categoria, estado = 'borrador') {
  return {
    id: `${categoria === 'fijo' ? '22222222' : '33333333'}-2222-4222-8222-222222222222`,
    numero: categoria === 'fijo' ? 1 : 2,
    categoria,
    estado,
    version_etiqueta: `${categoria}-2026-08-16`,
    fuente_comercial_id: UUID,
    fuente_nombre: 'fuente.pdf',
    fuente_sha256: 'a'.repeat(64),
    fecha_actualizacion_base: '2026-08-16',
    candidatos_publicos: previewItem(categoria, categoria === 'fijo' ? 81 : 9).candidatos_publicos,
    modulos_generados: previewItem(categoria, categoria === 'fijo' ? 81 : 9).modulos_generados,
    validacion: { errores: [], advertencias: [] },
    diferencias: { modulos: {}, registros: {} },
    cargada_por: 'admin',
  };
}

async function request(app, method, url, { token, body } = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json();
    return { status: response.status, json };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function makeApp({ pool, parser = async () => ({ ok: true }), previewBuilder = buildPreviewResult, uploadDir }) {
  const app = express();
  app.use(express.json());
  app.use('/api/fuentes-comerciales', requireAuth);
  app.post('/api/fuentes-comerciales/:id/preview-base', requireAdmin, createPreviewBaseHandler({
    pool,
    runParser: parser,
    buildPreviews: previewBuilder,
    uploadDir,
    logger: { error() {} },
  }));
  return app;
}

function makeDraftApp({ pool, parser = async () => ({ ok: true }), previewBuilder = buildPreviewResult, uploadDir }) {
  const app = express();
  app.use(express.json());
  app.use('/api/fuentes-comerciales', requireAuth);
  app.post('/api/fuentes-comerciales/:id/preview-base/borradores', requireAdmin, createGuardarBaseBorradoresHandler({
    pool,
    runParser: parser,
    buildPreviews: previewBuilder,
    uploadDir,
    logger: { error() {} },
  }));
  return app;
}

function makeStateApp({ pool }) {
  const app = express();
  app.use(express.json());
  app.use('/api/fuentes-comerciales', requireAuth);
  app.post('/api/fuentes-comerciales/bases-informativas/:id/validar', requireAdmin, createCambiarEstadoBaseInformativaHandler({
    pool,
    estadoOrigen: 'borrador',
    estadoDestino: 'validada',
    campos: ['validada_por', 'validada_en'],
  }));
  app.post('/api/fuentes-comerciales/bases-informativas/:id/aprobar', requireAdmin, createCambiarEstadoBaseInformativaHandler({
    pool,
    estadoOrigen: 'validada',
    estadoDestino: 'aprobada',
    campos: ['aprobada_por', 'aprobada_en'],
  }));
  app.post('/api/fuentes-comerciales/bases-informativas/:id/publicar', requireAdmin, createPublicarBaseInformativaHandler({ pool }));
  return app;
}

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fuentes-preview-'));
  const uploads = path.join(root, 'uploads');
  fs.mkdirSync(uploads);
  const pdf = path.join(uploads, 'fuente.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n');
  return { root, uploads, pdf, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function source(overrides = {}) {
  return {
    id: UUID,
    familia: 'fijos',
    titulo: 'Fuente Fijo',
    documento_tipo: 'pdf',
    nombre_original: 'fuente.pdf',
    nombre_archivado: 'fuente.pdf',
    ruta_relativa: 'fuente.pdf',
    sha256: 'a'.repeat(64),
    vigencia_desde: '2026-01-01',
    vigencia_hasta: null,
    vigencia_documental: 'vigente',
    estado: 'activa',
    ...overrides,
  };
}

test('preview-base exige sesion valida y rol administrativo reales', async () => {
  const ws = makeWorkspace();
  try {
    const app = makeApp({ pool: makePool([source()]), uploadDir: ws.uploads });

    const anon = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(anon.status, 401);

    const vendedor = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('vendedor'),
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(vendedor.status, 403);
  } finally {
    ws.cleanup();
  }
});

test('preview-base valida UUID y consulta la fuente solo por id', async () => {
  const ws = makeWorkspace();
  try {
    const pool = makePool([source()]);
    const app = makeApp({ pool, uploadDir: ws.uploads });
    const invalid = await request(app, 'POST', '/api/fuentes-comerciales/no-uuid/preview-base', {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.json.codigo, 'uuid_invalido');
    assert.equal(pool.queries.length, 0);
  } finally {
    ws.cleanup();
  }
});

test('preview-base detecta fecha clara del boletin y solo exige fecha manual si no hay fecha confiable', async () => {
  const ws = makeWorkspace();
  try {
    const app = makeApp({
      pool: makePool([source({
        nombre_original: 'LISTADO_ESTRUCTURA_PLANES_PYMESNEGOCIOS_TODOS_2026_15_260330.pdf',
      })]),
      uploadDir: ws.uploads,
    });

    const detected = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: {},
    });
    assert.equal(detected.status, 200);
    assert.equal(detected.json.fecha_actualizacion_base, '2026-03-30');
    assert.equal(detected.json.fecha_actualizacion_base_origen, 'nombre_archivo_confirmado');

    const invalid = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-02-31' },
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.json.codigo, 'fecha_actualizacion_base_invalida');

    const ok = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.fecha_actualizacion_base, '2026-08-16');
    assert.equal(ok.json.fecha_actualizacion_base_origen, 'entrada_manual_confirmada');

    const missing = await request(makeApp({ pool: makePool([source()]), uploadDir: ws.uploads }), 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: {},
    });
    assert.equal(missing.status, 400);
    assert.equal(missing.json.codigo, 'fecha_actualizacion_base_requerida');
  } finally {
    ws.cleanup();
  }
});

test('preview-base maneja fuente inexistente y archivo inexistente', async () => {
  const ws = makeWorkspace();
  try {
    const notFoundSource = await request(makeApp({ pool: makePool([]), uploadDir: ws.uploads }), 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(notFoundSource.status, 404);
    assert.equal(notFoundSource.json.codigo, 'fuente_no_encontrada');

    const missingFile = await request(makeApp({ pool: makePool([source({ ruta_relativa: 'missing.pdf' })]), uploadDir: ws.uploads }), 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(missingFile.status, 404);
    assert.equal(missingFile.json.codigo, 'archivo_no_encontrado');
  } finally {
    ws.cleanup();
  }
});

test('preview-base bloquea escape de directorio y symlink fuera del directorio permitido', async (t) => {
  const ws = makeWorkspace();
  try {
    const outside = path.join(ws.root, 'outside.pdf');
    fs.writeFileSync(outside, '%PDF-1.4\n');
    const escape = await request(makeApp({ pool: makePool([source({ ruta_relativa: '../outside.pdf' })]), uploadDir: ws.uploads }), 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(escape.status, 404);
    assert.equal(escape.json.codigo, 'archivo_fuera_directorio');

    const symlink = path.join(ws.uploads, 'link.pdf');
    try {
      fs.symlinkSync(outside, symlink, 'file');
    } catch (error) {
      if (['EPERM', 'EACCES'].includes(error.code)) {
        t.skip('El sistema no permite crear symlinks para esta prueba.');
        return;
      }
      throw error;
    }
    const linked = await request(makeApp({ pool: makePool([source({ ruta_relativa: 'link.pdf' })]), uploadDir: ws.uploads }), 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(linked.status, 404);
    assert.equal(linked.json.codigo, 'archivo_fuera_directorio');
  } finally {
    ws.cleanup();
  }
});

test('preview-base ignora rutas del body y usa el archivo guardado', async () => {
  const ws = makeWorkspace();
  try {
    let parserFilePath = null;
    const parser = async (_script, filePath) => {
      parserFilePath = filePath;
      return { ok: true };
    };
    const app = makeApp({ pool: makePool([source()]), parser, uploadDir: ws.uploads });
    const res = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-08-16', ruta: '../outside.pdf', filePath: 'C:/secreto.pdf' },
    });
    assert.equal(res.status, 200);
    assert.equal(path.basename(parserFilePath), 'fuente.pdf');
  } finally {
    ws.cleanup();
  }
});

test('preview-base devuelve Fijo 81 y Claro TV 9 sin mezclar categorias ni exponer rutas', async () => {
  const ws = makeWorkspace();
  try {
    const app = makeApp({ pool: makePool([source()]), uploadDir: ws.uploads });
    const res = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.resumen.fijo, 81);
    assert.equal(res.json.resumen.claro_tv, 9);
    assert.equal(res.json.previews.fijo.candidatos_publicos.length, 81);
    assert.equal(res.json.previews.claro_tv.candidatos_publicos.length, 9);
    assert.ok(res.json.previews.fijo.candidatos_publicos.every((item) => item.categoria === 'fijo'));
    assert.ok(res.json.previews.claro_tv.candidatos_publicos.every((item) => item.categoria === 'claro_tv'));
    const serialized = JSON.stringify(res.json);
    assert.doesNotMatch(serialized, /ruta_relativa|nombre_archivado|filePath|allowedRoot|stderr|outside\.pdf|uploads/);
  } finally {
    ws.cleanup();
  }
});

test('preview-base responde errores de parser sanitizados', async () => {
  const ws = makeWorkspace();
  try {
    for (const code of ['parser_timeout', 'parser_output_too_large', 'parser_json_invalido', 'parser_exit_error', 'parser_process_error']) {
      const parser = async () => {
        const error = new Error(`detalle interno ${ws.uploads} stderr secreto`);
        error.code = code;
        throw error;
      };
      const app = makeApp({ pool: makePool([source()]), parser, uploadDir: ws.uploads });
      const res = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
        token: tokenFor('admin'),
        body: { fecha_actualizacion_base: '2026-08-16' },
      });
      assert.equal(res.status, 422);
      assert.equal(res.json.codigo, code);
      assert.doesNotMatch(JSON.stringify(res.json), /detalle interno|stderr|uploads|secreto/);
    }
  } finally {
    ws.cleanup();
  }
});

test('preview-base no ejecuta escrituras ni toca planes_modulos', async () => {
  const ws = makeWorkspace();
  try {
    const pool = makePool([source()]);
    const app = makeApp({ pool, uploadDir: ws.uploads });
    const res = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(res.status, 200);
    assert.equal(pool.queries.length, 1);
    assert.ok(pool.queries.every(({ sql }) => !/\bINSERT\b|\bUPDATE\b|\bDELETE\b|planes_modulos/i.test(sql)));
  } finally {
    ws.cleanup();
  }
});

test('guardar borrador ejecuta la ruta real y crea dos borradores Fijo y Claro TV con la misma fuente', async () => {
  const ws = makeWorkspace();
  try {
    const queries = [];
    const pool = {
      queries,
      async query(sql, params) {
        queries.push({ sql, params });
        assert.doesNotMatch(sql, /planes_modulos/i);
        if (/FROM public\.fuentes_comerciales WHERE id=\$1 LIMIT 1/.test(sql)) {
          return { rows: [source({ nombre_original: 'LISTADO_ESTRUCTURA_PLANES_PYMESNEGOCIOS_TODOS_2026_15_260330.pdf' })] };
        }
        if (/INSERT INTO public\.bases_informativas_publicaciones/.test(sql)) {
          return { rows: [publicacionRow(params[0], 'borrador')] };
        }
        throw new Error(`consulta inesperada: ${sql}`);
      },
    };
    const res = await request(makeDraftApp({ pool, uploadDir: ws.uploads }), 'POST', `/api/fuentes-comerciales/${UUID}/preview-base/borradores`, {
      token: tokenFor('admin'),
      body: { ruta: 'C:/ignorada.pdf' },
    });
    assert.equal(res.status, 201);
    assert.deepEqual(res.json.publicaciones.map((item) => item.categoria), ['fijo', 'claro_tv']);
    assert.ok(res.json.publicaciones.every((item) => item.fuente_comercial_id === UUID));
    assert.ok(res.json.publicaciones.every((item) => item.fuente_sha256 === 'a'.repeat(64)));
    const insertQueries = queries.filter(({ sql }) => /INSERT INTO public\.bases_informativas_publicaciones/.test(sql));
    assert.equal(insertQueries.length, 2);
    for (const { params } of insertQueries) {
      for (const index of [6, 7, 8, 9, 10, 11, 12, 13, 14]) {
        assert.equal(typeof params[index], 'string');
        assert.doesNotThrow(() => JSON.parse(params[index]));
      }
    }
  } finally {
    ws.cleanup();
  }
});

test('validar, aprobar y publicar respetan estados y delegan la proyeccion transaccional', async () => {
  let estado = 'borrador';
  const queries = [];
  const pool = {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (/UPDATE public\.bases_informativas_publicaciones/.test(sql)) {
        const estadoDestino = params[0];
        const estadoOrigen = params.at(-1);
        assert.match(sql, /WHERE id=\$\d+ AND estado=\$\d+/);
        if (estado !== estadoOrigen) return { rows: [] };
        estado = estadoDestino;
        return { rows: [publicacionRow('fijo', estado)] };
      }
      if (/SELECT \* FROM public\.publicar_base_informativa\(\$1,\$2\)/.test(sql)) {
        if (estado !== 'aprobada') throw new Error(`solo una base informativa aprobada puede publicarse; estado actual: ${estado}`);
        estado = 'publicada';
        return { rows: [publicacionRow('fijo', estado)] };
      }
      throw new Error(`consulta inesperada: ${sql}`);
    },
  };
  const app = makeStateApp({ pool });
  const token = tokenFor('admin');

  const validar = await request(app, 'POST', `/api/fuentes-comerciales/bases-informativas/${UUID}/validar`, { token });
  assert.equal(validar.status, 200);
  assert.equal(validar.json.publicacion.estado, 'validada');

  const repetirValidar = await request(app, 'POST', `/api/fuentes-comerciales/bases-informativas/${UUID}/validar`, { token });
  assert.equal(repetirValidar.status, 409);
  assert.equal(repetirValidar.json.codigo, 'transicion_invalida');

  const aprobar = await request(app, 'POST', `/api/fuentes-comerciales/bases-informativas/${UUID}/aprobar`, { token });
  assert.equal(aprobar.status, 200);
  assert.equal(aprobar.json.publicacion.estado, 'aprobada');

  const publicar = await request(app, 'POST', `/api/fuentes-comerciales/bases-informativas/${UUID}/publicar`, { token });
  assert.equal(publicar.status, 200);
  assert.equal(publicar.json.publicacion.estado, 'publicada');
  assert.ok(queries.some(({ sql }) => /publicar_base_informativa/.test(sql)));
});
