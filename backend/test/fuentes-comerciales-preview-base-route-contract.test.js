import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { requireAdmin, requireAuth } from '../src/auth.js';
import { createPreviewBaseHandler } from '../src/routes/fuentesComercialesRoutes.js';

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
      previewItem('fijo', 80),
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

test('preview-base exige fecha manual confirmada y valida fecha real', async () => {
  const ws = makeWorkspace();
  try {
    const app = makeApp({ pool: makePool([source()]), uploadDir: ws.uploads });

    const missing = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: {},
    });
    assert.equal(missing.status, 400);
    assert.equal(missing.json.codigo, 'fecha_actualizacion_base_requerida');

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

test('preview-base devuelve Fijo 80 y Claro TV 9 sin mezclar categorias ni exponer rutas', async () => {
  const ws = makeWorkspace();
  try {
    const app = makeApp({ pool: makePool([source()]), uploadDir: ws.uploads });
    const res = await request(app, 'POST', `/api/fuentes-comerciales/${UUID}/preview-base`, {
      token: tokenFor('admin'),
      body: { fecha_actualizacion_base: '2026-08-16' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.resumen.fijo, 80);
    assert.equal(res.json.resumen.claro_tv, 9);
    assert.equal(res.json.previews.fijo.candidatos_publicos.length, 80);
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
