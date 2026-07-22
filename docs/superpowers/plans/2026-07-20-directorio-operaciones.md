# Directorio Operaciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar un modulo independiente y editable para el Directorio Operaciones de Clientes Masivos, sin modificar clientes, BANs ni suscriptores.

**Architecture:** El modulo se guarda en `ventaspro_nuevo.directorio_operaciones`, con `employee_number` como llave estable. Una ruta propia lista, importa y edita contactos; el frontend agrega una pantalla compacta bajo `#/directorio`.

**Tech Stack:** Node.js ESM, Express, PostgreSQL, Multer, SheetJS y SPA estatica.

---

### Task 1: Contrato del modulo

**Files:**
- Create: `backend/test/directorio-operaciones-contract.test.js`

- [ ] Escribir pruebas que exijan ruta, migracion, menu, tabla y edicion.
- [ ] Ejecutar `node --test test/directorio-operaciones-contract.test.js` desde `backend/` y confirmar que falla antes de implementar.

### Task 2: Persistencia independiente

**Files:**
- Create: `backend/migrations/2026-07-20-directorio-operaciones.sql`

- [ ] Crear la tabla `ventaspro_nuevo.directorio_operaciones` con distrito, codigo, nombre, empleado, puesto, pueblos, celular, email y auditoria temporal.
- [ ] Usar `employee_number` como clave unica para que una nueva carga actualice, sin duplicar.
- [ ] No ejecutar la migracion ni cargar datos durante esta tarea.

### Task 3: API del directorio

**Files:**
- Create: `backend/src/routes/directorioOperacionesRoutes.js`
- Modify: `backend/src/server.js`

- [ ] Implementar listado con busqueda y filtro por distrito.
- [ ] Implementar importacion de la hoja `DIRECTORIO`, detectando encabezados y omitiendo filas de seccion sin empleado/nombre.
- [ ] Implementar edicion de un contacto.
- [ ] Restringir escritura e importacion a admin/supervisor y registrar cambios en la bitacora existente.

### Task 4: Pantalla compacta

**Files:**
- Modify: `frontend/app.html`

- [ ] Agregar `Directorio Operaciones` al menu.
- [ ] Renderizar busqueda, filtro por distrito, conteo y tabla compacta de contactos.
- [ ] Agregar accion `Actualizar desde Excel` y modal `Editar contacto`.
- [ ] Mantener el contenido operativo en tabla; no crear tarjetas grandes ni tocar Clientes.

### Task 5: Verificacion

**Files:**
- Test: `backend/test/directorio-operaciones-contract.test.js`

- [ ] Ejecutar prueba dirigida, `node --check` para la nueva ruta y servidor.
- [ ] Verificar el frontend con el servidor local existente.
- [ ] No desplegar ni ejecutar la migracion sin orden expresa.
