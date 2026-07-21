# MVP Motor de Ofertas Moviles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar localmente el recorrido de dos Excel hasta equipos elegibles consumidos por la modal movil.

**Architecture:** `newcrm` incorpora archivo de fuentes, handlers y rutas independientes bajo `/api/motor-ofertas`, reutilizando contratos, normalizador, lifecycle y repositorio existentes. El Admin Ofertas conserva su pantalla y agrega el flujo movil; `ofertas-proui` solo adapta autenticacion y modal para consumir `/elegibles`.

**Tech Stack:** Node.js ESM, Express, PostgreSQL, Zod, XLSX, multer, node:test, HTML/CSS/JavaScript y Playwright.

---

### Task 1: Archivo idempotente de fuentes

**Files:**
- Create: `backend/src/services/motorOfertasSourceArchive.js`
- Create: `backend/test/motor-ofertas-source-archive.test.js`
- Modify: `backend/.env.example`

- [ ] **Step 1: Write the failing tests**

Probar nombre sanitizado, SHA-256 real, ruta relativa, reutilizacion por hash y manifiesto estable:

```js
const manifestA = buildSourcesManifest([
  { type: 'lista_precios', sha256: 'b'.repeat(64) },
  { type: 'tabla_financiamiento', sha256: 'a'.repeat(64) },
]);
assert.deepEqual(manifestA, buildSourcesManifest([...manifestA.entries].reverse()));
```

- [ ] **Step 2: Run RED**

Run: `node --test test/motor-ofertas-source-archive.test.js`
Expected: FAIL porque el servicio no existe.

- [ ] **Step 3: Implement minimal archive service**

Exportar:

```js
export async function archiveOfferSource({ rootDir, type, originalName, mimeType, buffer }) {}
export function buildSourcesManifest(sources) {}
```

El archivo fisico usa `<tipo>/<sha256>-<nombre-seguro>` y el manifiesto ordena por `type`, luego `sha256`.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/motor-ofertas-source-archive.test.js`

Commit: `feat(newcrm): archivar fuentes del motor de ofertas`

### Task 2: Elegibilidad movil pura

**Files:**
- Create: `backend/src/services/motorOfertasEligibility.js`
- Create: `backend/test/motor-ofertas-eligibility.test.js`

- [ ] **Step 1: Write the failing matrix**

Cubrir individual, Business RED, eventos, convergencia, limite BAN, vigencia, plazo confirmado y ausencia de resultados. La salida no incluye catalogo general:

```js
const result = evaluateEligibleOffers({ request, snapshot });
assert.deepEqual(result.equipos.map((item) => item.sku_sif), ['33979H']);
assert.equal(result.aplicacion_automatica, true);
```

- [ ] **Step 2: Run RED**

Run: `node --test test/motor-ofertas-eligibility.test.js`
Expected: FAIL porque el evaluador no existe.

- [ ] **Step 3: Implement exact filtering**

```js
export function evaluateEligibleOffers({ request, snapshot, today = new Date() }) {}
```

Validar la entrada con `parseEligibilityRequest`; filtrar solo ofertas/equipos confirmados y devolver fuente, vigencia y validaciones. Fuente vencida implica `aplicacion_automatica: false`.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/motor-ofertas-eligibility.test.js`

Commit: `feat(newcrm): evaluar equipos elegibles por linea movil`

### Task 3: Handlers y cuatro endpoints

**Files:**
- Create: `backend/src/services/motorOfertasHandlers.js`
- Create: `backend/src/routes/motorOfertasRoutes.js`
- Create: `backend/test/motor-ofertas-handlers.test.js`
- Create: `backend/test/motor-ofertas-routes.test.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Write RED handler and route tests**

Probar:

```js
assert.equal(await previewWithoutFiles().status, 422);
assert.deepEqual(previewWithoutFiles().body, {
  error: 'preview_incompleto',
  archivos_faltantes: ['tabla_financiamiento', 'lista_precios'],
});
```

Verificar `requireAuth` en las cuatro rutas y `requireAdmin` en preview/aprobar. Verificar 401 y 403 con middleware real.

- [ ] **Step 2: Run RED**

Run: `node --test test/motor-ofertas-handlers.test.js test/motor-ofertas-routes.test.js`
Expected: FAIL por archivos ausentes.

- [ ] **Step 3: Implement injected handlers and router**

```js
router.get('/version-vigente', requireAuth, handlers.versionVigente);
router.post('/preview', requireAuth, requireAdmin, upload.fields([
  { name: 'tabla_financiamiento', maxCount: 1 },
  { name: 'lista_precios', maxCount: 1 },
]), handlers.preview);
router.post('/aprobar', requireAuth, requireAdmin, handlers.aprobar);
router.post('/elegibles', requireAuth, handlers.elegibles);
```

Montar `app.use('/api/motor-ofertas', motorOfertasRouter)`.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/motor-ofertas-handlers.test.js test/motor-ofertas-routes.test.js`

