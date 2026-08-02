import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env'), override: true });
const { pool } = await import('../src/db.js');

const input = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!input) {
  console.error('Uso: node scripts/import-plan-rates.mjs <archivo plan_rates.CSV> [--dry-run]');
  process.exit(1);
}

function parseCatalog(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const header = lines.shift()?.split(',').map((value) => value.trim().toUpperCase()) || [];
  if (header[0] !== 'SOC' || header[1] !== 'RENT') {
    throw new Error('El catalogo debe comenzar con las columnas SOC,RENT');
  }

  const bySoc = new Map();
  let zeroRates = 0;
  for (const [index, line] of lines.entries()) {
    const [rawSoc = '', rawRate = ''] = line.split(',');
    const soc = rawSoc.trim().toUpperCase();
    const monthlyRate = Number(rawRate.trim().replace(/^\$/, ''));
    if (!soc) throw new Error(`Fila ${index + 2}: SOC vacio`);
    if (!Number.isFinite(monthlyRate) || monthlyRate < 0) {
      throw new Error(`Fila ${index + 2}: renta invalida para ${soc}`);
    }
    if (bySoc.has(soc) && bySoc.get(soc) !== monthlyRate) {
      throw new Error(`Fila ${index + 2}: SOC ${soc} tiene rentas contradictorias`);
    }
    bySoc.set(soc, monthlyRate);
    if (monthlyRate === 0) zeroRates++;
  }

  return { rows: [...bySoc.entries()].map(([soc, monthlyRate]) => ({ soc, monthlyRate })), zeroRates };
}

const file = resolve(input);
const { rows, zeroRates } = parseCatalog(await readFile(file, 'utf8'));
console.log(JSON.stringify({ file: basename(file), socs: rows.length, rentas_positivas: rows.length - zeroRates, rentas_cero: zeroRates, dry_run: dryRun }, null, 2));

if (dryRun) process.exit(0);

const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const row of rows) {
    await client.query(
      `INSERT INTO public.plan_rate_catalog (soc, monthly_rate, source_file)
       VALUES ($1, $2, $3)
       ON CONFLICT (soc) DO UPDATE
         SET monthly_rate = EXCLUDED.monthly_rate,
             source_file = EXCLUDED.source_file,
             imported_at = now(),
             updated_at = now()`,
      [row.soc, row.monthlyRate, basename(file)],
    );
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ imported: rows.length, source_file: basename(file) }, null, 2));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
