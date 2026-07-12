import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const dataJs = await readFile(new URL('../../Planes para web/ofertas-data.js', import.meta.url), 'utf8');
const logicJs = await readFile(new URL('../../Planes para web/ofertas-logic.js', import.meta.url), 'utf8');

function loadLogic() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(`${dataJs}\nwindow.OFERTAS_DATA = OFERTAS_DATA;`, ctx);
  vm.runInContext(logicJs, ctx);
  return ctx.window.OfertasLogic;
}

test('planes individuales heredan ofertas de planes menores', () => {
  const L = loadLogic();
  const ids45 = L.getOfertasAplicables({ tipo: 'individual', planInd: 45, planMulti: 'plus', beneficio: 'todos' }).map((o) => o.id);
  assert.ok(ids45.includes('gratis-35'));
  assert.ok(ids45.includes('gratis-40'));
  assert.ok(ids45.includes('gratis-45'));
  assert.ok(!ids45.includes('gratis-50'));
  assert.ok(!ids45.includes('gratis-20'));

  const ids75 = L.getOfertasAplicables({ tipo: 'individual', planInd: 75, planMulti: 'plus', beneficio: 'todos' }).map((o) => o.id);
  for (const id of ['gratis-35', 'gratis-40', 'gratis-45', 'gratis-50', 'gratis-60-ti', 'gratis-75-ti']) {
    assert.ok(ids75.includes(id), `Plan $75 debe incluir ${id}`);
  }
  assert.ok(ids75.includes('50pct-50'), 'Plan $75 debe incluir el 50% regular desde $50');
});

test('planes multilinea heredan ofertas de familias menores segun terminos', () => {
  const L = loadLogic();
  const plus = L.getOfertasAplicables({ tipo: 'multilinea', planInd: 75, planMulti: 'plus', beneficio: 'todos' }).map((o) => o.id);
  assert.ok(!plus.includes('gratis-20'));
  assert.ok(plus.includes('gratis-35'));
  assert.ok(plus.includes('gratis-50'));
  assert.ok(plus.includes('gratis-60-ti'));
  assert.ok(!plus.includes('gratis-75-ti'));

  const extreme = L.getOfertasAplicables({ tipo: 'multilinea', planInd: 75, planMulti: 'extreme', beneficio: 'todos' }).map((o) => o.id);
  assert.ok(extreme.includes('gratis-60-ti'));
  assert.ok(extreme.includes('gratis-75-ti'));
  assert.ok(extreme.includes('credito-1000-75'));
});

test('trade-in solo aplica a renovacion cuando la oferta lo exige', () => {
  const L = loadLogic();
  const offer = { tradeinRenov: true };
  assert.equal(L.requiresTradein(offer, 'nueva'), false);
  assert.equal(L.requiresTradein(offer, 'portabilidad'), false);
  assert.equal(L.requiresTradein(offer, 'adicional'), false);
  assert.equal(L.requiresTradein(offer, 'renovacion'), true);
});

test('modems mifi y tablets se manejan como lineas Business RED multilinea', () => {
  const L = loadLogic();
  const individual = L.getOfertasAplicables({ tipo: 'individual', planInd: 100, planMulti: 'supreme', beneficio: 'todos' }).map((o) => o.id);
  assert.ok(!individual.includes('br-mifi-tablet-130-plus'));
  assert.ok(!individual.includes('br-mifi-tablet-500-supreme'));

  const plus = L.getOfertasAplicables({ tipo: 'multilinea', planInd: 75, planMulti: 'plus', beneficio: 'todos' });
  assert.ok(plus.some((o) => o.id === 'br-mifi-tablet-130-plus'));
  assert.ok(!plus.some((o) => o.id === 'br-mifi-tablet-300-extreme-24'));

  const extreme = L.getOfertasAplicables({ tipo: 'multilinea', planInd: 75, planMulti: 'extreme', beneficio: 'todos' });
  assert.ok(extreme.some((o) => o.id === 'br-mifi-tablet-300-extreme-24'));
  assert.ok(extreme.some((o) => o.id === 'br-mifi-tablet-400-extreme-30'));

  const supreme = L.getOfertasAplicables({ tipo: 'multilinea', planInd: 75, planMulti: 'supreme', beneficio: 'todos' });
  assert.ok(supreme.some((o) => o.id === 'br-mifi-tablet-500-supreme'));

  const equipos = L.getEquiposFiltrados({ tipo: 'multilinea', planInd: 75, planMulti: 'supreme', beneficio: 'todos' });
  assert.ok(equipos.some((e) => e.modelo === 'JEXstream RG2100 5G'));
  assert.ok(equipos.some((e) => e.modelo === 'iPad Pro 13 WIFI+CELL 256GB'));
});

