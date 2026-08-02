# Ofertas — Cómo funciona el motor y el constructor

Fecha: 2026-07-23

Este documento explica, en un solo lugar, cómo se comportan las ofertas móviles: dónde
viven, cómo el constructor pide equipos, cómo el motor decide qué es elegible, y por qué
a veces **no aparece ningún equipo** aunque todo esté bien programado.

---

## 1. Resumen en una frase

El constructor **no inventa equipos**: por cada línea le pregunta al motor
"para este plan y esta operación, ¿qué equipos aplican **hoy**?", y el motor responde
consultando la **versión de ofertas publicada (vigente)**. Si esa versión está **vencida**
o no cubre ese plan, el motor responde "sin equipos" — a propósito.

---

## 2. Las piezas y dónde viven

| Pieza | Archivo / lugar | Qué hace |
|---|---|---|
| Constructor (pantalla) | `Planes para web/oferta-const.html` | Escoger plan, líneas, operación y equipo. Servido bajo `/constructor`. |
| Endpoint de elegibilidad | `backend/src/routes/motorOfertasRoutes.js` → `POST /api/motor-ofertas/elegibles` | Recibe una línea, devuelve equipos elegibles. Exige sesión. |
| Lógica de búsqueda | `backend/src/services/motorOfertaseligibility.js` (`evaluateEligibleOffers`) | Filtra las ofertas de la versión vigente contra la línea. |
| Versión publicada | Tablas `public.motor_ofertas_versiones`, `motor_ofertas`, `motor_ofertas_equipos` | Snapshot inmutable de las ofertas y equipos con su vigencia. |
| Admin Ofertas | `frontend/app.html`, pestaña "Ofertas" | Subir el boletín/Excel → revisar → **publicar** una versión nueva. |

Producción: servidor DigitalOcean `143.244.191.139`, proceso PM2 `ventaspro-nuevo` en
`/opt/crmp-nuevo`, base de datos `crm_pro`. URL: `https://crmp.ss-group.cloud/constructor/oferta-const.html`.

---

## 3. Flujo del constructor, por línea

Cada línea de la propuesta pasa por este orden. **El equipo no se habilita hasta antes.**

1. **Operación de la línea**: Nueva / Portabilidad / Renovación.
2. **Plan** (uno para toda la propuesta, en el paso 1): Individual ($20–$100) o
   Multilínea Business RED (Plus/Extreme/Supreme/Sin Fronteras).
3. **Escoger equipo**: al abrir, el constructor llama al motor.

Al pulsar "Escoger equipo" el constructor arma esta petición (función `fetchMotorEquipos`):

```json
POST /api/motor-ofertas/elegibles
{
  "linea": {
    "id": "linea_1", "indice": 1, "ban": null,
    "tipo": "individual",                     // o "multilinea_business_red"
    "plan": { "codigo": "75", "nombre": "Plan $75", "monto": 75 },
    "familia_business_red": "...",             // solo si es multilínea
    "evento": "linea_nueva",                   // nueva | portabilidad | renovacion
    "convergente": false,
    "trade_in": { "estado": "no_requiere", "validado": false }
  },
  "contexto_ban": { "posicion_en_ban": 1, "beneficios_usados_por_oferta": {} }
}
```

La autenticación usa el token del CRM (`localStorage.vp_token`) — por eso **el constructor
necesita sesión iniciada**. Sin token, muestra "Inicia sesión en el CRM"; **no** cae a
datos estáticos.

---

## 4. Cómo busca el motor (la parte importante)

`evaluateEligibleOffers` recorre **cada oferta de la versión vigente** y la descarta si no
pasa **todos** estos filtros, en este orden (`matchesOffer`):

1. **Estado comercial**: la oferta debe estar `confirmada`. Si no → `oferta_no_confirmada`.
2. **Tipo de plan**: la oferta debe aplicar a `individual` o `multilinea_business_red` según la línea.
3. **Familia** (solo multilínea): la oferta debe incluir la familia Business RED de la línea.
4. **Evento**: la oferta debe incluir `linea_nueva` / `portabilidad` / `renovacion` de la línea.
5. **Monto del plan**: la oferta tiene un rango `[plan_monto_minimo, plan_monto_maximo]`.
   - Si el rango **no está documentado** (algún extremo nulo) → `monto_plan_no_documentado`.
   - Si el monto de la línea cae **fuera** del rango → se descarta en silencio.
6. **Trade-in**: si la oferta lo exige para ese evento y la línea no lo validó → `trade_in_requerido`.
7. **Fuente vigente**: si la fuente de la oferta está `vencida` o `futura` → `fuente_no_vigente`.
8. **Vigencia de la oferta**:
   - Si no está `vigente` → `oferta_no_vigente`.
   - Si **hoy** está fuera del rango de fechas `[vigencia_desde, vigencia_hasta]` → `oferta_fuera_vigencia`.
