import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env'), override: true });
const { pool } = await import('../src/db.js');

const apply = process.argv.includes('--apply');
const expectedIndex = process.argv.indexOf('--expect');
const expected = expectedIndex >= 0 ? Number.parseInt(process.argv[expectedIndex + 1], 10) : null;

const targetsSql = `
  SELECT s.id,
         b.ban_number,
         s.phone AS suscriptor,
         s.plan,
         s.price_code,
         s.monthly_value AS anterior,
         candidate.soc AS soc_catalogo,
         candidate.monthly_rate AS nuevo
    FROM public.subscribers s
    JOIN public.bans b ON b.id = s.ban_id
    JOIN LATERAL (
      SELECT p.soc, p.monthly_rate
        FROM public.plan_rate_catalog p
       WHERE p.monthly_rate > 0
         AND p.soc IN (
           NULLIF(upper(trim(s.price_code)), ''),
           NULLIF(upper(trim(s.plan)), '')
         )
       ORDER BY CASE
         WHEN p.soc = NULLIF(upper(trim(s.price_code)), '') THEN 0
         ELSE 1
       END
       LIMIT 1
    ) candidate ON true
   WHERE s.monthly_value IS NULL OR s.monthly_value <= 0
`;

const client = await pool.connect();
try {
  const preview = await client.query(`${targetsSql} ORDER BY b.ban_number, s.phone`);
  console.log(JSON.stringify({
    modo: apply ? 'aplicar' : 'simulacion',
    candidatas: preview.rowCount,
    lineas: preview.rows,
  }, null, 2));

  if (!apply) process.exit(0);
  if (!Number.isInteger(expected) || expected < 0) {
    throw new Error('Para aplicar se requiere --expect <cantidad>. Ejemplo: --apply --expect 9');
  }
  if (preview.rowCount !== expected) {
    throw new Error(`La simulacion encontro ${preview.rowCount} lineas, pero se aprobaron ${expected}. No se aplico nada.`);
  }

  await client.query('BEGIN');
  try {
    const updated = await client.query(`
      WITH targets AS (${targetsSql})
      UPDATE public.subscribers s
         SET monthly_value = targets.nuevo,
             updated_at = now()
        FROM targets
       WHERE s.id = targets.id
       RETURNING s.id, s.monthly_value
    `);
    if (updated.rowCount !== expected) {
      throw new Error(`Se actualizaron ${updated.rowCount} lineas; se esperaban ${expected}.`);
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ aplicadas: updated.rowCount }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
} finally {
  client.release();
  await pool.end();
}
