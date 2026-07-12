# newcrm

CRM activo de ventas y operaciones.

## Inicio rapido

```powershell
cd backend
npm install
npm start
```

El backend inicia en `http://localhost:4000` por defecto y sirve:

- CRM: `frontend/app.html`.
- Portal local: `Planes para web/` bajo `/constructor`.
- API: rutas montadas desde `backend/src/server.js`.

## Estructura

- `backend/src/server.js`: entrada real del backend.
- `backend/src/routes/`: rutas y handlers HTTP.
- `backend/src/services/`: logica reutilizable.
- `backend/migrations/`: cambios de schema revisables.
- `backend/test/`: pruebas con `node:test`.
- `frontend/`: SPA estatica del CRM.
- `Planes para web/`: portal de ofertas local.
- `docs/motor-ofertas/`: auditoria y diseno del motor de ofertas.
- `originales/`: archivo historico de documentacion de `VentasProui`.

## Reglas

Leer primero `AGENTS.md` y `CLAUDE.md`.

`newcrm` es el destino de toda implementacion nueva. `VentasProui` queda solo como referencia funcional durante su retiro.

No ejecutar migraciones, backfills ni deploys sin autorizacion expresa.
