import { pool } from '../backend/src/db.js';

const keys = [
  'business_red_plus',
  'business_red_extreme',
  'business_red_supreme',
  'business_red_sin_fronteras',
];

try {
  const before = await pool.query(
    `SELECT seccion_key, activo
       FROM public.planes_modulos
      WHERE pagina=$1 AND seccion_key = ANY($2::text[])
      ORDER BY orden, id`,
    ['moviles', keys]
  );

  const updated = await pool.query(
    `UPDATE public.planes_modulos
        SET activo=false, updated_by=$1, updated_at=now()
      WHERE pagina=$2 AND seccion_key = ANY($3::text[])
      RETURNING seccion_key, activo`,
    ['limpieza_legacy_codex', 'moviles', keys]
  );

  const after = await pool.query(
    `SELECT seccion_key, activo
       FROM public.planes_modulos
      WHERE pagina=$1 AND seccion_key = ANY($2::text[])
      ORDER BY orden, id`,
    ['moviles', keys]
  );

  console.log(JSON.stringify({ before: before.rows, updated: updated.rows, after: after.rows }, null, 2));
} finally {
  await pool.end();
}
