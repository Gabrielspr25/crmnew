# GPON y Reportes Inteligentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar oportunidades GPON/aumento por linea fija en la modal del cliente y preparar una caja de reportes inteligente de solo lectura.

**Architecture:** La revision GPON vive en una tabla separada por `subscriber_id` para no mezclar datos operativos importados con notas comerciales. El detalle del cliente trae la revision por `LEFT JOIN` y el frontend muestra controles solo en lineas fijas. Los reportes exponen consultas permitidas por intencion comercial, no SQL libre.

**Tech Stack:** Node.js ESM, Express, PostgreSQL, frontend estatico `frontend/app.html`, `node:test`.

---

### Task 1: Persistencia GPON

**Files:**
- Create: `backend/migrations/2026-07-28-subscriber-gpon-reviews.sql`
- Modify: `backend/src/routes/writeRoutes.js`
- Modify: `backend/src/routes/clientsReal.js`
- Test: `backend/test/gpon-review-contract.test.js`

- [ ] Crear prueba que exija tabla separada, endpoint `PUT /api/subscribers-real/:id/gpon-review`, y campos `gpon_applies`, `gpon_note`, `gpon_reviewed_at`.
- [ ] Ejecutar `node --test test/gpon-review-contract.test.js` y confirmar fallo.
- [ ] Crear migracion y endpoint de upsert por suscriptor.
- [ ] Unir la revision al detalle de cliente.
- [ ] Ejecutar pruebas dirigidas.

### Task 2: Modal del cliente

**Files:**
- Modify: `frontend/app.html`
- Test: `backend/test/gpon-review-ui-contract.test.js`

- [ ] Crear prueba que exija render GPON solo para lineas fijas y funcion `cliSaveGponReview`.
- [ ] Ejecutar prueba y confirmar fallo.
- [ ] Agregar campo corto ajustable, fecha y boton Guardar dentro de cada linea fija.
- [ ] Guardar sin cerrar modal y refrescar el cliente.
- [ ] Ejecutar pruebas dirigidas.

### Task 3: Reportes inteligentes

**Files:**
- Create: `backend/src/routes/reportsAiRoutes.js`
- Modify: `backend/src/server.js`
- Modify: `frontend/app.html`
- Test: `backend/test/reports-ai-contract.test.js`

- [ ] Crear prueba que exija endpoint `POST /api/reports-ai/query` y que rechace SQL libre.
- [ ] Implementar clasificador simple de intenciones: fijos GPON, vencidos, movil, fijo, convergente.
- [ ] Devolver tabla con columnas reales y resumen corto.
- [ ] Cambiar boton Reportes para abrir una caja inteligente.
- [ ] Ejecutar pruebas dirigidas.

### Task 4: Documentacion y deploy

**Files:**
- Create: `docs/REGLAS_GPON_REPORTES.md`

- [ ] Documentar campos, fuente, limites de IA y ejemplos de preguntas.
- [ ] Ejecutar `node --check` y pruebas.
- [ ] Backup de produccion.
- [ ] Subir archivos, aplicar migracion, reiniciar PM2.
- [ ] Verificar health, detalle de BAN `787601854` y endpoint de reportes.