Commit: `feat(newcrm): exponer API versionada de ofertas moviles`

### Task 4: Admin Ofertas existente

**Files:**
- Modify: `frontend/app.html`
- Create: `backend/test/motor-ofertas-admin-ui.test.js`

- [ ] **Step 1: Write RED UI contract test**

Verificar dos inputs distintos, preview, contradicciones, vigente y aprobacion:

```js
assert.match(html, /id="moTablaFinanciamiento"/);
assert.match(html, /id="moListaPrecios"/);
assert.match(html, /\/api\/motor-ofertas\/preview/);
assert.match(html, /\/api\/motor-ofertas\/aprobar/);
```

- [ ] **Step 2: Run RED**

Run: `node --test test/motor-ofertas-admin-ui.test.js`

- [ ] **Step 3: Implement inside `ofRenderOfertasTienda`**

Usar `apiForm` con ambos campos; renderizar resumen y contradicciones; deshabilitar aprobar si hay bloqueantes; recargar `version-vigente` al aprobar.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(newcrm): integrar motor movil en Admin Ofertas`

### Task 5: Token y modal API-first en ofertas-proui

**Files:**
- Modify: `C:/Users/Gabriel/Documentos/Programas/ofertas-proui/portal-auth.js`
- Modify: `C:/Users/Gabriel/Documentos/Programas/ofertas-proui/oferta-const.html`
- Create: `C:/Users/Gabriel/Documentos/Programas/ofertas-proui/tests/motor-ofertas-api-modal.test.js`

- [ ] **Step 1: Write RED portal tests**

Verificar getter encapsulado, Bearer y ausencia de fallback al catalogo:

```js
assert.match(auth, /getToken/);
assert.match(page, /\/api\/motor-ofertas\/elegibles/);
assert.match(page, /Authorization.*Bearer/);
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/motor-ofertas-api-modal.test.js`

- [ ] **Step 3: Implement portal adapter**

`portal-auth.js` expone `window.OfertasPortalAuth.getToken()` sin renderizar el valor. La modal construye `{ linea, contexto_ban }`, llama a `/elegibles` y renderiza solo `equipos` devueltos. 401, 403, 404 y lista vacia producen estados claros.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(ofertas): consumir elegibilidad movil del CRM`

### Task 6: Base aislada, recorrido local y capturas

**Files:**
- Create: `docs/motor-ofertas/05-validacion-local-mvp-2026-07-13.md`
- Create: `C:/Users/Gabriel/Documentos/Programas/ofertas-proui/captura-motor-ofertas-mvp-desktop.png`
- Create: `C:/Users/Gabriel/Documentos/Programas/ofertas-proui/captura-motor-ofertas-mvp-mobile.png`

- [ ] **Step 1: Verify isolated connection**

Registrar host sanitizado y nombre de base. Abortar si host, URL o nombre coinciden con produccion.

- [ ] **Step 2: Create local snapshot and rollback proof**

Crear backup local antes de aplicar SQL. Ejecutar migracion dentro de una transaccion de prueba y `ROLLBACK`; verificar ausencia de tablas. Luego aplicar solo a la base aislada autorizada.

- [ ] **Step 3: Run directed backend and portal tests**

Ejecutar solo pruebas del motor y contratos del portal. Los 10 fallos preexistentes permanecen como linea base separada.

- [ ] **Step 4: Run the local workflow**

Con token admin local: subir ambos Excel, revisar preview, aprobar, consultar vigente y abrir modal con una linea elegible. Probar tambien archivo faltante, 401, 403 y sin elegibles.

- [ ] **Step 5: Capture desktop and mobile**

Usar Playwright en desktop y movil; confirmar modal visible, datos no superpuestos y ausencia de errores de consola.

- [ ] **Step 6: Final scope verification**

Confirmar que no se modificaron seguro, fijo, Internet On-The-Go ni scripts de deploy. No ejecutar deploy.
