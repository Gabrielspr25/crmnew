# Motor versionado de ofertas - Plan de implementacion TDD en newcrm

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar en `newcrm` un motor backend persistente y versionado para ofertas moviles, con fuentes exactas, aprobacion auditada y elegibilidad por `LineaMovil` y contexto BAN.

**Architecture:** Usar tablas nuevas en `public`, snapshots JSONB y referencias opcionales al catalogo actual `public.equipos_lista`. Mantener handlers HTTP en `backend/src/routes/`, logica pura en `backend/src/services/` y pruebas con `node:test`, respetando la estructura real del repositorio.

**Tech Stack:** Node.js ESM, Express 4, PostgreSQL, `pg`, Multer, XLSX, `node:test` y `node:assert/strict`.

---

## Guardas de ejecucion

- Trabajar solo en `C:\Users\Gabriel\Documentos\Programas\newcrm`.
- Consultar `VentasProui` solo para comportamiento heredado; no modificarlo.
- No modificar `frontend/app.html` ni `Planes para web/`.
- No modificar `/api/equipos-lista` ni `/api/planes-modulos` salvo una correccion minima exigida por una prueba de compatibilidad.
- Crear la migracion, pero no ejecutarla contra ninguna base.
- No ejecutar backfills.
- No iniciar un servidor persistente.
- No hacer deploy.

## Mapa de archivos

Crear:

- `backend/migrations/2026-07-12-motor-ofertas-versionado.sql`
- `backend/src/services/motorOfertasContract.js`
- `backend/src/services/motorOfertasSourceArchive.js`
- `backend/src/services/motorOfertasNormalizer.js`
- `backend/src/services/motorOfertasLifecycle.js`
- `backend/src/services/motorOfertasRepository.js`
- `backend/src/services/motorOfertasEligibility.js`
- `backend/src/routes/motorOfertasRoutes.js`
- `backend/test/motor-ofertas-migration.test.js`
- `backend/test/motor-ofertas-contract.test.js`
- `backend/test/motor-ofertas-source-archive.test.js`
- `backend/test/motor-ofertas-normalizer.test.js`
- `backend/test/motor-ofertas-lifecycle.test.js`
- `backend/test/motor-ofertas-repository.test.js`
- `backend/test/motor-ofertas-eligibility.test.js`
- `backend/test/motor-ofertas-routes.test.js`
- `backend/test/motor-ofertas-wiring.test.js`
- `docs/motor-ofertas/05-api-motor-ofertas.md`

Modificar:

- `backend/src/server.js`
- `backend/.env.example`

No crear una carpeta `backend/src/controllers/`: en `newcrm`, los handlers viven en los modulos de rutas. `createMotorOfertasHandlers` sera la capa de controlador inyectable dentro de `motorOfertasRoutes.js`.

## Task 1: Definir la migracion versionada

**Files:**

- Create: `backend/test/motor-ofertas-migration.test.js`
- Create: `backend/migrations/2026-07-12-motor-ofertas-versionado.sql`

- [ ] **Step 1: Escribir la prueba RED de contrato SQL**

Crear `backend/test/motor-ofertas-migration.test.js`:

```javascript
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const sql = await readFile(
  new URL('../migrations/2026-07-12-motor-ofertas-versionado.sql', import.meta.url),
  'utf8'
);

const expectedStates = [
  'borrador',
  'pendiente_revision',
  'aprobada',
  'vigente',
  'reemplazada',
  'archivada',
];

test('crea las seis tablas del motor en public', () => {
  for (const table of [
    'motor_ofertas_versiones',
    'motor_ofertas_fuentes',
    'motor_ofertas',
    'motor_ofertas_equipos',
    'motor_ofertas_contradicciones',
    'motor_ofertas_historial',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  }
});

test('el estado de version contiene solo los seis estados aprobados', () => {
  const block = sql.match(/motor_ofertas_versiones_estado_chk[\s\S]*?CHECK \(estado IN \(([^;]+?)\)\)/)?.[1];
  assert.ok(block, 'falta el CHECK de estado');
  const states = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(states, expectedStates);
  assert.ok(!states.includes('contradiccion'));
  assert.ok(!states.includes('vencida'));
});

test('solo permite una version vigente por dominio', () => {
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*WHERE estado = 'vigente'/);
});

test('historial es append-only y no hay cascadas que borren versiones', () => {
  assert.match(sql, /motor_ofertas_historial_append_only/);
  assert.doesNotMatch(sql, /REFERENCES public\.motor_ofertas_versiones\(id\) ON DELETE CASCADE/);
});
```

- [ ] **Step 2: Ejecutar RED**

Run desde `backend/`:

```powershell
node --test test/motor-ofertas-migration.test.js
```

Expected: FAIL porque la migracion no existe.

- [ ] **Step 3: Crear la migracion minima**

