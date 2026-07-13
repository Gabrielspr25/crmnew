import { z } from 'zod';

export const VERSION_STATES = Object.freeze([
  'borrador',
  'pendiente_revision',
  'aprobada',
  'vigente',
  'reemplazada',
  'archivada',
]);

export const DOCUMENT_VALIDITY_STATES = Object.freeze([
  'vigente',
  'vencida_pendiente_reemplazo',
  'vencida',
  'futura',
  'pendiente_confirmacion',
]);

export const OFFER_STATES = Object.freeze([
  'confirmada',
  'confirmada_parcial',
  'pendiente_fuente',
  'pendiente_vigencia',
  'pendiente_negocio',
  'contradiccion',
  'implementacion_referencia',
  'archivada',
]);

export const LINE_TYPES = Object.freeze([
  'individual',
  'multilinea_business_red',
]);

export const BUSINESS_RED_FAMILIES = Object.freeze([
  'business_red_plus',
  'business_red_extreme',
  'business_red_supreme',
  'business_red_sin_fronteras',
]);

export const LINE_EVENTS = Object.freeze([
  'linea_nueva',
  'portabilidad',
  'renovacion',
  'linea_adicional',
]);

export const SOURCE_TYPES = Object.freeze([
  'tabla_financiamiento',
  'lista_precios',
  'boletin',
  'seguro',
  'aprobacion_negocio',
  'otra',
]);

export const versionStateSchema = z.enum(VERSION_STATES);
export const documentValiditySchema = z.enum(DOCUMENT_VALIDITY_STATES);
export const offerStateSchema = z.enum(OFFER_STATES);
export const lineTypeSchema = z.enum(LINE_TYPES);
export const businessRedFamilySchema = z.enum(BUSINESS_RED_FAMILIES);
export const lineEventSchema = z.enum(LINE_EVENTS);
export const sourceTypeSchema = z.enum(SOURCE_TYPES);

export const planSchema = z.object({
  codigo: z.string().trim().min(1),
  nombre: z.string().trim().min(1),
  monto: z.number().finite().nonnegative(),
}).strict();

export const tradeInSchema = z.object({
  estado: z.string().trim().min(1),
  validado: z.boolean(),
}).passthrough();

export const mobileLineSchema = z.object({
  id: z.string().trim().min(1),
  indice: z.number().int().min(1).max(10).optional(),
  ban: z.string().trim().min(1).nullable().optional(),
  tipo: lineTypeSchema,
  familia_business_red: businessRedFamilySchema.nullable().optional(),
  plan: planSchema,
  evento: lineEventSchema,
  convergente: z.boolean(),
  trade_in: tradeInSchema,
}).strict().superRefine((line, context) => {
  if (
    line.tipo === 'multilinea_business_red' &&
    !line.familia_business_red
  ) {
    context.addIssue({
      code: 'custom',
      path: ['familia_business_red'],
      message: 'familia requerida para Business RED',
    });
  }

  if (line.tipo === 'individual' && line.familia_business_red) {
    context.addIssue({
      code: 'custom',
      path: ['familia_business_red'],
      message: 'familia no aplica a linea individual',
    });
  }
});

export const banContextSchema = z.object({
  posicion_en_ban: z.number().int().min(1).max(10),
  beneficios_usados_por_oferta: z.record(
    z.string().trim().min(1),
    z.number().int().nonnegative()
  ),
}).strict();

export const eligibilityRequestSchema = z.object({
  linea: mobileLineSchema,
  contexto_ban: banContextSchema.optional(),
}).strict();

export const validitySchema = z.object({
  desde: z.iso.date().nullable().optional(),
  hasta: z.iso.date().nullable().optional(),
  estado: documentValiditySchema,
}).strict().superRefine((validity, context) => {
  if (
    validity.desde &&
    validity.hasta &&
    validity.desde > validity.hasta
  ) {
    context.addIssue({
      code: 'custom',
      path: ['hasta'],
      message: 'vigencia hasta no puede ser anterior a desde',
    });
  }
});

export const banLimitSchema = z.object({
  aplica: z.boolean(),
  cantidad: z.number().int().positive().nullable(),
  fuera_limite: z.enum([
    'no_aplica',
    'financiado_si_fuente_lo_permite',
    'pendiente_fuente',
  ]),
}).strict().superRefine((limit, context) => {
  if (limit.aplica && limit.cantidad === null) {
    context.addIssue({
      code: 'custom',
      path: ['cantidad'],
      message: 'cantidad requerida cuando el limite BAN aplica',
    });
  }
});

export const offerSourceSchema = z.object({
  tipo: sourceTypeSchema,
  hoja: z.string().trim().min(1).optional(),
  pagina: z.number().int().positive().optional(),
  fila: z.number().int().positive().optional(),
  referencia: z.string().trim().min(1).optional(),
}).strict().superRefine((source, context) => {
  if (!source.hoja && !source.pagina && !source.referencia) {
    context.addIssue({
      code: 'custom',
      path: ['referencia'],
      message: 'la fuente requiere hoja, pagina o referencia',
    });
  }

  if (source.fila && !source.hoja) {
    context.addIssue({
      code: 'custom',
      path: ['fila'],
      message: 'fila requiere hoja',
    });
  }
});

export const offerEquipmentSchema = z.object({
  id: z.string().trim().min(1).optional(),
  equipo_key: z.string().trim().min(1).optional(),
  modelo_comercial: z.string().trim().min(1).optional(),
  modelo_oficial: z.string().trim().min(1).nullable().optional(),
  sku_sif: z.string().trim().min(1).nullable().optional(),
  sap: z.string().trim().min(1).nullable().optional(),
  precio_regular: z.number().finite().nonnegative().nullable().optional(),
  coincidencia: z.enum([
    'exacta',
    'equivalencia_aprobada',
    'pendiente',
  ]).optional(),
}).passthrough();

export const offerContractSchema = z.object({
  id: z.string().trim().min(1),
  nombre: z.string().trim().min(1),
  estado: offerStateSchema,
  vigencia: validitySchema,
  tipos_plan: z.array(lineTypeSchema).min(1),
  familias: z.array(businessRedFamilySchema),
  eventos: z.array(lineEventSchema).min(1),
  plazos: z.array(z.number().int().positive()).min(1),
  limite_ban: banLimitSchema,
  equipos: z.array(offerEquipmentSchema),
  fuente: offerSourceSchema,
}).strict().superRefine((offer, context) => {
  if (new Set(offer.plazos).size !== offer.plazos.length) {
    context.addIssue({
      code: 'custom',
      path: ['plazos'],
      message: 'los plazos no pueden repetirse',
    });
  }

  if (
    offer.tipos_plan.includes('multilinea_business_red') &&
    offer.familias.length === 0
  ) {
    context.addIssue({
      code: 'custom',
      path: ['familias'],
      message: 'Business RED requiere al menos una familia',
    });
  }
});

export const parseEligibilityRequest = (value) =>
  eligibilityRequestSchema.parse(value);

export const parseOfferContract = (value) =>
  offerContractSchema.parse(value);
