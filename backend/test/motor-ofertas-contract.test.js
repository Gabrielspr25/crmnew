import assert from 'node:assert/strict';
import { test } from 'node:test';

async function loadContract() {
  try {
    return await import('../src/services/motorOfertasContract.js');
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw error;
  }
}

const validLineRequest = () => ({
  linea: {
    id: 'linea_005',
    indice: 5,
    ban: '123456789',
    tipo: 'multilinea_business_red',
    familia_business_red: 'business_red_plus',
    plan: {
      codigo: 'BRPLUS',
      nombre: 'Business RED Plus',
      monto: 60,
    },
    evento: 'linea_nueva',
    convergente: true,
    trade_in: {
      estado: 'no_requiere',
      validado: false,
    },
  },
  contexto_ban: {
    posicion_en_ban: 5,
    beneficios_usados_por_oferta: {
      oferta_gratis_35: 4,
    },
  },
});

const validOffer = () => ({
  id: 'oferta_gratis_35',
  nombre: 'Equipo gratis',
  estado: 'confirmada',
  vigencia: {
    desde: '2026-07-04',
    hasta: '2026-07-15',
    estado: 'vigente',
  },
  tipos_plan: ['individual', 'multilinea_business_red'],
  familias: ['business_red_plus'],
  eventos: ['linea_nueva', 'portabilidad', 'renovacion'],
  plazos: [24],
  limite_ban: {
    aplica: true,
    cantidad: 4,
    fuera_limite: 'financiado_si_fuente_lo_permite',
  },
  equipos: [],
  fuente: {
    tipo: 'tabla_financiamiento',
    hoja: 'Ofertas Equipos en Portafolio',
    fila: 4,
  },
});

test('version expone solo los seis estados aprobados', async () => {
  const contract = await loadContract();
  assert.ok(contract, 'falta motorOfertasContract.js');
  assert.deepEqual(contract.VERSION_STATES, [
    'borrador',
    'pendiente_revision',
    'aprobada',
    'vigente',
    'reemplazada',
    'archivada',
  ]);
  assert.equal(contract.versionStateSchema.safeParse('contradiccion').success, false);
  assert.equal(contract.versionStateSchema.safeParse('vencida').success, false);
});

test('acepta LineaMovil con contexto BAN', async () => {
  const contract = await loadContract();
  assert.ok(contract, 'falta motorOfertasContract.js');
  const result = contract.eligibilityRequestSchema.safeParse(validLineRequest());
  assert.equal(result.success, true);
});

test('acepta el contrato completo de LineaMovil sin descartar campos documentados', async () => {
  const contract = await loadContract();
  assert.ok(contract, 'falta motorOfertasContract.js');
  const input = validLineRequest();
  input.linea.posicion_en_ban = 5;
  input.linea.plan.autopay = true;
  input.linea.plan.renta_mensual = 60;
  input.linea.plan.fuente = { tipo: 'boletin_planes' };
  input.linea.oferta_aplicada = null;
  input.linea.equipo = null;
  input.linea.plazo = null;
  input.linea.bonos = [];
  input.linea.seguro = { seleccionado: false, estado: 'pendiente_fuente' };
  input.linea.promociones_aplicadas = [];
  input.linea.subtotal = { total_mensual: 60 };
  input.linea.validaciones = [];
  input.linea.estado = 'pendiente_equipo';

  const result = contract.eligibilityRequestSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.equal(result.data.linea.subtotal.total_mensual, 60);
});

test('rechaza evento y posicion BAN invalidos', async () => {
  const contract = await loadContract();
  assert.ok(contract, 'falta motorOfertasContract.js');
  const input = validLineRequest();
  input.linea.evento = 'both';
  input.contexto_ban.posicion_en_ban = 11;
  const result = contract.eligibilityRequestSchema.safeParse(input);
  assert.equal(result.success, false);
  assert.ok(
    result.error.issues.some((issue) => issue.path.join('.') === 'linea.evento')
  );
  assert.ok(
    result.error.issues.some(
      (issue) => issue.path.join('.') === 'contexto_ban.posicion_en_ban'
    )
  );
});

test('Business RED exige familia exacta', async () => {
  const contract = await loadContract();
  assert.ok(contract, 'falta motorOfertasContract.js');
  const input = validLineRequest();
  delete input.linea.familia_business_red;
  const result = contract.eligibilityRequestSchema.safeParse(input);
  assert.equal(result.success, false);
  assert.ok(
    result.error.issues.some(
      (issue) => issue.path.join('.') === 'linea.familia_business_red'
    )
  );
});

test('acepta Oferta con fuente, vigencia y limite BAN explicitos', async () => {
  const contract = await loadContract();
  assert.ok(contract, 'falta motorOfertasContract.js');
  const result = contract.offerContractSchema.safeParse(validOffer());
  assert.equal(result.success, true);
});

test('Oferta rechaza both y vigencia invertida', async () => {
  const contract = await loadContract();
  assert.ok(contract, 'falta motorOfertasContract.js');
  const input = validOffer();
  input.eventos = ['both'];
  input.vigencia = {
    desde: '2026-07-15',
    hasta: '2026-07-04',
    estado: 'vigente',
  };
  const result = contract.offerContractSchema.safeParse(input);
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => issue.path.join('.') === 'eventos.0'));
  assert.ok(result.error.issues.some((issue) => issue.path.join('.') === 'vigencia.hasta'));
});

test('limite BAN aplicable exige cantidad', async () => {
  const contract = await loadContract();
  assert.ok(contract, 'falta motorOfertasContract.js');
  const input = validOffer();
  input.limite_ban.cantidad = null;
  const result = contract.offerContractSchema.safeParse(input);
  assert.equal(result.success, false);
  assert.ok(
    result.error.issues.some((issue) => issue.path.join('.') === 'limite_ban.cantidad')
  );
});

test('parse helpers devuelven valores normalizados por Zod', async () => {
  const contract = await loadContract();
  assert.ok(contract, 'falta motorOfertasContract.js');
  const input = validLineRequest();
  input.linea.id = '  linea_005  ';
  input.linea.plan.codigo = ' BRPLUS ';
  const parsed = contract.parseEligibilityRequest(input);
  assert.equal(parsed.linea.id, 'linea_005');
  assert.equal(parsed.linea.plan.codigo, 'BRPLUS');

  const offer = contract.parseOfferContract(validOffer());
  assert.equal(offer.id, 'oferta_gratis_35');
});
