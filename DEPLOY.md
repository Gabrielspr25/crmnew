# DEPLOY — Sistema nuevo (newcrm)

Guía para deployar el sistema nuevo en el servidor, **reemplazando al viejo**.
Actualizado: 2026-06-29.

> Regla de oro: **backup → migración autorizada → backend → frontend → verificación.**
> No usar `git pull` en producción. Subir por `scp` y reiniciar PM2.

---

## 1. Qué es el sistema nuevo

- Backend: **Node 20+** (ESM, Express), entrypoint `backend/src/server.js` (`npm start`).
- Frontend: **un solo archivo** `frontend/app.html` (SPA, sin build), servido por el backend.
- Base de datos: **misma `crm_pro`** que el viejo.
  - Schema `ventaspro_nuevo` → config del sistema nuevo (productos, categorías, pasos, metas).
  - Schema `public` → data real (clients, bans, subscribers, sales_opportunities, etc.) + tablas nuevas (ver §4).
- Puerto: `PORT` del `.env` (local 4000; en prod, detrás de nginx).

---

## 2. Requisitos en el servidor

| Requisito | Detalle |
|---|---|
| Node.js | 20+ (local se probó en 22) |
| PostgreSQL | la `crm_pro` existente |
| Python 3 | para el Constructor de Ofertas (parsers de PDF) |
| pip: **pdfplumber** | `pip install -r scripts/requirements.txt` |
| PM2 | para correr el backend |

Dependencias node: se instalan con `npm install` en `backend/` (incluye `pg, express, multer, xlsx, nodemailer, @google-cloud/vision, jsonwebtoken, dotenv, cors`).

---

## 3. Variables de entorno — `backend/.env`

> El backend carga **`backend/.env`** (no el de la raíz). En prod, **`DEV_LOGIN=0`**.

| Variable | Para qué | Obligatoria |
|---|---|---|
| `PGHOST` `PGPORT` `PGUSER` `PGPASSWORD` `PGDATABASE` | Conexión a `crm_pro` | ✅ |
| `DB_SCHEMA` | `ventaspro_nuevo` (config) | ✅ |
| `JWT_SECRET` | Sesiones | ✅ |
| `TANGO_API_BASE_URL` `TANGO_API_KEY` | Login real + ventas (Tango V2) | ✅ |
| `DEV_LOGIN` | **`0` en prod** (apaga el login de prueba local) | ✅ |
| `PORT` | Puerto del backend (ej. 3001) | ✅ |
| `GOOGLE_PLACES_API_KEY` | Prospección (Google) | opcional |
| `GOOGLE_APPLICATION_CREDENTIALS` | OCR (Vision) | opcional (si se usa OCR) |
| `OCR_ENGINE` | `auto`/`google` | opcional |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Correos: envío por servidor | opcional* |
| `PLANES_UPLOAD_DIR` | Subidas/snapshots de planes (default `backend/uploads/pdf-planes`) | opcional |
| `PYTHON_BIN` | binario python (default `python3` en linux) | opcional |

\* Sin SMTP, Correos igual funciona vía **"Abrir en Outlook" (mailto)**. El envío por servidor queda inactivo hasta cargar SMTP.

---

## 4. Base de datos — tablas / migraciones

Carpeta `backend/migrations/`. Correr **solo lo que falte** en prod (con backup previo):

| Migración | Estado en prod | Acción |
|---|---|---|
| `2026-06-07-equipos-lista.sql` (equipos_*) | **Ya existe** (con datos) | No re-correr |
| `2026-06-08-planes-modulos.sql` (planes_modulos) | **Ya existe** | No re-correr |
| `2026-06-29-prospectos.sql` (public.prospectos) | **NUEVA — no existe** | **Correr en prod** |

Ejecutar la nueva (ejemplo):
```bash
sudo -u postgres psql -d crm_pro -f backend/migrations/2026-06-29-prospectos.sql
```

> El schema `ventaspro_nuevo` (productos/categorías/pasos/metas) ya debe existir en prod del trabajo previo. Verificar con `\dn`.

---

## 5. Pasos de deploy

1. **Backup BD**: `pg_dump crm_pro` a un archivo con fecha.
2. **Subir código** del nuevo por `scp` (carpeta `newcrm/`) al server (ej. `/opt/crmp-nuevo`).
3. **Backend deps**: `cd backend && npm install --omit=dev`.
4. **Python**: `pip install -r scripts/requirements.txt` (pdfplumber).
5. **Env**: crear `backend/.env` con §3 (¡`DEV_LOGIN=0`!).
6. **Migración nueva**: correr `2026-06-29-prospectos.sql` (§4).
7. **Carpeta de subidas**: asegurar permisos de escritura en `PLANES_UPLOAD_DIR`.
8. **Arrancar**: `pm2 start backend/src/server.js --name ventaspro-nuevo` (o reemplazar el proceso viejo).
9. **nginx**: apuntar el dominio al `PORT` nuevo. El portal de ofertas sigue aparte (`ofertas.ss-group.cloud`); el CRM lo enlaza.
10. **Verificación** (§6).

> Frontend: **no hay build**. `app.html` se sirve estático con `Cache-Control: no-store`.

---

## 6. Verificación post-deploy

- `GET /api/health` → `{ ok: true }`.
- **Login con Tango** (usuario real) entra; el botón de demo NO debe aparecer (`DEV_LOGIN=0`).
- Cada módulo carga data real: Clientes, Asana Seg., Comisiones, Metas, Configuración (tabs), Importador, OCR, Admin Ofertas (Equipos + Planes), Correos, Prospección.
- Admin Planes: subir un PDF de boletín → Analizar muestra diff → Aplicar publica (verificar `GET /api/planes-modulos/:pagina`).
- Correos: lista clientes con email; "Abrir en Outlook" arma el correo.

---

## 7. Pendientes / NO incluidos en este deploy

- **Campañas, Vendedores, Permisos** → módulos del viejo aún no replicados (se hacen luego).
- **Correos por servidor (SMTP)** → requiere credenciales SMTP. Mientras tanto: Outlook (mailto).
- **Prospección** → motor a decidir (Google de pago vs OpenStreetMap gratis). Requiere `GOOGLE_PLACES_API_KEY` + "Places API (New)" habilitada y la IP del server permitida.
- **Parser de ofertas Excel (móviles)** y mejoras del scraper → a cargo del programador.
- **OCR** → requiere `GOOGLE_APPLICATION_CREDENTIALS` en `backend/.env` (hoy está en el `.env` raíz; mover/copiar si se usa OCR).

---

## 8. Rollback

- El proceso viejo (`server-FINAL.js`) queda intacto hasta confirmar el nuevo. Si algo falla:
  - Revertir nginx al puerto viejo y `pm2 restart` del proceso viejo.
  - La BD no se toca salvo la migración de `prospectos` (tabla nueva, no afecta lo existente).
