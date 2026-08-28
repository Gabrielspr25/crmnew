# Matriz 1 y filtros de equipos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar las líneas 5 a 10 de Business Red Plus con ofertas válidas de Portafolio y presentar los equipos por segmento y tipo.

**Architecture:** El endpoint de elegibilidad seguirá evaluando Matriz 1 como fuente prioritaria y reutilizará el motor general para consultar las ofertas publicadas de Portafolio. El backend fusionará resultados trazables y asignará una clasificación de presentación; el constructor solo filtrará los resultados devueltos.

**Tech Stack:** Node.js ESM, Express, PostgreSQL, `node:test`, HTML/JavaScript estático.

---

### Task 1: Fusionar Matriz 1 con Portafolio

**Files:**
- Modify: `backend/src/services/businessRedPlusEligibility.js`
- Modify: `backend/src/routes/motorOfertasRoutes.js`
- Test: `backend/test/business-red-plus-eligibility.test.js`

- [ ] **Step 1: Escribir una prueba fallida**

Agregar un caso que pase ofertas de Portafolio compatibles con Business Red Plus y compruebe que la línea 5 devuelve Matriz 1 como `gama_alta` y Portafolio como `gama_baja`, sin duplicar modelos.

- [ ] **Step 2: Confirmar rojo**

Run: `node --test backend/test/business-red-plus-eligibility.test.js`

Expected: FAIL porque el servicio todavía no recibe ni fusiona ofertas de Portafolio.

- [ ] **Step 3: Implementar la fusión mínima**

Extender `findBusinessRedPlusEligible` para recibir `offers` y `version`, llamar `findEligibleEquipment` solamente en posiciones 5 a 10, descartar filas que no incluyan Business Red Plus y fusionar por modelo/capacidad. Marcar resultados de Matriz 1 como `gama_alta` y Portafolio como `gama_baja`.

- [ ] **Step 4: Conectar datos publicados**

Modificar la consulta del endpoint para leer `datos` además de `resumen`, y pasarlos al servicio. No consultar HTML ni catálogos locales.

- [ ] **Step 5: Confirmar verde**

Run: `node --test backend/test/business-red-plus-eligibility.test.js backend/test/motor-ofertas-routes.test.js`

Expected: PASS.

### Task 2: Filtros del modal

**Files:**
- Modify: `Planes para web/oferta-const.html`
- Test: `backend/test/constructor-business-red-plus-contract.test.js`

- [ ] **Step 1: Escribir una prueba fallida**

Exigir los filtros `Todos`, `Gama alta`, `Gama baja`, `Tabletas` y `Módems`, además de la normalización Apple/iPhone a Apple.

- [ ] **Step 2: Confirmar rojo**

Run: `node --test backend/test/constructor-business-red-plus-contract.test.js`

Expected: FAIL porque el modal aún genera pestañas por marca.

- [ ] **Step 3: Implementar filtros**

Usar la clasificación del motor para Gama alta/baja y la categoría/modelo para Tabletas/Módems. `Todos` conserva la lista completa y `normalizedBrand` unifica Apple/iPhone como Apple.

- [ ] **Step 4: Confirmar verde y regresión**

Run: `node --test backend/test/constructor-business-red-plus-contract.test.js backend/test/oferta-const-portal.test.js backend/test/business-red-plus-eligibility.test.js backend/test/motor-ofertas-routes.test.js`

Expected: PASS.

### Task 3: Verificación integral

**Files:**
- Verify only.

- [ ] **Step 1: Validar sintaxis**

Run: `node --check backend/src/services/businessRedPlusEligibility.js`

Run: `node --check backend/src/routes/motorOfertasRoutes.js`

- [ ] **Step 2: Ejecutar suite dirigida**

Run: `node --test backend/test/business-red-plus-eligibility.test.js backend/test/business-red-plus-publication.test.js backend/test/motor-ofertas-normalizer.test.js backend/test/motor-ofertas-routes.test.js backend/test/constructor-business-red-plus-contract.test.js backend/test/oferta-const-portal.test.js`

Expected: PASS sin advertencias nuevas.