test('descuentos de la hoja Ofertas con desc respetan plan y familia seleccionada', () => {
  const L = loadLogic();

  const plusOffers = L.getOfertasAplicables({ tipo: 'multilinea', planInd: 75, planMulti: 'plus', beneficio: 'todos' })
    .filter((o) => o.equipos.some((e) => e.modelo === 'iPhone 17 Pro Max 256GB'))
    .map((o) => o.id);
  assert.ok(plusOffers.includes('desc-130-35'));
  assert.ok(plusOffers.includes('desc-250-40'));
  assert.ok(!plusOffers.includes('desc-250-35'), 'Plus no debe duplicar el descuento $250 individual $35');
  assert.ok(plusOffers.includes('50pct-50'), 'Plus debe mostrar el 50% regular de portafolio Business RED 1-10');

  const supremeOffers = L.getOfertasAplicables({ tipo: 'multilinea', planInd: 75, planMulti: 'supreme', beneficio: 'todos' })
    .filter((o) => o.equipos.some((e) => e.modelo === 'iPhone 17 Pro Max 256GB'))
    .map((o) => o.id);
  assert.ok(supremeOffers.includes('50pct-50'), 'Supreme si debe mostrar 50%');

  const individual40 = L.getOfertasAplicables({ tipo: 'individual', planInd: 40, planMulti: 'plus', beneficio: 'todos' })
    .filter((o) => o.equipos.some((e) => e.modelo === 'iPhone 17 Pro Max 256GB'))
    .map((o) => o.id);
  assert.ok(!individual40.includes('desc-130-35'));
  assert.ok(!individual40.includes('desc-250-35'));
  assert.ok(individual40.includes('desc-250-40'));
});

test('modems mifi y tablets aplican tambien en planes individuales por rango', () => {
  const L = loadLogic();

  const ids35 = L.getOfertasAplicables({ tipo: 'individual', planInd: 35, planMulti: 'plus', beneficio: 'todos' }).map((o) => o.id);
  assert.ok(ids35.includes('ind-mifi-tablet-130-35'));
  assert.ok(!ids35.includes('ind-mifi-tablet-250-40'));

  const ids40 = L.getOfertasAplicables({ tipo: 'individual', planInd: 40, planMulti: 'plus', beneficio: 'todos' }).map((o) => o.id);
  assert.ok(!ids40.includes('ind-mifi-tablet-130-35'));
  assert.ok(ids40.includes('ind-mifi-tablet-250-40'));

  const ids50 = L.getOfertasAplicables({ tipo: 'individual', planInd: 50, planMulti: 'plus', beneficio: 'todos' }).map((o) => o.id);
  assert.ok(!ids50.includes('ind-mifi-tablet-130-35'));
  assert.ok(!ids50.includes('ind-mifi-tablet-250-40'));
  assert.ok(ids50.includes('ind-mifi-tablet-300-50-24'));
  assert.ok(ids50.includes('ind-mifi-tablet-400-50-30'));

  const equipos = L.getEquiposFiltrados({ tipo: 'individual', planInd: 50, planMulti: 'plus', beneficio: 'todos' });
  assert.ok(equipos.some((e) => e.modelo === 'JEXstream RG2100 5G'));
  assert.ok(equipos.some((e) => e.modelo === 'iPad 11 WIFI+CELL 128GB'));
  assert.ok(equipos.some((e) => e.modelo === 'Galaxy Tab S10 FE 128GB'));
});

test('ofertas Business RED de modems y tablets no requieren trade-in en renovacion', () => {
  const L = loadLogic();
  const offers = L.getOfertasAplicables({ tipo: 'multilinea', planInd: 75, planMulti: 'supreme', beneficio: 'todos' });
  const offer = offers.find((o) => o.id === 'br-mifi-tablet-500-supreme');
  assert.equal(L.requiresTradein(offer, 'renovacion'), false);
  assert.equal(offer.lineaLimit, 10);
});
