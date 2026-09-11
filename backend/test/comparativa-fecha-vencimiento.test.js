process.env.TZ = 'America/Puerto_Rico';

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appPath = resolve(process.cwd(), '..', 'frontend', 'app.html');

function extraer(html, nombre) {
  const re = new RegExp('^function ' + nombre + '\\([^)]*\\)\\{.*$', 'm');
  const m = html.match(re);
  assert.ok(m, 'no se encontro la funcion ' + nombre);
  return m[0];
}

async function cargarFechas() {
  const html = await readFile(appPath, 'utf8');
  const codigo = ['fmtDate', 'compDateOnly', 'compTodayOnly', 'compFmtDateOnly', 'compEndDate']
    .map((n) => extraer(html, n))
    .join('\n');
  return new Function(codigo + '\nreturn {fmtDate,compEndDate,compDateOnly};')();
}

test('la comparativa muestra el dia real del vencimiento sin importar la zona del servidor', async () => {
  const { compEndDate } = await cargarFechas();

  // Servidor en la misma zona que el usuario (hoy): la fecha ya llega corrida a las 04:00Z
  assert.match(compEndDate({ contract_end_date: '2027-02-14T04:00:00.000Z' }), /14/);
  // Servidor en UTC: la misma fecha llega a las 00:00Z y no debe retroceder al dia 13
  assert.match(compEndDate({ contract_end_date: '2027-02-14T00:00:00.000Z' }), /14/);
  // Fecha plana sin hora
  assert.match(compEndDate({ contract_end_date: '2027-02-14' }), /14/);
});

test('el vencimiento pasado sigue marcandose como Vencido y la fecha vacia no rompe', async () => {
  const { compEndDate } = await cargarFechas();

  assert.equal(compEndDate({ contract_end_date: '2020-01-15T00:00:00.000Z' }), 'Vencido');
  assert.equal(compEndDate({ contract_end_date: null }), '');
  assert.equal(compEndDate({}), '');
});

test('compEndDate formatea desde la fecha calendario, no desde fmtDate', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /function compFmtDateOnly\(d\)/);
  assert.match(html, /return d<compTodayOnly\(\)\?'Vencido':compFmtDateOnly\(d\)/);
});
