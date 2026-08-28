# Agente local de Correos y campañas CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir en newcrm el correo 1 a 1 enriquecido y las campañas editables cuya cola y respuestas son procesadas por un agente Outlook local.

**Architecture:** El CRM conserva campañas, destinatarios, borradores individuales y eventos en tablas nuevas de `public`; expone una API autenticada exclusiva para el agente local. El agente Windows consulta la cola, usa Outlook clásico para enviar y clasificar únicamente asuntos con identificadores CRM, y reporta resultados idempotentes al CRM.

**Tech Stack:** Node.js ESM, Express, PostgreSQL, frontend SPA `app.html`, `node:test`, PowerShell/Outlook COM solo dentro del agente local Windows.

---

## Estructura de archivos

- `backend/migrations/2026-08-02-correos-agente.sql`: tablas y restricciones de campañas, destinatarios, borradores y eventos.
- `backend/src/services/correosCampaigns.js`: normalización de asunto, códigos CRM, clasificación y transiciones idempotentes.
- `backend/src/routes/correosRoutes.js`: endpoints CRM y endpoint autenticado del agente local.
- `backend/test/correos-agent-contract.test.js`: contratos de esquema, ruta, código y reglas de alcance.
- `frontend/app.html`: pestañas Correos 1 a 1, Campañas y Reportes; editor enriquecido y ficha del cliente.
- `agent-outlook/CorreosAgent.ps1`: agente local programable; no contiene credenciales ni lógica comercial de base de datos.
- `agent-outlook/README.md`: instalación local, tarea programada y recuperación después de reinicio.

### Task 1: Persistencia segura de correo

**Files:**
- Create: `backend/migrations/2026-08-02-correos-agente.sql`
- Test: `backend/test/correos-agent-contract.test.js`

- [ ] **Step 1: Escribir prueba roja de tablas y restricciones**

```js
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.email_campaigns/i);
assert.match(migration, /campaign_code TEXT NOT NULL UNIQUE/i);
assert.match(migration, /CHECK \(batch_size BETWEEN 1 AND 100\)/i);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.email_events/i);
assert.match(migration, /UNIQUE \(outlook_entry_id\)/i);
```

- [ ] **Step 2: Ejecutar la prueba para confirmar rojo**

Run: `node --test backend/test/correos-agent-contract.test.js`

Expected: fallo porque no existe la migración.

- [ ] **Step 3: Crear migración mínima**

```sql
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text NOT NULL UNIQUE,
  name text NOT NULL,
  subject_template text NOT NULL,
  html_template text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  batch_size integer NOT NULL DEFAULT 100 CHECK (batch_size BETWEEN 1 AND 100),
  interval_minutes integer NOT NULL DEFAULT 30 CHECK (interval_minutes >= 5),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','paused','completed')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
```

Crear además `email_campaign_recipients`, `email_client_drafts` y `email_events`. `email_events.outlook_entry_id` será único cuando exista; los eventos conservarán `campaign_id` o `client_id`, pero nunca ambos nulos.

- [ ] **Step 4: Ejecutar la prueba verde**

Run: `node --test backend/test/correos-agent-contract.test.js`

Expected: PASS.

- [ ] **Step 5: Confirmar autorización de migración productiva antes de ejecutarla**

No ejecutar SQL en producción todavía. Crear backup `pg_dump` y solicitar autorización explícita para esa migración.

### Task 2: Servicio de identificación y clasificación

**Files:**
- Create: `backend/src/services/correosCampaigns.js`
- Modify: `backend/test/correos-agent-contract.test.js`

- [ ] **Step 1: Escribir pruebas rojas de identificación**

```js
assert.equal(extractCrmCode('RE: Revisión [CRM-CAMP-024]'), 'CRM-CAMP-024');
assert.equal(extractCrmCode('Consulta general'), null);
assert.equal(classifyReply('No deseo recibir más mensajes'), 'no_contactar');
assert.equal(classifyReply('Podemos reunirnos el jueves'), 'reunion');
assert.equal(classifyReply('Necesito revisar esta propuesta'), 'pendiente');
```

- [ ] **Step 2: Ejecutar rojo**

Run: `node --test backend/test/correos-agent-contract.test.js`

Expected: fallo porque el servicio no existe.

- [ ] **Step 3: Implementar funciones puras**

```js
export const CRM_CODE = /\[(CRM-(?:CAMP|CLI)-[A-Z0-9-]+)\]/i;
export function extractCrmCode(subject = '') { return subject.match(CRM_CODE)?.[1]?.toUpperCase() || null; }
export function classifyReply(text = '') { /* baja, reunión, interesado o pendiente */ }
export function folderForClassification(value) { /* mapa fijo a carpetas autorizadas */ }
```

El clasificador debe devolver `pendiente` cuando no haya una coincidencia segura. No debe clasificar por remitente ni por contenido sin código CRM en el asunto.

- [ ] **Step 4: Ejecutar verde**

Run: `node --test backend/test/correos-agent-contract.test.js`

Expected: PASS.

### Task 3: API CRM y cola idempotente

**Files:**
- Modify: `backend/src/routes/correosRoutes.js`
- Modify: `backend/test/correos-agent-contract.test.js`

- [ ] **Step 1: Escribir pruebas rojas de contratos**

```js
assert.match(route, /POST '\/correos\/campaigns'/);
assert.match(route, /GET '\/correos\/agent\/queue'/);
assert.match(route, /POST '\/correos\/agent\/events'/);
assert.match(route, /requireStrictAuth/);
assert.match(route, /FOR UPDATE SKIP LOCKED/);
```

