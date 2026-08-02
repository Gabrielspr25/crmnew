# Catalogo de Rentas Historicas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar rentas faltantes con un catalogo historico de SOC sin reemplazar valores obtenidos desde Tango V2.

**Architecture:** `public.plan_rate_catalog` conserva los SOC y rentas del archivo oficial recibido. Un resolvedor consulta Tango primero y, solo si Tango no devuelve una renta valida, consulta el catalogo por SOC exacto. La importacion y el alta manual usan el resolvedor sin sobrescribir una renta existente.

**Tech Stack:** Node.js ESM, Express, PostgreSQL, node:test.

---

### Task 1: Resolver puro del catalogo

**Files:**
- Create: `backend/src/services/planRateCatalog.js`
- Test: `backend/test/plan-rate-catalog.test.js`

- [ ] Escribir una prueba que exija coincidencia exacta, descarte renta cero y no normalice SOC moviles.
- [ ] Ejecutar `node --test test/plan-rate-catalog.test.js` y comprobar que falla porque el modulo no existe.
- [ ] Implementar el resolvedor puro y repetir la prueba hasta que pase.

### Task 2: Persistencia y prioridad Tango

**Files:**
- Create: `backend/migrations/2026-07-24-plan-rate-catalog.sql`
- Create: `backend/scripts/import-plan-rates.mjs`
- Modify: `backend/src/services/planRateCatalog.js`
- Test: `backend/test/plan-rate-catalog.test.js`

- [ ] Crear tabla catalogo con SOC unico, renta, archivo fuente y fecha de carga.
- [ ] Crear script transaccional que lea `SOC,RENT`, rechace codigos duplicados con rentas diferentes y preserve las rentas cero como no utilizables.
- [ ] Agregar consulta PostgreSQL que use solo rentas positivas y devuelva la fuente `catalogo-historico-plan-rates`.
- [ ] Ejecutar las pruebas del catalogo.

### Task 3: Usar respaldo sin sobrescribir datos existentes

**Files:**
- Modify: `backend/src/routes/importRoutes.js`
- Modify: `backend/src/routes/writeRoutes.js`
- Test: `backend/test/import-plan-rate-fallback-contract.test.js`

- [ ] Escribir una prueba que exija Tango primero, catalogo despues y que la importacion solo complete `monthly_value` cuando falta.
- [ ] Ejecutar la prueba y comprobar el fallo inicial.
- [ ] Implementar el uso del resolvedor para altas manuales e importaciones, con `monthly_value_source` solo cuando la tabla lo soporte.
- [ ] Ejecutar pruebas dirigidas del catalogo, importador y alta manual.

### Task 4: Simulacion sin actualizar suscriptores

**Files:**
- Create: `backend/scripts/preview-plan-rate-coverage.mjs`

- [ ] Crear script de solo lectura que compare `subscribers.price_code` y `subscribers.plan` con el catalogo y resuma coincidencias, ceros y faltantes.
- [ ] Ejecutarlo despues de cargar el catalogo en el entorno autorizado y guardar el resultado para revision de Gabriel.
