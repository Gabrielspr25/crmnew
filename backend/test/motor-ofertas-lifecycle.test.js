import assert from 'node:assert/strict';
import { test } from 'node:test';

const lifecyclePath = '../src/services/motorOfertasLifecycle.js';

async function loadLifecycle() {
  try {
    return await import(lifecyclePath);
  } catch (error) {
    assert.fail(`falta motorOfertasLifecycle.js: ${error.message}`);
  }
}

test('expone exactamente las transiciones permitidas', async () => {
  const { TRANSITIONS } = await loadLifecycle();

  assert.deepEqual(TRANSITIONS, {
    borrador: ['pendiente_revision', 'archivada'],
    pendiente_revision: ['aprobada', 'archivada'],
    aprobada: ['vigente', 'archivada'],
    vigente: ['reemplazada'],
    reemplazada: ['archivada'],
    archivada: [],
  });
});

test('valida cada transicion permitida', async () => {
  const { assertTransition } = await loadLifecycle();
  const allowed = [
    ['borrador', 'pendiente_revision'],
    ['borrador', 'archivada'],
    ['pendiente_revision', 'aprobada'],
    ['pendiente_revision', 'archivada'],
    ['aprobada', 'vigente'],
    ['aprobada', 'archivada'],
    ['vigente', 'reemplazada'],
    ['reemplazada', 'archivada'],
  ];

  for (const [from, to] of allowed) {
    assert.doesNotThrow(() => assertTransition(from, to));
  }
});

test('rechaza el atajo directo de pendiente_revision a vigente', async () => {
  const { assertTransition } = await loadLifecycle();

  assert.throws(
    () => assertTransition('pendiente_revision', 'vigente'),
    (error) => error.code === 'transicion_invalida'
      && error.from === 'pendiente_revision'
      && error.to === 'vigente'
  );
});

test('activacion pendiente registra aprobada y vigente como pasos separados', async () => {
  const { activationTransitions } = await loadLifecycle();

  assert.deepEqual(activationTransitions('pendiente_revision'), [
    ['pendiente_revision', 'aprobada'],
    ['aprobada', 'vigente'],
  ]);
  assert.deepEqual(activationTransitions('aprobada'), [
    ['aprobada', 'vigente'],
  ]);
});

test('vigente no se archiva directamente', async () => {
  const { assertTransition } = await loadLifecycle();

  assert.throws(
    () => assertTransition('vigente', 'archivada'),
    (error) => error.code === 'transicion_invalida'
  );
});

test('contradiccion y vencida nunca son estados de version', async () => {
  const { assertTransition, activationTransitions } = await loadLifecycle();

  for (const invalidState of ['contradiccion', 'vencida']) {
    assert.throws(
      () => assertTransition(invalidState, 'archivada'),
      (error) => error.code === 'estado_version_invalido'
    );
    assert.throws(
      () => activationTransitions(invalidState),
      (error) => error.code === 'estado_version_invalido'
    );
  }
});
