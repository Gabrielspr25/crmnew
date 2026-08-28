import { pool } from '../backend/src/db.js';

try {
  const modules = await pool.query(
    `SELECT id, pagina, seccion_key, titulo, activo, orden
       FROM public.planes_modulos
      WHERE pagina IN ('claro_tv', 'fijos')
      ORDER BY pagina, orden, id`
  );
  const publications = await pool.query(
    `SELECT id, numero, categoria, estado, fuente_nombre, fecha_actualizacion_base, publicada_en,
            jsonb_array_length(COALESCE(modulos_generados, '[]'::jsonb)) AS modulos_generados
       FROM public.bases_informativas_publicaciones
      WHERE categoria IN ('claro_tv', 'fijo')
      ORDER BY categoria, numero DESC
      LIMIT 20`
  );
  console.log(JSON.stringify({ modules: modules.rows, publications: publications.rows }, null, 2));
} finally {
  await pool.end();
}
