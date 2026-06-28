# Fuentes de verdad confirmadas

## Reglas de proyecto

- Instrucciones globales del repo: `AGENTS.md`.
- Memoria activa del proyecto: `CLAUDE.md`.
- Produccion: `server-FINAL.js`.
- SOV2 operativo: `/seguimiento` con `src/react-app/pages/SeguimientoOperativo.tsx`.
- `/mi-dia` queda legacy y redirige a `/clientes`.
- Comisiones: Tango API V2 como fuente oficial; legacy/POS solo fallback o
  comparacion donde el repo ya lo tenga marcado asi.
- No crear ni alterar tablas desde endpoints de lectura.
- No ejecutar backfills sin backup y autorizacion explicita.

## Suscriptores y BAN

- Ruta frontend standalone: `src/react-app/App.tsx` registra `/suscriptores-ban`.
- Pantalla standalone: `src/react-app/pages/SubscriberBanSync.tsx`.
- Modal desde cliente/BAN: `src/react-app/components/BanPasteSubscribersModal.tsx`.
- Rutas backend: `src/backend/routes/subscriberRoutes.js`.
- Controlador backend: `src/backend/controllers/subscriberController.js`.
- Cliente/BAN/metricas: `src/backend/controllers/clientController.js`.
- Vista principal de clientes: `src/react-app/pages/Clients.tsx`.

## Documentacion y contrato copiados

El inventario completo esta en `MANIFEST_DOCUMENTACION_EXISTENTE.csv`.
La copia preservada esta en `originales/`.

## Advertencias

- Este resumen esta basado en archivos del checkout local, no en una base de
  datos viva.
- No se ejecuto ningun backfill.
- No se hicieron cambios de schema.
- No se conecto a produccion.
