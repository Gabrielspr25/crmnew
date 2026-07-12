// ofertas-data.js
// Fuente de verdad: Tabla Ofertas Financiamiento 9 al 22 de junio de 2026 — PYMES
// Estructura por oferta:
//   beneficio: 'gratis' | '50pct' | 'credito'
//   tipo:      'individual' | 'multilinea' | 'both'
//   familias:  familias multilinea que aplican segun terminos (vacio = no restringe)
//   tradeinNueva: SIEMPRE false para lineas nuevas
// Regla oficial: el plan superior hereda ofertas/equipos de planes menores.
// planMax queda solo como referencia historica; la logica usa planMin + familias.
const EQUIPOS_MIFI_TABLET_INDIVIDUAL = [
  { marca: 'PCD', modelo: 'Modem R402', precio: 99.99 },
  { marca: 'Franklin', modelo: 'RT 410 MIFI', precio: 99.99 },
  { marca: 'Franklin', modelo: 'RT910 MiFi', precio: 139.99 },
  { marca: 'SenseConnect', modelo: 'SC421', precio: 149.99 },
  { marca: 'Franklin', modelo: 'JEXstream CG890 5G', precio: 249.99 },
  { marca: 'Franklin', modelo: 'JEXstream RG2100 5G', precio: 299.99 },
  { marca: 'Franklin', modelo: 'RG1000 5G', precio: 399.99 },
  { marca: 'Apple', modelo: 'iPad 11 WIFI+CELL 128GB', precio: 539.99 },
  { marca: 'Samsung', modelo: 'Galaxy Tab S10 FE 128GB', precio: 574.99 },
  { marca: 'Netgear', modelo: 'M6 PRO MIFI', precio: 599.99 },
  { marca: 'Apple', modelo: 'iPad Air 11 WIFI+CELL 128GB', precio: 889.99 },
  { marca: 'Apple', modelo: 'iPad Air 13 WIFI+CELL 128GB', precio: 1089.99 },
  { marca: 'Apple', modelo: 'iPad Pro 11 WIFI+CELL 256GB', precio: 1269.99 },
  { marca: 'Apple', modelo: 'iPad Pro 13 WIFI+CELL 256GB', precio: 1589.99 },
];
const SOLO_RENOVACION = ['renovacion'];

