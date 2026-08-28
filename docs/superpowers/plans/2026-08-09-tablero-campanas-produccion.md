# Tablero de campañas en Correos - Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer visible para Gabriel, como administrador, el seguimiento real de campañas dentro de Correos sin exponerlo a vendedores ni modificar envíos existentes.

**Architecture:** La API productiva de campañas ya conserva destinatarios, enviados, pendientes, fallidos y estado. Se integrará un bloque de interfaz sobre el `app.html` que está actualmente en producción, no se sustituirá por la copia local porque ambas versiones difieren en funcionalidades ajenas.

**Tech Stack:** Frontend estático `frontend/app.html`, API Express existente `/api/correos/campaigns`, PowerShell/SSH/SCP para despliegue y `node:test` para contrato estático.

---

### Task 1: Aislar el cambio para el frontend productivo

**Files:**
- Create: `backend/test/correos-campaign-tracking-ui-contract.test.js`
- Modify: copia temporal de `frontend/app.html` obtenida del servidor productivo

- [ ] **Step 1: Escribir contrato rojo**

```js
assert.match(html, /Campañas/);
assert.match(html, /SEGUIMIENTO DE CAMPAÑAS/);
assert.match(html, /Enviados/);
assert.match(html, /Pendientes/);
assert.match(html, /Fallidos/);
assert.match(html, /Pausar campaña/);
```

- [ ] **Step 2: Ejecutar la prueba contra el HTML productivo descargado**

Run: `node --test backend/test/correos-campaign-tracking-ui-contract.test.js`

Expected: FAIL porque el HTML público no contiene el tablero.

- [ ] **Step 3: Integrar solo el bloque Correos**

Mantener sin cambios los demás módulos del HTML productivo. Añadir la pestaña de campañas solo cuando el rol no sea `vendedor`, el compositor de campaña y la tabla con consulta autenticada a `/api/correos/campaigns`. Mantener el modo `Correo 1 a 1` como único modo permitido para vendedores.

- [ ] **Step 4: Ejecutar la prueba verde**

Run: `node --test backend/test/correos-campaign-tracking-ui-contract.test.js`

Expected: PASS.

### Task 2: Publicar de manera reversible

**Files:**
- Modify: `/opt/crmp-nuevo/frontend/app.html` en producción

- [ ] **Step 1: Crear respaldo remoto con fecha**

Run: `cp /opt/crmp-nuevo/frontend/app.html /opt/crmp-nuevo/frontend/app.html.bak-campaign-tracking-YYYYMMDD-HHMMSS`

- [ ] **Step 2: Subir solo el frontend validado**

Run: `scp <archivo-validado> ventaspro-server:/opt/crmp-nuevo/frontend/app.html`

- [ ] **Step 3: Verificar evidencia pública**

Run: comprobar SHA-256 local/remoto, `https://crmp.ss-group.cloud/api/health` y que el HTML público contiene las columnas del tablero.

- [ ] **Step 4: Verificar en una sesión administradora**

Abrir Correos y confirmar que Gabriel ve Campañas, la tabla muestra datos reales y el control Pausar está disponible solo para una campaña programada. Confirmar que un vendedor sigue limitado a 1 a 1.
