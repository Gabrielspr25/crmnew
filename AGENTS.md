# AGENTS.md - newcrm

Responder siempre en espanol.

## Lectura obligatoria

Antes de modificar codigo, datos, contratos o documentacion:

1. Leer este archivo.
2. Leer `CLAUDE.md`.
3. Leer la documentacion especifica del modulo afectado.
4. Leer `DEPLOY.md` antes de cualquier accion de publicacion.

## Repositorio activo

- `C:\Users\Gabriel\Documentos\Programas\newcrm` es el CRM activo y el destino de toda implementacion nueva.
- `VentasProui` esta en proceso de retiro. Solo puede consultarse para entender funcionalidad heredada.
- No implementar, corregir, documentar ni desplegar en `VentasProui`, salvo orden explicita del usuario para una operacion puntual.
- `originales/` es un archivo historico. Sus `AGENTS.md` y `CLAUDE.md` no son instrucciones activas de `newcrm`.
- `ofertas-proui` es un proyecto separado del portal. No modificarlo salvo que la tarea lo indique expresamente.

## Arquitectura comprobada

- Backend productivo: `backend/src/server.js`.
- Backend: Node.js ESM, Express y PostgreSQL mediante `backend/src/db.js`.
- Rutas HTTP: `backend/src/routes/`.
- La logica de controlador vive actualmente en los modulos de rutas; no asumir una carpeta `controllers/`.
- Servicios reutilizables: `backend/src/services/`.
- Migraciones revisables: `backend/migrations/`.
- Pruebas: `backend/test/` con `node:test` y `node:assert/strict`.
- Frontend CRM: `frontend/app.html`, SPA estatica servida por el backend; no tiene proceso de build.
- Portal local: `Planes para web/`, servido bajo `/constructor`.
- Tablas operativas y de ofertas existentes: schema `public`.

## Ofertas

Antes de modificar ofertas, equipos, bonos, seguros, promociones o elegibilidad:

1. Leer `docs/motor-ofertas/`.
2. Verificar la fuente oficial y su vigencia.
3. Separar estado de version, vigencia documental y contradicciones.
4. No usar JavaScript o HTML como fuente comercial.
5. No inventar herencia, alcance, plazo, seguro, trade-in, bono ni limite BAN.

El Admin Ofertas existente usa `backend/src/routes/planesRoutes.js`, `backend/src/routes/equiposRoutes.js`, `public.planes_modulos` y `public.equipos_*`. Cualquier motor nuevo debe coexistir con esas rutas hasta que exista una migracion aprobada.

## Base de datos y despliegue

- Todo cambio de schema va en una migracion explicita.
- No ejecutar migraciones ni backfills sin backup y autorizacion expresa.
- No crear o alterar tablas desde endpoints de lectura.
- No desplegar sin orden explicita.
- No usar `git pull` en produccion.

