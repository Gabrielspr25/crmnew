# Catálogos visibles de Prospección Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar los rubros y municipios disponibles en Prospección con búsqueda local.

**Architecture:** El frontend reutiliza `rubros` y `municipios` que ya devuelve `GET /api/prospectos/meta`. La vista no escribe datos ni cambia los endpoints existentes.

**Tech Stack:** HTML, JavaScript sin framework, `node:test`.

---

### Task 1: Contrato visual del catálogo

**Files:**
- Modify: `backend/test/prospectos-apify-contract.test.js`
- Modify: `frontend/app.html:4340-4350`

- [ ] **Step 1: Write the failing test**

```js
test('Prospeccion muestra los catalogos de rubros y municipios', () => {
  assert.match(appHtml, /Rubros disponibles/);
  assert.match(appHtml, /Municipios disponibles/);
  assert.match(appHtml, /prCatalogSearch/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/prospectos-apify-contract.test.js`

Expected: la prueba de catálogos falla porque la interfaz aún solo muestra sus contadores.

- [ ] **Step 3: Write minimal implementation**

En `prRenderCtrl()`, agregar un bloque `details` debajo de los contadores con dos paneles: “Rubros disponibles” y “Municipios disponibles”. Crear `prCatalogSearch(kind, query)` para filtrar `prMeta.rubros` y `prMeta.municipios` en memoria y volver a renderizar solo ese bloque. Escapar todos los textos con `esc()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/prospectos-apify-contract.test.js`

Expected: todas las pruebas del contrato pasan.

- [ ] **Step 5: Commit**

```bash
git add frontend/app.html backend/test/prospectos-apify-contract.test.js
git commit -m "feat: mostrar catalogos de prospeccion"
```

### Task 2: Validación enfocada

**Files:**
- Modify: `frontend/app.html`
- Test: `backend/test/prospectos-apify-contract.test.js`

- [ ] **Step 1: Validate JavaScript syntax**

Run: `node --check /tmp/prospeccion-catalogos-check.js` after extracting the inline script from `frontend/app.html`.

Expected: exit code 0.

- [ ] **Step 2: Run the complete directed suite**

Run: `node --test test/prospectos-apify-contract.test.js test/prospectos-apify-service.test.js`

Expected: all tests pass.

- [ ] **Step 3: Inspect the scoped diff**

Run: `git diff -- frontend/app.html backend/test/prospectos-apify-contract.test.js`

Expected: only the catalog display and its contract check change; no database, Apify, Airtable, or client persistence code changes.
