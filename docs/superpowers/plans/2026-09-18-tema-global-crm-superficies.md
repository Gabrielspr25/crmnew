# Tema global del CRM en todas las superficies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que el modo dia del CRM pinte coherentemente las modales y filas de suscriptores sin modificar el modo oscuro ni la logica de Clientes.

**Architecture:** `frontend/app.html` ya define tokens de tema en `body[data-theme]`. Se agregan reglas de modo dia con selectores de la modal y de las filas de suscriptor para sustituir los colores oscuros locales por esos tokens. El contrato existente de suscriptores protege la estructura y se amplia para proteger el comportamiento de tema.

**Tech Stack:** HTML estatico, CSS, JavaScript vanilla, Node.js `node:test`.

---

### Task 1: Definir el contrato de tema de la fila de suscriptor

**Files:**
- Modify: `backend/test/client-subscriber-visual-contract.test.js`
- Modify: `frontend/app.html:272-280`

- [ ] **Step 1: Escribir la prueba que debe fallar**

```js
test('el modo dia reemplaza la paleta oscura local de las filas de suscriptor', () => {
  assert.match(appSource, /body\[data-theme="day"\] \.subscriber-row\{background:var\(--card\);border-color:var\(--line\);/);
  assert.match(appSource, /body\[data-theme="day"\] \.subscriber-cell\{background:var\(--card2\);border-color:var\(--line\);/);
  assert.match(appSource, /body\[data-theme="day"\] \.subscriber-workflow\{background:var\(--card2\);border-color:var\(--line\);/);
  assert.doesNotMatch(appSource, /body\[data-theme="soft-dark"\] \.subscriber-row\{/);
  assert.doesNotMatch(appSource, /body\[data-theme="dark"\] \.subscriber-row\{/);
});
```

- [ ] **Step 2: Ejecutar la prueba para confirmar que falla**

Run: `node --test backend/test/client-subscriber-visual-contract.test.js`

Expected: falla porque las reglas de modo dia no existen.

- [ ] **Step 3: Implementar las reglas de modo dia acotadas**

```css
body[data-theme="day"] .subscriber-row{background:var(--card);border-color:var(--line);box-shadow:none;}
body[data-theme="day"] .subscriber-cell,body[data-theme="day"] .subscriber-workflow{background:var(--card2);border-color:var(--line);}
```

Agregar reglas equivalentes para etiquetas, plan, equipo, importes, fechas, notas, inputs y acciones. Cada color debe usar `var(--txt)`, `var(--txt2)`, `var(--txt3)`, `var(--primary)`, `var(--green)`, `var(--amber)` o sus superficies asociadas.

- [ ] **Step 4: Ejecutar la prueba para confirmar que pasa**

Run: `node --test backend/test/client-subscriber-visual-contract.test.js`

Expected: todas las pruebas pasan.

### Task 2: Ejecutar la cobertura de Clientes y tema

**Files:**
- Test: `backend/test/client-subscriber-visual-contract.test.js`
- Test: `backend/test/clientes-paleta-visual-contract.test.js`
- Test: `backend/test/client-profile-line-tabs-contract.test.js`

- [ ] **Step 1: Ejecutar las pruebas de Clientes y tema**

Run: `node --test backend/test/client-subscriber-visual-contract.test.js backend/test/clientes-paleta-visual-contract.test.js backend/test/client-profile-line-tabs-contract.test.js`

Expected: todas las pruebas pasan.

### Task 3: Publicar y comprobar la superficie real

**Files:**
- Deploy: `frontend/app.html`

- [ ] **Step 1: Respaldar el artefacto productivo**

Run: `ssh ventaspro-server 'cp /opt/crmp-nuevo/frontend/app.html /home/gabriel/backups/app-crm-theme-subscriber-YYYYMMDD-HHMMSS.html'`

- [ ] **Step 2: Subir solo el frontend estatico**

Run: `scp frontend/app.html ventaspro-server:/opt/crmp-nuevo/frontend/app.html`

- [ ] **Step 3: Comprobar produccion**

Run: `Invoke-WebRequest -UseBasicParsing https://crmp.ss-group.cloud/` y `Invoke-WebRequest -UseBasicParsing https://crmp.ss-group.cloud/api/health`

Expected: el HTML contiene el selector de modo dia y la salud devuelve `ok:true`.

- [ ] **Step 4: Revisar visualmente la modal de Cliente**

Abrir un perfil en modo dia y modo oscuro. En modo dia las filas, celdas, notas, filtros y controles se leen sobre superficies claras. En modo oscuro conservan la composicion anterior.