Crear `backend/migrations/2026-07-12-motor-ofertas-versionado.sql` con:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.motor_ofertas_versiones (
  id UUID PRIMARY KEY,
  numero BIGSERIAL UNIQUE NOT NULL,
  dominio TEXT NOT NULL DEFAULT 'movil_equipos',
  estado TEXT NOT NULL,
  normalizador_version TEXT NOT NULL,
  fuentes_manifest_sha256 CHAR(64) NOT NULL,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  reemplaza_version_id UUID REFERENCES public.motor_ofertas_versiones(id) ON DELETE RESTRICT,
  creada_por TEXT NOT NULL,
  aprobada_por TEXT,
  activada_por TEXT,
  archivada_por TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aprobada_en TIMESTAMPTZ,
  activada_en TIMESTAMPTZ,
  reemplazada_en TIMESTAMPTZ,
  archivada_en TIMESTAMPTZ,
  CONSTRAINT motor_ofertas_versiones_estado_chk CHECK (estado IN (
    'borrador',
    'pendiente_revision',
    'aprobada',
    'vigente',
    'reemplazada',
    'archivada'
  )),
  CONSTRAINT motor_ofertas_versiones_identidad_uk UNIQUE (
    dominio,
    fuentes_manifest_sha256,
    normalizador_version
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS motor_ofertas_versiones_vigente_uk
  ON public.motor_ofertas_versiones (dominio)
  WHERE estado = 'vigente';

CREATE TABLE IF NOT EXISTS public.motor_ofertas_fuentes (
  id UUID PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES public.motor_ofertas_versiones(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL,
  nombre_original TEXT NOT NULL,
  nombre_archivado TEXT NOT NULL,
  ruta_relativa TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  mime_type TEXT NOT NULL,
  bytes BIGINT NOT NULL CHECK (bytes >= 0),
  vigencia_desde DATE,
  vigencia_hasta DATE,
  vigencia_documental TEXT NOT NULL DEFAULT 'pendiente_confirmacion',
  hoja TEXT,
  pagina INTEGER,
  fila_desde INTEGER,
  fila_hasta INTEGER,
  metadatos JSONB NOT NULL DEFAULT '{}'::jsonb,
  texto_extraido TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT motor_ofertas_fuentes_tipo_chk CHECK (tipo IN (
    'tabla_financiamiento',
    'lista_precios',
    'boletin',
    'seguro',
    'aprobacion_negocio',
    'otra'
  )),
  CONSTRAINT motor_ofertas_fuentes_vigencia_chk CHECK (vigencia_documental IN (
    'vigente',
    'vencida_pendiente_reemplazo',
    'vencida',
    'futura',
    'pendiente_confirmacion'
  )),
  CONSTRAINT motor_ofertas_fuentes_hash_uk UNIQUE (version_id, tipo, sha256)
);

CREATE TABLE IF NOT EXISTS public.motor_ofertas (
  id UUID PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES public.motor_ofertas_versiones(id) ON DELETE RESTRICT,
  oferta_key TEXT NOT NULL,
  nombre TEXT NOT NULL,
  estado_comercial TEXT NOT NULL,
  vigencia_documental TEXT NOT NULL,
  vigencia_desde DATE,
  vigencia_hasta DATE,
  tipos_plan TEXT[] NOT NULL DEFAULT '{}',
  familias TEXT[] NOT NULL DEFAULT '{}',
  eventos TEXT[] NOT NULL DEFAULT '{}',
  plazos SMALLINT[] NOT NULL DEFAULT '{}',
  plan_monto_minimo NUMERIC(10,2),
  plan_monto_maximo NUMERIC(10,2),
  fuente_principal_id UUID REFERENCES public.motor_ofertas_fuentes(id) ON DELETE RESTRICT,
  fuente_hoja TEXT,
  fuente_fila INTEGER,
  contrato JSONB NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT motor_ofertas_estado_comercial_chk CHECK (estado_comercial IN (
    'confirmada',
    'confirmada_parcial',
    'pendiente_fuente',
    'pendiente_vigencia',
    'pendiente_negocio',
    'contradiccion',
    'implementacion_referencia',
    'archivada'
  )),
  CONSTRAINT motor_ofertas_vigencia_documental_chk CHECK (vigencia_documental IN (
    'vigente',
    'vencida_pendiente_reemplazo',
    'vencida',
    'futura',
    'pendiente_confirmacion'
  )),
  CONSTRAINT motor_ofertas_oferta_version_uk UNIQUE (version_id, oferta_key)
);

CREATE INDEX IF NOT EXISTS motor_ofertas_busqueda_idx
  ON public.motor_ofertas (version_id, estado_comercial, plan_monto_minimo);
CREATE INDEX IF NOT EXISTS motor_ofertas_tipos_plan_gin
  ON public.motor_ofertas USING GIN (tipos_plan);
CREATE INDEX IF NOT EXISTS motor_ofertas_eventos_gin
  ON public.motor_ofertas USING GIN (eventos);

CREATE TABLE IF NOT EXISTS public.motor_ofertas_equipos (
  id UUID PRIMARY KEY,
  oferta_id UUID NOT NULL REFERENCES public.motor_ofertas(id) ON DELETE RESTRICT,
  equipo_lista_id INTEGER REFERENCES public.equipos_lista(id) ON DELETE SET NULL,
  equipo_key TEXT NOT NULL,
  modelo_comercial TEXT NOT NULL,
  modelo_oficial TEXT,
  sku_sif TEXT,
  sap TEXT,
  precio_regular NUMERIC(10,2),
  plazo SMALLINT NOT NULL CHECK (plazo > 0),
  pago_mensual NUMERIC(10,2),
  descuento NUMERIC(10,2),
  credito NUMERIC(10,2),
  beneficio_tipo TEXT,
  fuente_precio_id UUID REFERENCES public.motor_ofertas_fuentes(id) ON DELETE RESTRICT,
  fuente_regla_id UUID REFERENCES public.motor_ofertas_fuentes(id) ON DELETE RESTRICT,
  coincidencia TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT motor_ofertas_equipos_coincidencia_chk CHECK (coincidencia IN (
    'exacta',
    'equivalencia_aprobada',
    'pendiente'
  )),
  CONSTRAINT motor_ofertas_equipos_oferta_uk UNIQUE (oferta_id, equipo_key, plazo)
);

CREATE INDEX IF NOT EXISTS motor_ofertas_equipos_sku_idx
  ON public.motor_ofertas_equipos (sku_sif);

CREATE TABLE IF NOT EXISTS public.motor_ofertas_contradicciones (
  id UUID PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES public.motor_ofertas_versiones(id) ON DELETE RESTRICT,
  oferta_id UUID REFERENCES public.motor_ofertas(id) ON DELETE RESTRICT,
  codigo TEXT NOT NULL,
  severidad TEXT NOT NULL,
  bloqueante BOOLEAN NOT NULL DEFAULT FALSE,
  estado TEXT NOT NULL DEFAULT 'abierta',
  detalle TEXT NOT NULL,
  fuentes_enfrentadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolucion JSONB,
  creada_por TEXT NOT NULL,
  resuelta_por TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_en TIMESTAMPTZ,
  CONSTRAINT motor_ofertas_contradicciones_severidad_chk CHECK (severidad IN (
    'info', 'warning', 'error'
  )),
  CONSTRAINT motor_ofertas_contradicciones_estado_chk CHECK (estado IN (
    'abierta', 'resuelta', 'descartada'
  ))
);

CREATE INDEX IF NOT EXISTS motor_ofertas_contradicciones_abiertas_idx
  ON public.motor_ofertas_contradicciones (version_id, bloqueante)
  WHERE estado = 'abierta';

CREATE TABLE IF NOT EXISTS public.motor_ofertas_historial (
  id BIGSERIAL PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES public.motor_ofertas_versiones(id) ON DELETE RESTRICT,
  estado_anterior TEXT,
  estado_nuevo TEXT NOT NULL,
  actor TEXT NOT NULL,
  motivo TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.motor_ofertas_historial_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'motor_ofertas_historial es append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_motor_ofertas_historial_append_only
  ON public.motor_ofertas_historial;
CREATE TRIGGER trg_motor_ofertas_historial_append_only
  BEFORE UPDATE OR DELETE ON public.motor_ofertas_historial
  FOR EACH ROW EXECUTE FUNCTION public.motor_ofertas_historial_append_only();

COMMIT;
```

- [ ] **Step 4: Ejecutar GREEN sin ejecutar SQL**

Run:

```powershell
node --test test/motor-ofertas-migration.test.js
```

Expected: PASS. No ejecutar `psql` ni conectar a una base.

- [ ] **Step 5: Commit**

```powershell
git add backend/migrations/2026-07-12-motor-ofertas-versionado.sql backend/test/motor-ofertas-migration.test.js
git commit -m "feat(newcrm): definir schema versionado de ofertas"
```

## Task 2: Validar contratos Oferta y LineaMovil

**Files:**

- Create: `backend/test/motor-ofertas-contract.test.js`
- Create: `backend/src/services/motorOfertasContract.js`

- [ ] **Step 1: Escribir pruebas RED**

La prueba debe cubrir:

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  VERSION_STATES,
  validateEligibilityRequest,
  validateOfferContract,
} from '../src/services/motorOfertasContract.js';

test('version expone solo los seis estados aprobados', () => {
  assert.deepEqual(VERSION_STATES, [
    'borrador',
    'pendiente_revision',
    'aprobada',
    'vigente',
    'reemplazada',
    'archivada',
  ]);
});

test('acepta LineaMovil con contexto BAN', () => {
  const result = validateEligibilityRequest({
    linea: {
      id: 'linea_005',
      indice: 5,
      ban: '123456789',
      tipo: 'multilinea_business_red',
      familia_business_red: 'business_red_plus',
      plan: { codigo: 'BRPLUS', nombre: 'Business RED Plus', monto: 60 },
      evento: 'linea_nueva',
      convergente: true,
      trade_in: { estado: 'no_requiere', validado: false },
    },
    contexto_ban: {
      posicion_en_ban: 5,
      beneficios_usados_por_oferta: { oferta_gratis_35: 4 },
    },
  });
  assert.equal(result.ok, true);
});

test('rechaza evento y cantidad BAN invalidos', () => {
  const result = validateEligibilityRequest({
    linea: {
      id: 'l1',
      tipo: 'individual',
      plan: { codigo: 'P35', nombre: 'Plan $35', monto: 35 },
      evento: 'both',
      convergente: false,
      trade_in: { estado: 'no_requiere', validado: false },
    },
    contexto_ban: {
      posicion_en_ban: 11,
      beneficios_usados_por_oferta: {},
    },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === 'linea.evento'));
  assert.ok(result.errors.some((error) => error.path === 'contexto_ban.posicion_en_ban'));
});

test('Oferta exige fuente, vigencia y reglas explicitas', () => {
  const result = validateOfferContract({
    id: 'oferta_gratis_35',
    nombre: 'Equipo gratis',
    estado: 'confirmada',
    vigencia: { desde: '2026-07-04', hasta: '2026-07-15', estado: 'vigente' },
    tipos_plan: ['individual', 'multilinea_business_red'],
    familias: ['business_red_plus'],
    eventos: ['linea_nueva', 'portabilidad', 'renovacion'],
    plazos: [24],
    limite_ban: { aplica: true, cantidad: 4, fuera_limite: 'financiado_si_fuente_lo_permite' },
    equipos: [],
    fuente: { tipo: 'tabla_financiamiento', hoja: 'Ofertas Equipos en Portafolio', fila: 4 },
  });
  assert.equal(result.ok, true);
});
```

- [ ] **Step 2: Ejecutar RED**

```powershell
node --test test/motor-ofertas-contract.test.js
```

Expected: FAIL por modulo inexistente.

- [ ] **Step 3: Implementar validadores sin dependencia nueva**

`motorOfertasContract.js` debe exportar constantes congeladas y dos funciones que devuelvan `{ ok, value, errors }`. Usar helpers pequenos:

```javascript
export const VERSION_STATES = Object.freeze([
  'borrador',
  'pendiente_revision',
  'aprobada',
  'vigente',
  'reemplazada',
  'archivada',
]);

export const LINE_TYPES = Object.freeze(['individual', 'multilinea_business_red']);
export const LINE_EVENTS = Object.freeze([
  'linea_nueva',
  'portabilidad',
  'renovacion',
  'linea_adicional',
]);
export const DOCUMENT_VALIDITY_STATES = Object.freeze([
  'vigente',
  'vencida_pendiente_reemplazo',
  'vencida',
  'futura',
  'pendiente_confirmacion',
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const issue = (errors, path, message) => errors.push({ path, message });

function requiredString(value, path, errors) {
  if (typeof value !== 'string' || !value.trim()) issue(errors, path, 'requerido');
}

export function validateEligibilityRequest(input) {
  const errors = [];
  if (!isObject(input)) return { ok: false, value: null, errors: [{ path: '', message: 'objeto requerido' }] };
  const line = input.linea;
  if (!isObject(line)) issue(errors, 'linea', 'objeto requerido');
  if (isObject(line)) {
    requiredString(line.id, 'linea.id', errors);
    if (!LINE_TYPES.includes(line.tipo)) issue(errors, 'linea.tipo', 'tipo invalido');
    if (!LINE_EVENTS.includes(line.evento)) issue(errors, 'linea.evento', 'evento invalido');
    if (typeof line.convergente !== 'boolean') issue(errors, 'linea.convergente', 'boolean requerido');
    if (!isObject(line.plan)) issue(errors, 'linea.plan', 'objeto requerido');
    else {
      requiredString(line.plan.codigo, 'linea.plan.codigo', errors);
      requiredString(line.plan.nombre, 'linea.plan.nombre', errors);
      if (!Number.isFinite(line.plan.monto) || line.plan.monto < 0) issue(errors, 'linea.plan.monto', 'monto invalido');
    }
    if (line.tipo === 'multilinea_business_red') {
      requiredString(line.familia_business_red, 'linea.familia_business_red', errors);
    }
    if (!isObject(line.trade_in)) issue(errors, 'linea.trade_in', 'objeto requerido');
    else if (typeof line.trade_in.validado !== 'boolean') issue(errors, 'linea.trade_in.validado', 'boolean requerido');
  }
  if (input.contexto_ban !== undefined) {
    const context = input.contexto_ban;
    if (!isObject(context)) issue(errors, 'contexto_ban', 'objeto requerido');
    else {
      if (!Number.isInteger(context.posicion_en_ban) || context.posicion_en_ban < 1 || context.posicion_en_ban > 10) {
        issue(errors, 'contexto_ban.posicion_en_ban', 'debe estar entre 1 y 10');
      }
      if (!isObject(context.beneficios_usados_por_oferta)) {
        issue(errors, 'contexto_ban.beneficios_usados_por_oferta', 'mapa requerido');
      } else {
        for (const [key, value] of Object.entries(context.beneficios_usados_por_oferta)) {
          if (!key || !Number.isInteger(value) || value < 0) {
            issue(errors, `contexto_ban.beneficios_usados_por_oferta.${key}`, 'cantidad invalida');
          }
        }
      }
    }
  }
  return { ok: errors.length === 0, value: errors.length ? null : input, errors };
}
```

`validateOfferContract` debe validar de forma equivalente: `id`, `nombre`, estado comercial, vigencia, arrays no ambiguos, limite BAN, equipos y fuente. Debe rechazar cualquier array que contenga `both`.

- [ ] **Step 4: Ejecutar GREEN**

```powershell
node --test test/motor-ofertas-contract.test.js
node --check src/services/motorOfertasContract.js
```

Expected: PASS y sintaxis valida.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/services/motorOfertasContract.js backend/test/motor-ofertas-contract.test.js
git commit -m "feat(newcrm): validar contratos del motor de ofertas"
```

## Task 3: Archivar fuentes y construir identidad idempotente

**Files:**

- Create: `backend/test/motor-ofertas-source-archive.test.js`
- Create: `backend/src/services/motorOfertasSourceArchive.js`
- Modify: `backend/.env.example`

- [ ] **Step 1: Escribir pruebas RED**

Probar con un directorio temporal que:

- sanitiza el nombre;
- calcula SHA-256 real;
- no acepta rutas del cliente;
- crea manifiesto estable sin depender del orden de archivos;
- reutiliza el mismo archivo por hash.

```javascript
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  archiveOfferSource,
  buildSourcesManifest,
} from '../src/services/motorOfertasSourceArchive.js';

test('archiva por hash con nombre seguro', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motor-ofertas-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await archiveOfferSource({
    rootDir: root,
    type: 'tabla_financiamiento',
    originalName: '../../Tabla Ofertas.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('contenido'),
  });
  assert.equal(result.originalName, '../../Tabla Ofertas.xlsx');
  assert.doesNotMatch(result.archivedName, /\.\./);
  assert.deepEqual(await readFile(path.join(root, result.relativePath)), Buffer.from('contenido'));
});

test('manifiesto es estable sin importar el orden', () => {
  const a = buildSourcesManifest([
    { type: 'lista_precios', sha256: 'b'.repeat(64) },
    { type: 'tabla_financiamiento', sha256: 'a'.repeat(64) },
  ]);
  const b = buildSourcesManifest([
    { type: 'tabla_financiamiento', sha256: 'a'.repeat(64) },
    { type: 'lista_precios', sha256: 'b'.repeat(64) },
  ]);
  assert.deepEqual(a, b);
});
```

- [ ] **Step 2: Ejecutar RED**

```powershell
node --test test/motor-ofertas-source-archive.test.js
```

- [ ] **Step 3: Implementar archivo por hash**

Usar solo `node:crypto`, `node:path` y `node:fs/promises`. El nombre fisico debe ser:

```text
<tipo>/<sha256>-<nombre-sanitizado>
```

`buildSourcesManifest` debe ordenar por `type`, luego `sha256`, serializar con `JSON.stringify` y devolver `{ entries, sha256 }`.

Agregar a `backend/.env.example`:

```dotenv
# Archivos oficiales archivados por el motor de ofertas.
MOTOR_OFERTAS_UPLOAD_DIR=./uploads/motor-ofertas
```

- [ ] **Step 4: Ejecutar GREEN**

```powershell
node --test test/motor-ofertas-source-archive.test.js
node --check src/services/motorOfertasSourceArchive.js
```

- [ ] **Step 5: Commit**

```powershell
git add backend/.env.example backend/src/services/motorOfertasSourceArchive.js backend/test/motor-ofertas-source-archive.test.js
git commit -m "feat(newcrm): archivar fuentes exactas de ofertas"
```

## Task 4: Normalizar tabla y lista oficial

**Files:**

- Create: `backend/test/motor-ofertas-normalizer.test.js`
- Create: `backend/src/services/motorOfertasNormalizer.js`

- [ ] **Step 1: Crear fixtures Excel dentro de la prueba**

No guardar binarios en Git. Usar XLSX para crear buffers en memoria con las hojas y columnas reales:

- `Ofertas Equipos en Portafolio`, encabezados en fila 3 y datos desde fila 4;
- `Finan Equipos Móvil`, columnas SKU, SAP, modelo, precio y mensualidades;
- `Ofertas Planes y Bonos`, encabezados en fila 3.

Casos de la prueba:

1. Plan $35, equipo gratis, 24 plazos, cuatro beneficios por BAN.
2. Plan $50, 50%, 30 plazos.
3. Renovacion con trade-in.
4. Equipo exacto por SKU.
5. Modelo sin SKU exacto crea `equipo_sin_coincidencia_exacta`.
6. Texto `both` crea contradiccion y no se persiste como alcance.

- [ ] **Step 2: Ejecutar RED**

```powershell
node --test test/motor-ofertas-normalizer.test.js
```

- [ ] **Step 3: Implementar funciones puras**

Exportar:

```javascript
export function parseMoney(value) {}
export function normalizeModel(value) {}
export function parsePlanScope(value) {}
export function parseEvents(offerText, termsText) {}
export function parseTerms(termsText) {}
export function indexPriceWorkbook(buffer) {}
export function normalizeOfferWorkbooks(input) {}
```

Contrato de `normalizeOfferWorkbooks`:

```javascript
const result = normalizeOfferWorkbooks({
  financingBuffer,
  priceListBuffer,
  sourceIds: {
    tabla_financiamiento: 'uuid-tabla',
    lista_precios: 'uuid-lista',
  },
  fileNames: {
    tabla_financiamiento: 'tabla.xlsx',
    lista_precios: 'lista.xlsx',
  },
});

// result
{
  offers: [],
  contradictions: [],
  inventory: { financingSheets: [], priceSheets: [] },
  summary: { offers: 0, equipment: 0, blockingContradictions: 0 }
}
```

Algoritmo obligatorio:

1. Leer todas las hojas con `header: 1` y conservar el numero de fila real.
2. Detectar encabezados por texto normalizado, no por posicion fija solamente.
3. En `Ofertas Equipos en Portafolio`, procesar filas que tengan oferta, plan y equipos.
4. Separar equipos por saltos de linea y limpiar `NUEVO!`, asteriscos y espacios sin perder el texto original.
5. Extraer monto minimo por expresiones `Plan de $N`, `Planes desde $N` y `Planes de $N en adelante`.
6. Extraer plazos solo de textos explicitos como `24 plazos`, `30 plazos` o `24 y 30`.
7. Extraer limite BAN por expresiones `cuatro (4) lineas por ban`, `1 hasta 10` y equivalentes.
8. Extraer eventos de la oferta y terminos; `linea adicional` se normaliza aparte.
9. Buscar precio por SKU/SIF exacto cuando este disponible.
10. Si la hoja de oferta solo tiene modelo, resolver por modelo normalizado univoco. Cero o mas de una coincidencia queda `pendiente` y crea contradiccion bloqueante.
11. Preservar hoja, fila, texto original y celdas en el contrato.
12. Validar cada oferta con `validateOfferContract`.

No implementar herencia por monto ni familia en el parser. La elegibilidad usa solo los alcances explicitamente normalizados.

- [ ] **Step 4: Ejecutar GREEN**

```powershell
node --test test/motor-ofertas-normalizer.test.js
node --check src/services/motorOfertasNormalizer.js
```

- [ ] **Step 5: Verificar la fuente real sin persistir**

Ejecutar un script de solo lectura que llame al normalizador con copias locales de las tres fuentes verificadas. Imprimir solo conteos, hojas y codigos de contradiccion; no imprimir filas comerciales completas.

Expected:

- detecta las seis hojas de financiamiento;
- detecta las siete hojas de lista de precios;
- no produce alcance `both`;
- las coincidencias no exactas quedan pendientes;
- no escribe en PostgreSQL.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/services/motorOfertasNormalizer.js backend/test/motor-ofertas-normalizer.test.js
git commit -m "feat(newcrm): normalizar fuentes oficiales de ofertas"
```

## Task 5: Definir ciclo de vida puro

**Files:**

- Create: `backend/test/motor-ofertas-lifecycle.test.js`
- Create: `backend/src/services/motorOfertasLifecycle.js`

- [ ] **Step 1: Escribir pruebas RED**

Probar:

- transiciones permitidas;
- rechazo de `pendiente_revision -> vigente` directo;
- activacion compuesta devuelve dos pasos;
- archivado no aplica a `vigente`;
- `contradiccion` y `vencida` nunca son estados validos.

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activationTransitions,
  assertTransition,
} from '../src/services/motorOfertasLifecycle.js';

test('activacion desde pendiente registra aprobada y vigente', () => {
  assert.deepEqual(activationTransitions('pendiente_revision'), [
    ['pendiente_revision', 'aprobada'],
    ['aprobada', 'vigente'],
  ]);
});

test('no permite atajo pendiente a vigente', () => {
  assert.throws(() => assertTransition('pendiente_revision', 'vigente'), /transicion_invalida/);
});
```

- [ ] **Step 2: Ejecutar RED**

```powershell
node --test test/motor-ofertas-lifecycle.test.js
```

- [ ] **Step 3: Implementar mapa inmutable**

```javascript
const TRANSITIONS = Object.freeze({
  borrador: Object.freeze(['pendiente_revision', 'archivada']),
  pendiente_revision: Object.freeze(['aprobada', 'archivada']),
  aprobada: Object.freeze(['vigente', 'archivada']),
  vigente: Object.freeze(['reemplazada']),
  reemplazada: Object.freeze(['archivada']),
  archivada: Object.freeze([]),
});
```

`assertTransition` debe lanzar un error con `code = 'transicion_invalida'`.

- [ ] **Step 4: Ejecutar GREEN y commit**

```powershell
node --test test/motor-ofertas-lifecycle.test.js
node --check src/services/motorOfertasLifecycle.js
git add backend/src/services/motorOfertasLifecycle.js backend/test/motor-ofertas-lifecycle.test.js
git commit -m "feat(newcrm): controlar ciclo de vida de versiones"
```

## Task 6: Persistir versiones con transacciones

**Files:**

- Create: `backend/test/motor-ofertas-repository.test.js`
- Create: `backend/src/services/motorOfertasRepository.js`

- [ ] **Step 1: Escribir pruebas RED con cliente PostgreSQL falso**

El fake debe registrar SQL y parametros. Probar:

- `createPreview` usa `BEGIN/COMMIT`;
- crea `borrador`, fuentes, ofertas, equipos y contradicciones;
- termina en `pendiente_revision` y agrega historial;
- rollback ante error;
- identidad existente devuelve `reutilizada: true` sin insertar;
- `approveVersion` bloquea la vigente con `FOR UPDATE`;
- una activacion compuesta escribe dos entradas de historial;
- vigente anterior pasa a `reemplazada`;
- contradiccion bloqueante abierta impide aprobar.

- [ ] **Step 2: Ejecutar RED**

```powershell
node --test test/motor-ofertas-repository.test.js
```

- [ ] **Step 3: Implementar factory inyectable**

```javascript
export function createMotorOfertasRepository({ pool, randomUUID, now }) {
  return {
    findVersionByIdentity,
    getCurrentVersion,
    getCurrentVersionWithSources,
    getEligibleSnapshot,
    createPreview,
    approveVersion,
  };
}
```

Reglas de implementacion:

- usar `pool.connect()` solo en operaciones transaccionales;
- usar parametros PostgreSQL, nunca concatenar valores del cliente;
- insertar UUID generados en Node;
- `createPreview` crea primero `borrador` y solo cambia a `pendiente_revision` despues de persistir todo;
- `approveVersion` consulta contradicciones bloqueantes abiertas dentro de la misma transaccion;
- usar `SELECT ... FOR UPDATE` para version objetivo y vigente;
- comparar `version_vigente_esperada` antes de cambiar estados;
- agregar historial para cada transicion;
- no exponer metodos de eliminacion.

- [ ] **Step 4: Ejecutar GREEN**

```powershell
node --test test/motor-ofertas-repository.test.js
node --check src/services/motorOfertasRepository.js
```

- [ ] **Step 5: Commit**

```powershell
git add backend/src/services/motorOfertasRepository.js backend/test/motor-ofertas-repository.test.js
git commit -m "feat(newcrm): persistir versiones y aprobaciones de ofertas"
```

## Task 7: Evaluar elegibilidad de LineaMovil

**Files:**

- Create: `backend/test/motor-ofertas-eligibility.test.js`
- Create: `backend/src/services/motorOfertasEligibility.js`

- [ ] **Step 1: Escribir matriz RED**

Crear builders `makeOffer`, `makeEquipment` y `makeRequest`. Cubrir como minimo:

- Individual $35;
- Individual $50;
- Business RED Plus, Extreme, Supreme y Sin Fronteras;
- linea nueva;
- portabilidad;
- renovacion sin trade-in cuando no se exige;
- renovacion con trade-in validado cuando se exige;
- linea adicional separada;
- posicion BAN dentro del limite;
- beneficio agotado por BAN;
- falta `contexto_ban`;
- fuente `vencida_pendiente_reemplazo`;
- seguro pendiente de fuente;
- sin equipos elegibles.

Una asercion clave:

```javascript
test('limite BAN cambia beneficio sin ocultar el equipo', () => {
  const result = findEligibleEquipment({
    offers: [makeOffer({
      id: 'oferta_gratis_35',
      limite_ban: {
        aplica: true,
        cantidad: 4,
        fuera_limite: 'financiado_si_fuente_lo_permite',
      },
    })],
    request: makeRequest({
      contexto_ban: {
        posicion_en_ban: 5,
        beneficios_usados_por_oferta: { oferta_gratis_35: 4 },
      },
    }),
  });
  assert.equal(result.equipos.length, 1);
  assert.equal(result.equipos[0].beneficio.tipo, 'financiado');
  assert.ok(result.equipos[0].validaciones.some((item) => item.codigo === 'limite_ban_excedido'));
});
```

- [ ] **Step 2: Ejecutar RED**

```powershell
node --test test/motor-ofertas-eligibility.test.js
```

- [ ] **Step 3: Implementar evaluador puro**

Exportar:

```javascript
export function findEligibleEquipment({ offers, request, version }) {}
```

Orden de filtros:

1. version y dominio;
2. estado comercial de oferta;
3. vigencia documental;
4. tipo de linea;
5. familia Business RED exacta;
6. monto y codigo de plan;
7. evento;
8. convergencia;
9. trade-in;
10. equipo con coincidencia exacta o equivalencia aprobada;
11. plazo documentado;
12. limite BAN;
13. seguro y beneficios opcionales con fuente.

El resultado debe ser determinista: ordenar por oferta exacta, beneficio confirmado, modelo oficial y plazo.

- [ ] **Step 4: Ejecutar GREEN y commit**

```powershell
node --test test/motor-ofertas-eligibility.test.js
node --check src/services/motorOfertasEligibility.js
git add backend/src/services/motorOfertasEligibility.js backend/test/motor-ofertas-eligibility.test.js
git commit -m "feat(newcrm): evaluar ofertas por linea y contexto BAN"
```

## Task 8: Exponer handlers y rutas de newcrm

**Files:**

- Create: `backend/test/motor-ofertas-routes.test.js`
- Create: `backend/src/routes/motorOfertasRoutes.js`

- [ ] **Step 1: Escribir pruebas RED de handlers**

Probar handlers con `req/res` falsos e inyeccion de repositorio:

- version vigente 200 y 404;
- preview exige los dos Excel;
- preview reutilizado no normaliza de nuevo;
- parser fatal responde 422;
- aprobar traduce errores de dominio a 409;
- elegibles valida entrada antes de consultar;
- elegibles sin version vigente responde 404;
- respuesta no expone rutas absolutas.

Probar ademas el stack de Express:

- todas las rutas pasan por `requireAuth`;
- preview y aprobar pasan por `requireAdmin`;
- no existe metodo DELETE.

- [ ] **Step 2: Ejecutar RED**

```powershell
node --test test/motor-ofertas-routes.test.js
```

- [ ] **Step 3: Implementar handlers inyectables**

`motorOfertasRoutes.js` debe exportar:

```javascript
export function createMotorOfertasHandlers(deps) {}
export function createMotorOfertasRouter(deps) {}
export const motorOfertasRouter = createMotorOfertasRouter(defaultDependencies);
```

Dependencias:

```javascript
{
  repository,
  normalizeOfferWorkbooks,
  archiveOfferSource,
  buildSourcesManifest,
  findEligibleEquipment,
  uploadRoot,
}
```

Configurar Multer con memoria:

```javascript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 13 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.xlsx', '.xls', '.pdf'];
    cb(allowed.includes(ext) ? null : new Error('tipo_archivo_invalido'), allowed.includes(ext));
  },
});
```

Campos:

```javascript
upload.fields([
  { name: 'tabla_financiamiento', maxCount: 1 },
  { name: 'lista_precios', maxCount: 1 },
  { name: 'boletines', maxCount: 10 },
  { name: 'seguro', maxCount: 1 },
])
```

Rutas:

```javascript
router.use(requireAuth);
router.get('/version-vigente', handlers.versionVigente);
router.post('/preview', requireAdmin, uploadSources, handlers.preview);
router.post('/aprobar', requireAdmin, handlers.aprobar);
router.post('/elegibles', handlers.elegibles);
```

El handler preview debe:

1. validar archivos y metadatos;
2. calcular manifiesto antes de normalizar;
3. consultar identidad existente;
4. si existe, devolverla con `reutilizada: true`;
5. archivar fuentes;
6. normalizar Excel;
7. persistir preview;
8. devolver resumen y contradicciones.

- [ ] **Step 4: Ejecutar GREEN**

```powershell
node --test test/motor-ofertas-routes.test.js
node --check src/routes/motorOfertasRoutes.js
```

- [ ] **Step 5: Commit**

```powershell
git add backend/src/routes/motorOfertasRoutes.js backend/test/motor-ofertas-routes.test.js
git commit -m "feat(newcrm): exponer API del motor de ofertas"
```

## Task 9: Montar, documentar y verificar sin deploy

**Files:**

- Create: `backend/test/motor-ofertas-wiring.test.js`
- Modify: `backend/src/server.js`
- Create: `docs/motor-ofertas/05-api-motor-ofertas.md`

- [ ] **Step 1: Escribir prueba RED de wiring**

```javascript
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const server = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/routes/motorOfertasRoutes.js', import.meta.url), 'utf8');

