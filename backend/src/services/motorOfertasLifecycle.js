import { VERSION_STATES } from './motorOfertasContract.js';

export const TRANSITIONS = Object.freeze({
  borrador: Object.freeze(['pendiente_revision', 'archivada']),
  pendiente_revision: Object.freeze(['aprobada', 'archivada']),
  aprobada: Object.freeze(['vigente', 'archivada']),
  vigente: Object.freeze(['reemplazada']),
  reemplazada: Object.freeze(['archivada']),
  archivada: Object.freeze([]),
});

function lifecycleError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function assertVersionState(state) {
  if (!VERSION_STATES.includes(state)) {
    throw lifecycleError(
      'estado_version_invalido',
      `estado_version_invalido: ${state}`,
      { state }
    );
  }
}

export function assertTransition(from, to) {
  assertVersionState(from);
  assertVersionState(to);

  if (!TRANSITIONS[from].includes(to)) {
    throw lifecycleError(
      'transicion_invalida',
      `transicion_invalida: ${from} -> ${to}`,
      { from, to }
    );
  }

  return { from, to };
}

export function activationTransitions(state) {
  assertVersionState(state);

  if (state === 'pendiente_revision') {
    assertTransition('pendiente_revision', 'aprobada');
    assertTransition('aprobada', 'vigente');
    return [
      ['pendiente_revision', 'aprobada'],
      ['aprobada', 'vigente'],
    ];
  }

  if (state === 'aprobada') {
    assertTransition('aprobada', 'vigente');
    return [['aprobada', 'vigente']];
  }

  throw lifecycleError(
    'transicion_invalida',
    `transicion_invalida: ${state} no puede activarse`,
    { from: state, to: 'vigente' }
  );
}