- [ ] **Step 2: Ejecutar rojo**

Run: `node --test backend/test/correos-agent-contract.test.js`

Expected: fallo porque las rutas no existen.

- [ ] **Step 3: Implementar contratos**

Crear campañas y borradores solo con `requireAuth`. Exponer al agente `GET /api/correos/agent/queue?limit=100` y `POST /api/correos/agent/events` con `requireStrictAuth` y un identificador de agente configurado por entorno. La cola selecciona únicamente destinatarios `pending` de campañas `scheduled`, dentro de fechas, limita al menor entre `limit` y `batch_size`, y bloquea filas con `FOR UPDATE SKIP LOCKED`.

`POST /events` debe aceptar `sent`, `reply`, `failed`, `interested`, `meeting`, `no_contact`, `pending_review`; insertar el mismo `outlook_entry_id` dos veces debe devolver éxito idempotente y no duplicar eventos.

- [ ] **Step 4: Ejecutar verde y revisar sintaxis**

Run: `node --check backend/src/routes/correosRoutes.js; node --test backend/test/correos-agent-contract.test.js`

Expected: ambos PASS.

### Task 4: Editor enriquecido y trazabilidad visible

**Files:**
- Modify: `frontend/app.html`
- Modify: `backend/src/routes/correosRoutes.js`
- Modify: `backend/test/correos-agent-contract.test.js`

- [ ] **Step 1: Escribir contrato rojo de interfaz**

```js
assert.match(html, /contenteditable="true"/);
assert.match(html, /Correo 1 a 1/);
assert.match(html, /Campañas/);
assert.match(html, /CRM-CAMP-/);
assert.match(html, /CRM-CLI-/);
assert.match(html, /Historial de correos/);
```

- [ ] **Step 2: Ejecutar rojo**

Run: `node --test backend/test/correos-agent-contract.test.js`

Expected: fallo porque el módulo actual solo contiene texto plano y `mailto`.

- [ ] **Step 3: Implementar mínima interfaz**

Agregar selector de flujo. En 1 a 1, exigir exactamente un cliente, solicitar al backend resumen comercial confirmado y generar HTML editable con código `[CRM-CLI-…]`. En campañas, permitir editar asunto y contenido por campaña, fechas, tamaño de lote e intervalo antes de programar. Mostrar reporte y línea de tiempo por cliente sin mostrar eventos de otros clientes.

- [ ] **Step 4: Ejecutar verde**

Run: `node --test backend/test/correos-agent-contract.test.js`

Expected: PASS.

### Task 5: Agente local Outlook y recuperación

**Files:**
- Create: `agent-outlook/CorreosAgent.ps1`
- Create: `agent-outlook/README.md`
- Modify: `backend/test/correos-agent-contract.test.js`

- [ ] **Step 1: Escribir contrato rojo del agente**

```js
assert.match(agent, /Get-OutlookApplication/);
assert.match(agent, /Email de campaña/);
assert.match(agent, /CRM-(?:CAMP|CLI)/);
assert.match(agent, /batch_size/);
assert.match(agent, /outlook_entry_id/);
assert.doesNotMatch(agent, /SMTP_PASS|JWT_SECRET|password/i);
```

- [ ] **Step 2: Ejecutar rojo**

Run: `node --test backend/test/correos-agent-contract.test.js`

Expected: fallo porque el agente no existe.

- [ ] **Step 3: Implementar agente local**

`CorreosAgent.ps1` carga una configuración local fuera del repositorio con URL y token del agente. Cada ejecución: solicita la cola; para cada destinatario crea y envía un correo por Outlook; reporta `sent` con `EntryID`; busca respuestas con código CRM; solo mueve esos mensajes a las cinco carpetas autorizadas y reporta el evento. Si el equipo estuvo apagado, la próxima ejecución consulta la misma cola y los eventos idempotentes evitan duplicados.

- [ ] **Step 4: Documentar instalación sin secretos**

En `agent-outlook/README.md`, indicar la tarea programada cada 30 minutos, cuenta Outlook requerida, estructura de carpetas y cómo verificar `agent.log`. No incluir tokens ni comandos que impriman secretos.

- [ ] **Step 5: Ejecutar verde**

Run: `node --test backend/test/correos-agent-contract.test.js`

Expected: PASS.

### Task 6: Verificación y publicación por fases

**Files:**
- Modify: `DEPLOY.md`

- [ ] **Step 1: Añadir verificación específica**

Documentar: backup de BD antes de migración, despliegue backend con reinicio PM2, despliegue de `frontend/app.html`, health `/api/health`, y ejecución local del agente con una campaña de prueba sin destinatario externo.

- [ ] **Step 2: Ejecutar suite dirigida**

Run: `node --test backend/test/correos-contract.test.js backend/test/correos-search-ui-contract.test.js backend/test/correos-agent-contract.test.js`

Expected: PASS.

- [ ] **Step 3: Verificar manualmente sin envío externo**

Crear un borrador individual de prueba, confirmar que contiene solo datos reales y código CRM, ejecutar el agente contra una cola sin destinatarios externos y verificar que ningún correo sin código CRM cambió de carpeta.

- [ ] **Step 4: Solicitar autorización de producción**

No publicar ni ejecutar la migración sin la confirmación explícita de Gabriel después de revisar el resultado local.
