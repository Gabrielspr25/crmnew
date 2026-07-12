# CLAUDE.md - Memoria activa de newcrm

Leer al inicio de cada sesion despues de `AGENTS.md`.

## Decision de repositorio

`newcrm` es el sistema activo. Toda funcionalidad nueva del CRM se disena, documenta, implementa y prueba aqui.

`VentasProui` es legado en proceso de retiro. Puede consultarse para identificar comportamiento previo, pero no es fuente arquitectonica ni destino de cambios. Una pieza heredada solo se traslada despues de validarla contra la arquitectura y las fuentes actuales de `newcrm`.

La carpeta `originales/` conserva documentacion historica de `VentasProui`. No gobierna este repositorio.

## Runtime real

- Entrada backend: `backend/src/server.js`.
- Comandos: `npm start` y `npm run dev` desde `backend/`.
- Puerto local por defecto: `4000`.
- Frontend: `frontend/app.html`, servido directamente por Express.
- Portal: `Planes para web/`, servido por Express bajo `/constructor`.
- Salud: `GET /api/health`.
- Autenticacion: JWT en `backend/src/auth.js`.
- Roles administrativos: middleware `requireAdmin` para `admin` y `supervisor`.
- Base de datos: PostgreSQL mediante `backend/src/db.js`.
- `DB_SCHEMA` define el primer schema del `search_path`; las tablas operativas actuales se consultan explicitamente en `public`.

## Convenciones de backend

- Las rutas estan en `backend/src/routes/` y se montan en `backend/src/server.js`.
- El repositorio no tiene una capa general `controllers/`; los handlers de ruta cumplen esa funcion.
- La logica pura y reutilizable vive en `backend/src/services/`.
- Las migraciones estan en `backend/migrations/`.
- Las pruebas usan `node:test`, no Vitest.
- No existe build de frontend. La validacion estatica del backend usa `node --check` y las pruebas dirigidas usan `node --test`.

## Arquitectura actual de ofertas

- `backend/src/routes/equiposRoutes.js`: preview y carga de listas Excel de equipos.
- `public.equipos_uploads`: historial de listas cargadas.
- `public.equipos_lista`: catalogo actual por `item_code`.
- `public.equipos_mensualidades`: pagos por plazo.
- `public.equipos_pospago`: precios por plan.
- `public.v_equipos_vigentes`: vista de equipos activos.
- `backend/src/routes/planesRoutes.js`: modulos de planes, preview PDF y aplicacion.
- `public.planes_modulos`: contenido publicado para fijo, movil e inalambrico.
- `frontend/app.html`: Admin Ofertas actual. La seccion de ofertas moviles aun es un placeholder.
- `docs/motor-ofertas/`: auditorias, matrices y catalogos normalizados de trabajo.

El motor versionado nuevo debe integrarse sin romper `/api/equipos-lista` ni `/api/planes-modulos`. La primera fase es backend y base de datos; no conecta el portal ni cambia el Admin Ofertas.

## Estados del motor de ofertas

Estado de version, y solo de version:

- `borrador`
- `pendiente_revision`
- `aprobada`
- `vigente`
- `reemplazada`
- `archivada`

`contradiccion` no es estado de version. Vive en `public.motor_ofertas_contradicciones`.

`vencida` no es estado de version. El vencimiento vive en `vigencia_documental` de las fuentes y ofertas.

## Reglas operativas

- No ejecutar migraciones ni backfills sin backup y autorizacion expresa.
- No publicar ni reiniciar servicios sin orden explicita.
- No borrar versiones anteriores del motor.
- No aplicar automaticamente reglas vencidas o sin fuente.
- Una oferta vencida puede permanecer visible mientras espera reemplazo, pero debe bloquear aplicacion automatica.
- JavaScript, HTML y matrices exploratorias sirven para comparar; nunca sustituyen una fuente comercial oficial.

Actualizado: 2026-07-12.

