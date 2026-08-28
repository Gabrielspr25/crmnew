# Constructor Modal Equipos Autoajuste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que la modal de equipos aproveche el alto visible y limite el desplazamiento a su contenido interno.

**Architecture:** El cambio es exclusivamente CSS dentro del Constructor. Se ajusta el contenedor principal a un alto máximo basado en el viewport y se permite que el cuerpo de la modal se encoja y desplace sin mover el encabezado.

**Tech Stack:** HTML, CSS, pruebas de contrato con `node:test`.

---

### Task 1: Autoajuste de la modal

**Files:**
- Modify: `Planes para web/oferta-const.html`
- Modify: `backend/test/constructor-business-red-plus-contract.test.js`

- [ ] **Step 1: Escribir la prueba que exige alto adaptable**

Agregar aserciones para `height:min(90vh` o equivalente, `min-height:0` y `overflow:auto` en el cuerpo de la modal.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `node --test backend/test/constructor-business-red-plus-contract.test.js`
Expected: FAIL porque la modal conserva el límite actual.

- [ ] **Step 3: Implementar el CSS mínimo**

Actualizar `.equipment-modal` para usar casi todo el alto visible y `.modal-body` para permitir desplazamiento interno sin desbordar el viewport.

- [ ] **Step 4: Ejecutar pruebas y validación sintáctica**

Run: `node --test backend/test/constructor-business-red-plus-contract.test.js`
Expected: PASS.

- [ ] **Step 5: Publicar con respaldo y verificar visualmente**

Respaldar `oferta-const.html`, subir solo ese archivo, comprobar la versión pública y abrir la modal con Business Red Plus en el navegador.
