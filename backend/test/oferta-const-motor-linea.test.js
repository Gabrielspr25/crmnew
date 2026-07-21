import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const page = await readFile(
  new URL('../../Planes para web/oferta-const.html', import.meta.url),
  'utf8'
);

test('cada linea ofrece las tres operaciones: nueva, portabilidad y renovacion', () => {
  assert.match(page, /LINE_OPERACIONES\s*=\s*\[/);
  assert.match(page, /id:'nueva'/);
  assert.match(page, /id:'portabilidad'/);
  assert.match(page, /id:'renovacion'/);
  assert.match(page, /function rowOperacionSelect/);
  assert.match(page, /function setRowEvent/);
});

test('cada linea tiene su propio selector de plan', () => {
  assert.match(page, /function rowPlanSelect/);
  assert.match(page, /function setRowPlan/);
  assert.match(page, /function rowPlanOptions/);
  // la fila guarda su plan de forma independiente
  assert.match(page, /state\.cart\[index\]\.plan\s*=/);
  assert.match(page, /<th>Plan<\/th>/);
});

test('el selector de equipo permanece deshabilitado hasta completar operacion y plan', () => {
  assert.match(page, /function rowReadyForEquipo/);
  assert.match(page, /row\.evento\s*&&\s*row\.plan/);
  // el boton se renderiza deshabilitado cuando la fila no esta lista
  assert.match(page, /rowReadyForEquipo\(row\)\s*\?\s*''\s*:\s*'disabled'/);
  // guarda en la apertura del modal
  assert.match(page, /function openEquipmentModal\(index\)\{[\s\S]{0,400}?if\(!rowReadyForEquipo/);
});

test('los equipos elegibles se consultan al motor y no a ofertas-data', () => {
  assert.match(page, /\/api\/motor-ofertas\/elegibles/);
  assert.match(page, /function fetchMotorEquipos/);
  assert.match(page, /contexto_ban/);
  assert.match(page, /posicion_en_ban/);
  assert.match(page, /familia_business_red/);
  assert.match(page, /trade_in/);
  // la elegibilidad del modal ya no sale del catalogo estatico
  assert.doesNotMatch(page, /function modalEquipoList\(\)\{[\s\S]{0,300}?getEquiposFiltrados/);
});

test('no hay respaldo a ofertas-data.js cuando el motor falla', () => {
  assert.match(page, /motorEstado/);
  assert.match(page, /'sin_sesion'/);
  assert.match(page, /'sin_version'/);
  assert.match(page, /'sin_equipos'/);
  assert.match(page, /'cargando'/);
  assert.match(page, /'error'/);
  assert.match(page, /No se pudo consultar el motor/);
  assert.match(page, /No hay una version vigente/);
  assert.match(page, /Inicia sesion en el CRM/);
  // ningun estado de error cae de vuelta al catalogo estatico
  assert.doesNotMatch(page, /motorEstado==='error'[\s\S]{0,120}?OFERTAS_DATA/);
});

test('cambiar operacion o plan limpia el equipo de esa linea sin tocar las demas', () => {
  assert.match(page, /function clearRowEquipo/);
  assert.match(page, /clearRowEquipo\(index\)/);
  assert.match(page, /state\.cart\[index\]\.equipo=null/);
  assert.match(page, /state\.cart\[index\]\.oferta=null/);
  assert.match(page, /state\.cart\[index\]\.motorEquipos=null/);
});

test('mapea la respuesta del motor a la forma que usa la modal', () => {
  assert.match(page, /function mapMotorEquipoToRow/);
  assert.match(page, /modelo_oficial/);
  assert.match(page, /precio_regular/);
  assert.match(page, /sku_sif/);
  assert.match(page, /plazos/);
  assert.match(page, /beneficio/);
});

test('la fila y el resumen muestran operacion, plan y equipo de cada linea', () => {
  assert.match(page, /function rowPlanLabel/);
  // encabezados de la tabla de lineas incluyen Plan junto a Evento y Equipo
  assert.match(page, /<th>Evento<\/th><th>Plan<\/th><th>Equipo<\/th>/);
  // la propuesta muestra el plan por linea
  assert.match(page, /rowPlanLabel\(row\)/);
});