test('server real monta el router del motor', () => {
  assert.match(server, /import \{ motorOfertasRouter \} from '.\/routes\/motorOfertasRoutes\.js'/);
  assert.match(server, /app\.use\('\/api\/motor-ofertas', motorOfertasRouter\)/);
});

test('el motor no expone DELETE', () => {
  assert.doesNotMatch(routes, /router\.delete\(/);
});
```

- [ ] **Step 2: Ejecutar RED**

```powershell
node --test test/motor-ofertas-wiring.test.js
```

- [ ] **Step 3: Montar en el entrypoint real**

En `backend/src/server.js`, importar junto a las rutas actuales:

```javascript
import { motorOfertasRouter } from './routes/motorOfertasRoutes.js';
```

Montar despues de `planesRouter`:

```javascript
app.use('/api/motor-ofertas', motorOfertasRouter);
```

No modificar el montaje de `/api/equipos-lista` ni `/api/planes-modulos`.

- [ ] **Step 4: Documentar API**

`docs/motor-ofertas/05-api-motor-ofertas.md` debe copiar los contratos JSON aprobados de la especificacion e incluir:

- autenticacion y roles;
- campos multipart exactos;
- codigos 400, 401, 403, 404, 409, 422 y 500;
- seis estados de version;
- vigencia documental separada;
- contradicciones separadas;
- idempotencia;
- ausencia de DELETE;
- ejemplos de `LineaMovil` y `contexto_ban`.

- [ ] **Step 5: Ejecutar GREEN dirigido**

Desde `backend/`:

```powershell
node --test test/motor-ofertas-migration.test.js test/motor-ofertas-contract.test.js test/motor-ofertas-source-archive.test.js test/motor-ofertas-normalizer.test.js test/motor-ofertas-lifecycle.test.js test/motor-ofertas-repository.test.js test/motor-ofertas-eligibility.test.js test/motor-ofertas-routes.test.js test/motor-ofertas-wiring.test.js
```

Expected: 0 fallos.

- [ ] **Step 6: Ejecutar regresion completa de newcrm**

```powershell
node --test test/*.test.js
```

Expected: 0 fallos. Si una prueba heredada afirma una regla comercial contradicha por fuentes oficiales, no cambiar el motor para satisfacerla: documentar el conflicto y corregir esa prueba en un commit separado con fuente.

- [ ] **Step 7: Validar sintaxis**

```powershell
node --check src/server.js
node --check src/routes/motorOfertasRoutes.js
node --check src/services/motorOfertasContract.js
node --check src/services/motorOfertasSourceArchive.js
node --check src/services/motorOfertasNormalizer.js
node --check src/services/motorOfertasLifecycle.js
node --check src/services/motorOfertasRepository.js
node --check src/services/motorOfertasEligibility.js
```

Expected: todos exit code 0.

- [ ] **Step 8: Verificar alcance y ausencia de ejecucion**

```powershell
git status --short
git diff --name-only HEAD~1..HEAD
```

Confirmar:

- no aparece `frontend/app.html`;
- no aparece `Planes para web/`;
- no aparece ningun archivo de `VentasProui`;
- la migracion existe pero no fue ejecutada;
- no se ejecuto ningun backfill;
- no se inicio servidor persistente;
- no se ejecuto deploy.

- [ ] **Step 9: Commit final de wiring y contrato**

```powershell
git add backend/src/server.js backend/test/motor-ofertas-wiring.test.js docs/motor-ofertas/05-api-motor-ofertas.md
git commit -m "feat(newcrm): montar y documentar motor versionado de ofertas"
```

## Entrega posterior a la implementacion

Reportar:

- migracion creada y no ejecutada;
- tablas nuevas;
- archivos backend;
- contratos JSON;
- pruebas dirigidas y regresion completa con conteos;
- sintaxis validada;
- fuentes usadas y hashes;
- contradicciones abiertas;
- confirmacion explicita de que no hubo cambios de frontend, portal, modal, CRM viejo ni deploy.