9. **Límite por BAN** (si aplica): sin contexto BAN → `limite_ban_pendiente`; excedido → `limite_ban_excedido`.

Solo las ofertas que sobreviven aportan sus equipos. Un equipo además debe:

- tener coincidencia `exacta` o `equivalencia_aprobada` (si no → `equipo_no_confirmado`);
- tener un plazo que la oferta documente;
- tener pago mensual numérico.

Si al final no queda ningún equipo → `sin_equipos_elegibles`.

**Regla de oro**: el motor **nunca** aplica una oferta vencida o sin fuente. Esto es
intencional (está en `CLAUDE.md`: "No aplicar automáticamente reglas vencidas o sin fuente").

---

## 5. Por qué "no trae equipos" — el caso real del 23-jul-2026

Diagnóstico confirmado en producción:

- La versión publicada (v1) tiene ofertas con vigencia **16 al 21 de julio de 2026**.
- El servidor está en **23 de julio**.
- ⇒ La oferta **venció hace 2 días**. El filtro 8 (`oferta_fuera_vigencia`) descarta todo.

Por eso el 21-jul (último día válido) sí aparecían equipos con planes $35/$40/$45, y el
23-jul no aparece ninguno. La captura del usuario mostraba exactamente esto:
`monto_plan_no_documentado` + `sin_equipos_elegibles` con plan $75.

**Esto no es un bug del constructor ni del motor.** Es un dato vencido: el boletín cargado
cubre una sola semana y ya pasó. La ventana en la que "funciona" es corta por diseño del
boletín, y con el plan por defecto ($75) es fácil caer siempre en vacío.

### Planes que la versión v1 llegó a cubrir (referencia)

| Rango de plan | Ofertas | Nota |
|---|---|---|
| $35, $40, $45 exactos | 1 c/u | rango cerrado |
| $50, $60, $75, $95 "en adelante" | 2–3 | rango abierto (máximo nulo) |

(Todas con vigencia 16–21 jul, hoy vencidas.)

---

## 6. Cómo hacer que vuelvan a aparecer equipos

**No es código. Es actualizar el dato:**

1. Entrar al CRM (`app.html`) → **Admin Ofertas** → pestaña **Ofertas**.
2. Subir el **boletín/Excel con fecha vigente** (Tabla de Financiamiento del período actual).
3. Revisar el preview (ofertas detectadas, equipos, contradicciones).
4. **Publicar**: la versión anterior pasa a `reemplazada` y la nueva a `vigente`.
5. El constructor, al consultar el motor, ya encuentra ofertas vigentes → muestra equipos.

Mientras no haya una versión vigente **con fecha de hoy dentro de su rango**, el constructor
seguirá mostrando "sin equipos" — correctamente.

---

## 7. Estados y mensajes que puede mostrar el selector de equipo

| Estado | Cuándo | Mensaje |
|---|---|---|
| `cargando` | consultando el motor | "Consultando ofertas vigentes..." |
| `ok` | hay equipos | lista de equipos elegibles |
| `sin_equipos` | 200 pero 0 equipos (p. ej. vencida o plan no cubierto) | "No hay equipos elegibles para esta operación y plan." |
| `sin_version` | 404, no hay versión publicada | "No hay una versión vigente de ofertas publicada." |
| `sin_sesion` | sin token / 401 | "Inicia sesión en el CRM para ver equipos elegibles." |
| `error` | fallo de red / 500 | "No se pudo consultar el motor de ofertas." |

> Mejora pendiente sugerida (no implementada): cuando el motor devuelve
> `oferta_fuera_vigencia`, mostrar en español "El boletín venció el {fecha} — sube uno
> nuevo en Admin Ofertas" en vez del código técnico. Es un cambio chico y **no toca el motor**.

---

## 8. Qué está probado que funciona

- El motor devuelve equipos por plan y operación cuando la versión está **vigente**
  (verificado el 21-jul: $35→3 equipos, $40→2, $45→2, cada línea independiente).
- El constructor consulta el motor por línea, con sesión real, y muestra los equipos.
- La compuerta (equipo bloqueado hasta escoger operación/plan) y la independencia por línea
  funcionan en escritorio y móvil.

El único agujero real observado es de **producto**: cuando el dato vence, el sistema —
correctamente — no muestra equipos, pero el aviso al vendedor es un código técnico en vez
de una frase clara.

---

## 9. Rutas y respaldos útiles

- Reversa del constructor en el servidor: `/opt/crmp-nuevo/.reversa-const-20260721-185904/`.
- Respaldo de artefactos solo-producción: `.local-backups/prod-2026-07-21/`.
- Rama de integración con todo el trabajo: `integracion/motor-ofertas` (local y en `origin`).
- Diseño previo: `docs/superpowers/specs/2026-07-21-constructor-por-linea-motor-design.md`.