const OFERTAS_DATA = [
  // ─── GRATIS $35 ───
  {
    id: 'gratis-35',
    beneficio: 'gratis',
    planMin: 35, planMax: 35,
    tipo: 'both',
    familias: ['plus','extreme','supreme','sinfronteras'],
    titulo: 'Equipo gratis — Plan $35',
    plazos: [24],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'SWCH24', fi: 'FIUP24' },
    bonoStreaming: false, lineaLimit: 4, credito: null, nota: null,
    equipos: [
      { marca: 'Samsung',  modelo: 'Galaxy A07',     precio: 119.99 },
      { marca: 'Samsung',  modelo: 'Galaxy A16',     precio: 169.99 },
      { marca: 'Samsung',  modelo: 'Galaxy A26',     precio: 259.99 },
      { marca: 'Apple',    modelo: 'iPhone 16e',     precio: 599.99 },
      { marca: 'Motorola', modelo: 'Moto G 2025 5G', precio: 149.99 },
    ]
  },

  // ─── GRATIS $40 ───
  {
    id: 'gratis-40',
    beneficio: 'gratis',
    planMin: 40, planMax: 40,
    tipo: 'both',
    familias: ['plus','extreme','supreme','sinfronteras'],
    titulo: 'Equipo gratis — Plan $40',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'SWCH30', fi: 'FIUP30' },
    bonoStreaming: true, lineaLimit: 4, credito: null, nota: null,
    equipos: [
      { marca: 'Samsung', modelo: 'Galaxy A17', precio: 199.99 },
      { marca: 'Samsung', modelo: 'Galaxy A36', precio: 349.99 },
    ]
  },

  // ─── GRATIS $45 ───
  {
    id: 'gratis-45',
    beneficio: 'gratis',
    planMin: 45, planMax: 45,
    tipo: 'both',
    familias: ['plus','extreme','supreme','sinfronteras'],
    titulo: 'Equipo gratis — Plan $45',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'SWCH30', fi: 'FIUP30' },
    bonoStreaming: true, lineaLimit: 4, credito: null, nota: null,
    equipos: [
      { marca: 'Samsung',  modelo: 'Galaxy A37',          precio: 349.99 },
      { marca: 'Samsung',  modelo: 'Galaxy S25',           precio: 799.99 },
      { marca: 'Apple',    modelo: 'iPhone 16 128GB',      precio: 729.99 },
      { marca: 'Motorola', modelo: 'Moto G Power 2025 5G', precio: 279.99 },
    ]
  },

  // ─── GRATIS desde $50 ───
  {
    id: 'gratis-50',
    beneficio: 'gratis',
    planMin: 50, planMax: 59,
    tipo: 'both',
    familias: ['plus','extreme','supreme','sinfronteras'],
    titulo: 'Equipo gratis — Planes desde $50',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'SWCH30', fi: 'FIUP30' },
    bonoStreaming: true, lineaLimit: 4, credito: null, nota: null,
    equipos: [
      { marca: 'Apple',    modelo: 'iPhone 17e',       precio: 599.99 },
      { marca: 'Motorola', modelo: 'Moto Edge 2025',   precio: 429.99 },
      { marca: 'Motorola', modelo: 'Moto Edge 2024',   precio: 399.99 },
      { marca: 'Samsung',  modelo: 'Galaxy S25 Fe',    precio: 589.99 },
      { marca: 'Samsung',  modelo: 'Galaxy S25+',      precio: 999.99 },
    ]
  },

  // ─── 50% DESCUENTO desde $50 (hasta 10 lineas) ───
  {
    id: '50pct-50',
    beneficio: '50pct',
    planMin: 50, planMax: 9999,
    tipo: 'both',
    familias: ['plus','extreme','supreme','sinfronteras'],
    titulo: '50% de descuento — Planes desde $50',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'U50%30', fi: 'F50%30' },
    bonoStreaming: true, lineaLimit: 10, credito: null,
    nota: 'Aplica hasta 10 lineas Business Red (lineas 1-10). Solo 30 plazos.',
    equipos: [
      { marca: 'Samsung',  modelo: 'Galaxy S26 256GB',      precio: 839.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S26 Plus 256GB', precio: 1089.99 },
      { marca: 'Samsung',  modelo: 'Galaxy S26 Ultra 256GB',precio: 1199.99 },
      { marca: 'Motorola', modelo: 'Razr 2025',             precio: 649.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 256GB',       precio: 829.99  },
      { marca: 'Apple',    modelo: 'iPhone Air 256GB',      precio: 799.99  },
      { marca: 'Apple',    modelo: 'iPhone Air 512GB',      precio: 999.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro 256GB',   precio: 1099.99 },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro 512GB',   precio: 1299.99 },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro Max 256GB',precio:1199.99 },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro Max 512GB',precio:1399.99 },
      { marca: 'Samsung',  modelo: 'Z Flip 7',              precio: 799.99  },
      { marca: 'Samsung',  modelo: 'Z Fold 7',              precio: 1899.99 },
    ]
  },

  // ─── GRATIS desde $60 con Trade-In para renovaciones ───
  {
    id: 'gratis-60-ti',
    beneficio: 'gratis',
    planMin: 60, planMax: 74,
    tipo: 'both',
    familias: ['plus','extreme','supreme','sinfronteras'],
    titulo: 'Equipo gratis — Planes desde $60',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: true,
    pricecodes: { up: 'UPTI30', fi: 'FITI30' },
    bonoStreaming: true, lineaLimit: 4, credito: null,
    nota: 'Lineas nuevas: sin trade-in. Renovaciones: requiere trade-in (equipos selectos Samsung, Apple, Motorola, OnePlus).',
    equipos: [
      { marca: 'Samsung',  modelo: 'Galaxy S26 256GB', precio: 839.99 },
      { marca: 'Motorola', modelo: 'Razr 2025',        precio: 649.99 },
      { marca: 'Apple',    modelo: 'iPhone Air 256GB', precio: 799.99 },
      { marca: 'Motorola', modelo: 'Razr 2024',        precio: 589.99 },
      { marca: 'Samsung',  modelo: 'Z Flip 7',         precio: 799.99 },
      { marca: 'Apple',    modelo: 'iPhone 17 256GB',  precio: 829.99 },
    ]
  },

  // ─── GRATIS desde $75 (NO aplica Plus) ───
  {
    id: 'gratis-75-ti',
    beneficio: 'gratis',
    planMin: 75, planMax: 94,
    tipo: 'both',
    familias: ['extreme','supreme','sinfronteras'],
    titulo: 'Equipo gratis — Planes individuales desde $75',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: true,
    pricecodes: { up: 'UPTI30', fi: 'FITI30' },
    bonoStreaming: true, lineaLimit: 4, credito: null,
    nota: 'No aplica a Business Red Plus. Renovaciones requieren trade-in.',
    equipos: [
      { marca: 'Samsung', modelo: 'Galaxy S26 Ultra 256GB',  precio: 1199.99 },
      { marca: 'Apple',   modelo: 'iPhone 17 Pro 256GB',     precio: 1099.99 },
      { marca: 'Samsung', modelo: 'Galaxy S26 Plus 256GB',   precio: 1089.99 },
      { marca: 'Apple',   modelo: 'iPhone 17 Pro Max 256GB', precio: 1199.99 },
    ]
  },

  // ─── GRATIS desde $95 (SOLO Supreme + Sin Fronteras) ───
  {
    id: 'gratis-95-ti',
    beneficio: 'gratis',
    planMin: 95, planMax: 9999,
    tipo: 'both',
    familias: ['supreme','sinfronteras'],
    titulo: 'Equipo gratis — Planes individuales desde $95',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: true,
    pricecodes: { up: 'UPTI30', fi: 'FITI30' },
    bonoStreaming: true, lineaLimit: 4, credito: null,
    nota: 'Solo aplica a Supreme ($95) y Sin Fronteras ($100). Renovaciones requieren trade-in.',
    equipos: [
      { marca: 'Apple', modelo: 'iPhone Air 512GB',       precio: 999.99  },
      { marca: 'Apple', modelo: 'iPhone 17 Pro 512GB',    precio: 1299.99 },
      { marca: 'Apple', modelo: 'iPhone 17 Pro Max 512GB',precio: 1399.99 },
    ]
  },

  // ─── 2 EQUIPOS GRATIS multilinea desde $60 (FAM) ───
  {
    id: 'gratis-multi-fam',
    beneficio: 'gratis',
    planMin: 60, planMax: 9999,
    tipo: 'multilinea',
    familias: ['plus','extreme','supreme','sinfronteras'],
    titulo: '2 equipos gratis — Multilinea desde $60',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: true,
    pricecodes: { up: 'UPFAM2', fi: 'FIFAM2' },
    bonoStreaming: true, lineaLimit: 2, credito: null,
    nota: 'Aplica solo a 2 lineas por BAN. Renovaciones requieren trade-in. Para otras lineas adicionales usar el price code individual correspondiente.',
    equipos: [
      { marca: 'Apple',   modelo: 'iPhone 17 Pro 256GB',      precio: 1099.99 },
      { marca: 'Samsung', modelo: 'Galaxy S26 Plus 256GB',    precio: 1089.99 },
      { marca: 'Samsung', modelo: 'Galaxy S26 Ultra 256GB',   precio: 1199.99 },
      { marca: 'Apple',   modelo: 'iPhone Air 512GB',         precio: 999.99  },
      { marca: 'Apple',   modelo: 'iPhone 17 Pro Max 256GB',  precio: 1199.99 },
      { marca: 'Apple',   modelo: 'iPhone 17 Pro 512GB',      precio: 1299.99 },
      { marca: 'Apple',   modelo: 'iPhone 17 Pro Max 512GB',  precio: 1399.99 },
    ]
  },

  // ─── CREDITO $1,000 desde $75 (Z Fold 7) ───
  {
    id: 'credito-1000-75',
    beneficio: 'credito',
    planMin: 75, planMax: 9999,
    tipo: 'both',
    familias: ['extreme','supreme','sinfronteras'],
    titulo: 'Credito $1,000 — Planes desde $75',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: true,
    pricecodes: { up: 'UPTI30', fi: 'FITI30' },
    bonoStreaming: true, lineaLimit: 2, credito: 1000,
    nota: 'Aplica a 2 lineas por BAN (Extreme, Supreme, Sin Fronteras). Renovaciones requieren trade-in.',
    equipos: [
      { marca: 'Samsung', modelo: 'Z Fold 7', precio: 1899.99 }
    ]
  },

  // ─── CREDITO $1,100 desde $75 ───
  {
    id: 'credito-1100-75',
    beneficio: 'credito',
    planMin: 75, planMax: 9999,
    tipo: 'both',
    familias: ['extreme','supreme','sinfronteras'],
    titulo: 'Credito $1,100 — Planes individuales desde $75',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: true,
    pricecodes: { up: 'UPTI30', fi: 'FITI30' },
    bonoStreaming: true, lineaLimit: 2, credito: 1100,
    nota: 'Aplica a 2 lineas por BAN (Extreme, Supreme, Sin Fronteras). Renovaciones requieren trade-in.',
    equipos: [
      { marca: 'Apple', modelo: 'iPhone 17 Pro 512GB',     precio: 1299.99 },
      { marca: 'Apple', modelo: 'iPhone 17 Pro Max 512GB', precio: 1399.99 },
    ]
  },

  // ─── DESCUENTO $130 en plan $35 (credito mensual dividido) ───
  {
    id: 'desc-130-35',
    beneficio: 'credito',
    planMin: 35, planMax: 35,
    tipo: 'both',
    familias: ['plus','extreme','supreme','sinfronteras'],
    planesIndividuales: [35],
    familiasMultilinea: ['plus','extreme','supreme','sinfronteras'],
    titulo: 'Descuento $130 — Plan $35',
    plazos: [24, 30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'U13024 / U13030', fi: 'F13024 / F13030' },
    bonoStreaming: false, lineaLimit: null, credito: 130,
    nota: 'Credito mensual aplicado en cuenta. Ejemplo: $130 / 24 plazos = $5.42/mes. Si cliente elige otro plazo, $130 se divide por ese plazo.',
    equipos: [
      { marca: 'Samsung',  modelo: 'Galaxy A17',             precio: 199.99  },
      { marca: 'Motorola', modelo: 'Moto G Power 2025 5G',   precio: 279.99  },
      { marca: 'Samsung',  modelo: 'Galaxy A37',             precio: 349.99  },
      { marca: 'Motorola', modelo: 'Moto Edge 2025',         precio: 429.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S25 Fe',          precio: 589.99  },
      { marca: 'Motorola', modelo: 'Razr 2025',              precio: 649.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S26 256GB',       precio: 839.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S25+',            precio: 999.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S26 Plus 256GB',  precio: 1089.99 },
      { marca: 'Apple',    modelo: 'iPhone 17e',             precio: 599.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S26 Ultra 256GB', precio: 1199.99 },
      { marca: 'Samsung',  modelo: 'Z Flip 7',               precio: 799.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 256GB',        precio: 829.99  },
      { marca: 'Apple',    modelo: 'iPhone Air 256GB',       precio: 799.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro 256GB',    precio: 1099.99 },
      { marca: 'Apple',    modelo: 'iPhone Air 512GB',       precio: 999.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro Max 256GB',precio: 1199.99 },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro 512GB',    precio: 1299.99 },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro Max 512GB',precio: 1399.99 },
      { marca: 'Samsung',  modelo: 'Z Fold 7',               precio: 1899.99 },
    ]
  },

  // ─── DESCUENTO $250 en plan $35 ───
  {
    id: 'desc-250-35',
    beneficio: 'credito',
    planMin: 35, planMax: 35,
    tipo: 'individual',
    familias: [],
    planesIndividuales: [35],
    titulo: 'Descuento $250 — Plan $35',
    plazos: [24, 30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'U25024 / U25030', fi: 'F25024 / F25030' },
    bonoStreaming: false, lineaLimit: null, credito: 250,
    nota: 'Credito mensual: $250 / plazos elegidos.',
    equipos: [
      { marca: 'Motorola', modelo: 'Moto Edge 2025',         precio: 429.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S25 Fe',          precio: 589.99  },
      { marca: 'Motorola', modelo: 'Razr 2025',              precio: 649.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S26 256GB',       precio: 839.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S26 Plus 256GB',  precio: 1089.99 },
      { marca: 'Apple',    modelo: 'iPhone 17e',             precio: 599.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S26 Ultra 256GB', precio: 1199.99 },
      { marca: 'Samsung',  modelo: 'Z Flip 7',               precio: 799.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 256GB',        precio: 829.99  },
      { marca: 'Apple',    modelo: 'iPhone Air 256GB',       precio: 799.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro 256GB',    precio: 1099.99 },
      { marca: 'Apple',    modelo: 'iPhone Air 512GB',       precio: 999.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro Max 256GB',precio: 1199.99 },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro 512GB',    precio: 1299.99 },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro Max 512GB',precio: 1399.99 },
      { marca: 'Samsung',  modelo: 'Z Fold 7',               precio: 1899.99 },
    ]
  },

  // ─── DESCUENTO $250 en plan $40 ───
  {
    id: 'desc-250-40',
    beneficio: 'credito',
    planMin: 40, planMax: 40,
    tipo: 'both',
    familias: ['plus','extreme','supreme','sinfronteras'],
    planesIndividuales: [40],
    familiasMultilinea: ['plus','extreme','supreme','sinfronteras'],
    titulo: 'Descuento $250 — Plan $40',
    plazos: [24, 30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'U25024 / U25030', fi: 'F25024 / F25030' },
    bonoStreaming: false, lineaLimit: null, credito: 250,
    nota: 'Credito mensual: $250 / plazos elegidos.',
    equipos: [
      { marca: 'Motorola', modelo: 'Moto Edge 2025',         precio: 429.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S25 Fe',          precio: 589.99  },
      { marca: 'Motorola', modelo: 'Razr 2025',              precio: 649.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S26 256GB',       precio: 839.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S26 Plus 256GB',  precio: 1089.99 },
      { marca: 'Apple',    modelo: 'iPhone 17e',             precio: 599.99  },
      { marca: 'Samsung',  modelo: 'Galaxy S26 Ultra 256GB', precio: 1199.99 },
      { marca: 'Samsung',  modelo: 'Z Flip 7',               precio: 799.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 256GB',        precio: 829.99  },
      { marca: 'Apple',    modelo: 'iPhone Air 256GB',       precio: 799.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro 256GB',    precio: 1099.99 },
      { marca: 'Apple',    modelo: 'iPhone Air 512GB',       precio: 999.99  },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro Max 256GB',precio: 1199.99 },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro 512GB',    precio: 1299.99 },
      { marca: 'Apple',    modelo: 'iPhone 17 Pro Max 512GB',precio: 1399.99 },
      { marca: 'Samsung',  modelo: 'Z Fold 7',               precio: 1899.99 },
    ]
  },

  // MODEMS / MIFI / TABLETS EN PLANES INDIVIDUALES
  // Rangos segun boletin individual; no heredan fuera de su rango.
  {
    id: 'ind-mifi-tablet-130-35',
    beneficio: 'credito',
    planMin: 35, planMax: 39.99, planMaxEnforced: true,
    tipo: 'individual',
    familias: [],
    eventos: SOLO_RENOVACION,
    titulo: 'Descuento $130 - Modems, MiFi y Tablets Individual $35-$39.99',
    plazos: [24, 30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'Ver boletin individual', fi: 'Ver boletin individual' },
    bonoStreaming: false, lineaLimit: null, credito: 130,
    nota: 'Aplica a renovaciones de modems, MiFi y tablets en planes individuales $35-$39.99. Credito mensual dividido entre 24 o 30 plazos. Sin pago inicial ni trade-in.',
    equipos: EQUIPOS_MIFI_TABLET_INDIVIDUAL
  },
  {
    id: 'ind-mifi-tablet-250-40',
    beneficio: 'credito',
    planMin: 40, planMax: 49.99, planMaxEnforced: true,
    tipo: 'individual',
    familias: [],
    eventos: SOLO_RENOVACION,
    titulo: 'Descuento $250 - Modems, MiFi y Tablets Individual $40-$49.99',
    plazos: [24, 30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'Ver boletin individual', fi: 'Ver boletin individual' },
    bonoStreaming: false, lineaLimit: null, credito: 250,
    nota: 'Aplica a renovaciones de modems, MiFi y tablets en planes individuales $40-$49.99. Credito mensual dividido entre 24 o 30 plazos. Sin pago inicial ni trade-in.',
    equipos: EQUIPOS_MIFI_TABLET_INDIVIDUAL
  },
  {
    id: 'ind-mifi-tablet-300-50-24',
    beneficio: 'credito',
    planMin: 50, planMax: 9999, planMaxEnforced: true,
    tipo: 'individual',
    familias: [],
    eventos: SOLO_RENOVACION,
    titulo: 'Descuento $300 - Modems, MiFi y Tablets Individual $50+',
    plazos: [24],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'Ver boletin individual', fi: 'Ver boletin individual' },
    bonoStreaming: false, lineaLimit: null, credito: 300,
    nota: 'Aplica a renovaciones de modems, MiFi y tablets en planes individuales $50 o mas. Credito mensual en 24 plazos. Sin pago inicial ni trade-in.',
    equipos: EQUIPOS_MIFI_TABLET_INDIVIDUAL
  },
  {
    id: 'ind-mifi-tablet-400-50-30',
    beneficio: 'credito',
    planMin: 50, planMax: 9999, planMaxEnforced: true,
    tipo: 'individual',
    familias: [],
    eventos: SOLO_RENOVACION,
    titulo: 'Descuento $400 - Modems, MiFi y Tablets Individual $50+',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'Ver boletin individual', fi: 'Ver boletin individual' },
    bonoStreaming: false, lineaLimit: null, credito: 400,
    nota: 'Aplica a renovaciones de modems, MiFi y tablets en planes individuales $50 o mas. Credito mensual en 30 plazos. Sin pago inicial ni trade-in.',
    equipos: EQUIPOS_MIFI_TABLET_INDIVIDUAL
  },

  // MODEMS / MIFI / TABLETS EN BUSINESS RED MULTILINEA
  // El boletin los trata como lineas Business RED, no como servicios.
  // Aplica a renovaciones; no requiere trade-in.
  {
    id: 'br-mifi-tablet-130-plus',
    beneficio: 'credito',
    planMin: 65, planMax: 65,
    tipo: 'multilinea',
    familias: ['plus'],
    eventos: SOLO_RENOVACION,
    titulo: 'Descuento $130 - Modems, MiFi y Tablets Business RED Plus',
    plazos: [24, 30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'Ver boletin Business RED', fi: 'Ver boletin Business RED' },
    bonoStreaming: true, lineaLimit: 10, credito: 130,
    nota: 'Aplica a renovaciones de modems, MiFi y tablets en Business RED Plus, lineas 1-10 por BAN. Credito mensual dividido entre 24 o 30 plazos. Sin pago inicial ni trade-in.',
    equipos: [
      { marca: 'PCD', modelo: 'Modem R402', precio: 99.99 },
      { marca: 'Dlink', modelo: 'Router DWR-920V', precio: 99.99 },
      { marca: 'Franklin', modelo: 'RT 410 MIFI', precio: 99.99 },
      { marca: 'Franklin', modelo: 'RT910 MiFi', precio: 139.99 },
      { marca: 'SenseConnect', modelo: 'SC421', precio: 149.99 },
      { marca: 'Franklin', modelo: 'JEXstream CG890 5G', precio: 249.99 },
      { marca: 'Franklin', modelo: 'JEXstream RG2100 5G', precio: 299.99 },
      { marca: 'Franklin', modelo: 'RG1000 5G', precio: 399.99 },
      { marca: 'Apple', modelo: 'iPad 10.9 GPS+ Cell 64GB', precio: 499.99 },
      { marca: 'Apple', modelo: 'iPad 11 WIFI+CELL 128GB', precio: 539.99 },
      { marca: 'Samsung', modelo: 'Galaxy Tab S9 FE 128GB', precio: 549.99 },
      { marca: 'Samsung', modelo: 'Galaxy Tab S10 FE 128GB', precio: 574.99 },
      { marca: 'Netgear', modelo: 'M6 PRO MIFI', precio: 599.99 },
      { marca: 'Apple', modelo: 'iPad Air 11 WIFI+CELL 256GB', precio: 739.99 },
      { marca: 'Apple', modelo: 'iPad Air 11 WIFI+CELL 128GB', precio: 889.99 },
      { marca: 'Apple', modelo: 'iPad Pro 11 WIFI+CELL 256GB', precio: 1269.99 },
      { marca: 'Apple', modelo: 'iPad Pro 13 WIFI+CELL 256GB', precio: 1589.99 },
    ]
  },
  {
    id: 'br-mifi-tablet-300-extreme-24',
    beneficio: 'credito',
    planMin: 75, planMax: 75,
    tipo: 'multilinea',
    familias: ['extreme'],
    eventos: SOLO_RENOVACION,
    titulo: 'Descuento $300 - Modems, MiFi y Tablets Business RED Extreme',
    plazos: [24],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'Ver boletin Business RED', fi: 'Ver boletin Business RED' },
    bonoStreaming: true, lineaLimit: 10, credito: 300,
    nota: 'Aplica a renovaciones de modems, MiFi y tablets en Business RED Extreme, lineas 1-10 por BAN. Credito mensual en 24 plazos. Sin pago inicial ni trade-in.',
    equipos: [
      { marca: 'PCD', modelo: 'Modem R402', precio: 99.99 },
      { marca: 'Dlink', modelo: 'Router DWR-920V', precio: 99.99 },
      { marca: 'Franklin', modelo: 'RT 410 MIFI', precio: 99.99 },
      { marca: 'Franklin', modelo: 'RT910 MiFi', precio: 139.99 },
      { marca: 'SenseConnect', modelo: 'SC421', precio: 149.99 },
      { marca: 'Franklin', modelo: 'JEXstream CG890 5G', precio: 249.99 },
      { marca: 'Franklin', modelo: 'JEXstream RG2100 5G', precio: 299.99 },
      { marca: 'Franklin', modelo: 'RG1000 5G', precio: 399.99 },
      { marca: 'Apple', modelo: 'iPad 10.9 GPS+ Cell 64GB', precio: 499.99 },
      { marca: 'Apple', modelo: 'iPad 11 WIFI+CELL 128GB', precio: 539.99 },
      { marca: 'Samsung', modelo: 'Galaxy Tab S9 FE 128GB', precio: 549.99 },
      { marca: 'Samsung', modelo: 'Galaxy Tab S10 FE 128GB', precio: 574.99 },
      { marca: 'Netgear', modelo: 'M6 PRO MIFI', precio: 599.99 },
      { marca: 'Apple', modelo: 'iPad Air 11 WIFI+CELL 256GB', precio: 739.99 },
      { marca: 'Apple', modelo: 'iPad Air 11 WIFI+CELL 128GB', precio: 889.99 },
      { marca: 'Apple', modelo: 'iPad Pro 11 WIFI+CELL 256GB', precio: 1269.99 },
      { marca: 'Apple', modelo: 'iPad Pro 13 WIFI+CELL 256GB', precio: 1589.99 },
    ]
  },
  {
    id: 'br-mifi-tablet-400-extreme-30',
    beneficio: 'credito',
    planMin: 75, planMax: 75,
    tipo: 'multilinea',
    familias: ['extreme'],
    eventos: SOLO_RENOVACION,
    titulo: 'Descuento $400 - Modems, MiFi y Tablets Business RED Extreme',
    plazos: [30],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'Ver boletin Business RED', fi: 'Ver boletin Business RED' },
    bonoStreaming: true, lineaLimit: 10, credito: 400,
    nota: 'Aplica a renovaciones de modems, MiFi y tablets en Business RED Extreme, lineas 1-10 por BAN. Credito mensual en 30 plazos. Sin pago inicial ni trade-in.',
    equipos: [
      { marca: 'PCD', modelo: 'Modem R402', precio: 99.99 },
      { marca: 'Dlink', modelo: 'Router DWR-920V', precio: 99.99 },
      { marca: 'Franklin', modelo: 'RT 410 MIFI', precio: 99.99 },
      { marca: 'Franklin', modelo: 'RT910 MiFi', precio: 139.99 },
      { marca: 'SenseConnect', modelo: 'SC421', precio: 149.99 },
      { marca: 'Franklin', modelo: 'JEXstream CG890 5G', precio: 249.99 },
      { marca: 'Franklin', modelo: 'JEXstream RG2100 5G', precio: 299.99 },
      { marca: 'Franklin', modelo: 'RG1000 5G', precio: 399.99 },
      { marca: 'Apple', modelo: 'iPad 10.9 GPS+ Cell 64GB', precio: 499.99 },
      { marca: 'Apple', modelo: 'iPad 11 WIFI+CELL 128GB', precio: 539.99 },
      { marca: 'Samsung', modelo: 'Galaxy Tab S9 FE 128GB', precio: 549.99 },
      { marca: 'Samsung', modelo: 'Galaxy Tab S10 FE 128GB', precio: 574.99 },
      { marca: 'Netgear', modelo: 'M6 PRO MIFI', precio: 599.99 },
      { marca: 'Apple', modelo: 'iPad Air 11 WIFI+CELL 256GB', precio: 739.99 },
      { marca: 'Apple', modelo: 'iPad Air 11 WIFI+CELL 128GB', precio: 889.99 },
      { marca: 'Apple', modelo: 'iPad Pro 11 WIFI+CELL 256GB', precio: 1269.99 },
      { marca: 'Apple', modelo: 'iPad Pro 13 WIFI+CELL 256GB', precio: 1589.99 },
    ]
  },
  {
    id: 'br-mifi-tablet-500-supreme',
    beneficio: 'credito',
    planMin: 95, planMax: 9999,
    tipo: 'multilinea',
    familias: ['supreme','sinfronteras'],
    eventos: SOLO_RENOVACION,
    titulo: 'Descuento $500 - Modems, MiFi y Tablets Business RED Supreme/Sin Fronteras',
    plazos: [24],
    tradeinNueva: false, tradeinRenov: false,
    pricecodes: { up: 'Ver boletin Business RED', fi: 'Ver boletin Business RED' },
    bonoStreaming: true, lineaLimit: 10, credito: 500,
    nota: 'Aplica a renovaciones de modems, MiFi y tablets en Business RED Supreme y Sin Fronteras, lineas 1-10 por BAN. Credito mensual en 24 plazos. Sin pago inicial ni trade-in.',
    equipos: [
      { marca: 'PCD', modelo: 'Modem R402', precio: 99.99 },
      { marca: 'Dlink', modelo: 'Router DWR-920V', precio: 99.99 },
      { marca: 'Franklin', modelo: 'RT 410 MIFI', precio: 99.99 },
      { marca: 'Franklin', modelo: 'RT910 MiFi', precio: 139.99 },
      { marca: 'SenseConnect', modelo: 'SC421', precio: 149.99 },
      { marca: 'Franklin', modelo: 'JEXstream CG890 5G', precio: 249.99 },
      { marca: 'Franklin', modelo: 'JEXstream RG2100 5G', precio: 299.99 },
      { marca: 'Franklin', modelo: 'RG1000 5G', precio: 399.99 },
      { marca: 'Apple', modelo: 'iPad 10.9 GPS+ Cell 64GB', precio: 499.99 },
      { marca: 'Apple', modelo: 'iPad 11 WIFI+CELL 128GB', precio: 539.99 },
      { marca: 'Samsung', modelo: 'Galaxy Tab S9 FE 128GB', precio: 549.99 },
      { marca: 'Samsung', modelo: 'Galaxy Tab S10 FE 128GB', precio: 574.99 },
      { marca: 'Netgear', modelo: 'M6 PRO MIFI', precio: 599.99 },
      { marca: 'Apple', modelo: 'iPad Air 11 WIFI+CELL 256GB', precio: 739.99 },
      { marca: 'Apple', modelo: 'iPad Air 11 WIFI+CELL 128GB', precio: 889.99 },
      { marca: 'Apple', modelo: 'iPad Pro 11 WIFI+CELL 256GB', precio: 1269.99 },
      { marca: 'Apple', modelo: 'iPad Pro 13 WIFI+CELL 256GB', precio: 1589.99 },
    ]
  },

];

// Exponer global para los scripts de logica y UI
window.OFERTAS_DATA = OFERTAS_DATA;
