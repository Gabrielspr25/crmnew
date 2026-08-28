# Asana Mi Dia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una agenda diaria unificada de llamadas, pasos y tareas generales dentro de Asana.

**Architecture:** Una tabla nueva conserva tareas independientes o vinculadas. Las rutas de Asana combinan esas tareas con llamadas agendadas y aplican alcance por vendedor. La SPA renderiza `Mi dia` en Asana y permite crear y completar tareas sin salir de la pantalla.

**Tech Stack:** PostgreSQL, Node.js ESM, Express, HTML/CSS/JavaScript estatico y node:test.

---

### Task 1: Contrato de datos

**Files:**
- Create: `backend/migrations/2026-08-27-asana-tasks.sql`
- Create: `backend/test/asana-tasks-contract.test.js`

- [ ] Escribir la prueba que exige tabla, restricciones, indices y relaciones opcionales.
- [ ] Ejecutar `node --test test/asana-tasks-contract.test.js` y confirmar el fallo.
- [ ] Crear la migracion idempotente de `public.asana_tasks`.
- [ ] Ejecutar la prueba y confirmar que pasa.

### Task 2: API de agenda

**Files:**
- Modify: `backend/src/routes/asanaReal.js`
- Test: `backend/test/asana-tasks-contract.test.js`

- [ ] Exigir rutas para listar agenda, crear tarea, actualizar estado y completar llamadas.
- [ ] Ejecutar la prueba y confirmar el fallo.
- [ ] Implementar validacion, alcance de vendedor y respuesta agrupable por fecha.
- [ ] Vincular la finalizacion de una tarea con su paso opcional.
- [ ] Ejecutar las pruebas enfocadas.

### Task 3: Interfaz Mi dia

**Files:**
- Modify: `frontend/app.html`
- Test: `backend/test/asana-tasks-contract.test.js`

- [ ] Exigir el bloque `Mi dia`, formulario de tarea general, grupos de agenda y acciones de completar.
- [ ] Ejecutar la prueba y confirmar el fallo.
- [ ] Renderizar la agenda dentro de Asana y el formulario de tarea dentro de la oportunidad.
- [ ] Conectar creación, finalización y recarga sin abandonar Asana.
- [ ] Ejecutar pruebas y validar sintaxis del script.

### Task 4: Verificacion final

**Files:**
- Test: `backend/test/asana-tasks-contract.test.js`
- Test: `backend/test/asana-interactions-contract.test.js`

- [ ] Ejecutar pruebas enfocadas.
- [ ] Ejecutar la suite general y separar fallos ajenos al alcance.
- [ ] Revisar `git diff --check` solo para los archivos del cambio.
- [ ] No desplegar sin autorizacion expresa y backup de base de datos.
