import { pool } from '../backend/src/db.js';

async function queryOrError(name, sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return { name, ok: true, rows: result.rows };
  } catch (error) {
    return { name, ok: false, error: error.message, code: error.code };
  }
}

try {
  const checks = await Promise.all([
    queryOrError('planes_modulos_claro_tv', `SELECT id, pagina, seccion_key, titulo, activo, orden FROM public.planes_modulos WHERE pagina='claro_tv' ORDER BY orden, id`),
    queryOrError('planes_modulos_fijos', `SELECT id, pagina, seccion_key, titulo, activo, orden FROM public.planes_modulos WHERE pagina='fijos' ORDER BY orden, id`),
    queryOrError('planes_modulos_moviles', `SELECT id, pagina, seccion_key, titulo, activo, orden FROM public.planes_modulos WHERE pagina='moviles' ORDER BY orden, id`),
    queryOrError('bases_informativas_public', `SELECT to_regclass('public.bases_informativas_publicaciones') AS table_name`),
    queryOrError('fuentes_comerciales_public', `SELECT to_regclass('public.fuentes_comerciales') AS table_name`),
    queryOrError('planes_fijos_publicaciones_public', `SELECT to_regclass('public.planes_fijos_publicaciones') AS table_name`),
  ]);
  console.log(JSON.stringify(checks, null, 2));
} finally {
  await pool.end();
}
