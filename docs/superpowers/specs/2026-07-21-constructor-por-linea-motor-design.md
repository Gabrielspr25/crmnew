# Constructor por línea con elegibilidad del motor — Diseño

Fecha: 2026-07-21
Estado: aprobado en decisiones clave (conversación 2026-07-21). Pendiente revisión del spec.

## Problema

El constructor (`Planes para web/oferta-const.html`) hoy:
- usa un **plan global** (`state.planInd`/`state.planMulti`) para todas las líneas;
- filtra equipos desde el archivo **estático** `ofertas-data.js` (`window.OFERTAS_DATA`), no desde la versión vigente del motor;
- no obliga a elegir operación y plan antes de habilitar el selector de equipo.

Requisito: cada línea debe, de forma independiente, elegir **operación → plan → equipo elegible de la versión vigente del motor**, con el selector de equipo bloqueado hasta completar los dos primeros.

## Decisiones acordadas

1. La elegibilidad viene del **motor** (`POST /api/motor-ofertas/elegibles`), no de datos estáticos.
2. El **tipo** de propuesta (individual vs multilínea Business RED) se mantiene a **nivel propuesta** (un BAN es de un solo tipo). Por línea se elige operación + plan concreto (monto para individual; familia para Business RED).
3. Sin sesión del CRM (sin `vp_token`), el selector de equipo **exige iniciar sesión** y no muestra equipos. No hay respaldo estático para la elegibilidad.

## Modelo de estado por línea

Cada `state.cart[i]` pasa a tener:
```
{ operacion: 'nueva' | 'portabilidad' | 'renovacion',
  plan: { codigo, nombre, monto, familia? } | null,
  equipo: null | {...},        // del motor
  oferta: null | {...},        // del motor
  plazo, seguro, deudaPortabilidad,
  motorEquipos: null | [...],  // cache de la última respuesta /elegibles de esta línea
  motorEstado: 'idle'|'cargando'|'ok'|'sin_equipos'|'sin_version'|'sin_sesion'|'error' }
```
El `state.tipo` (individual/multilinea) sigue a nivel propuesta. `state.eventos` global deja de gobernar el selector por línea.

## Flujo por línea (con compuerta, en orden)

En la tabla de líneas (paso 2), cada fila tiene tres controles en orden:

1. **Operación**: `<select>` con `Nueva` / `Portabilidad` / `Renovación` (las tres, por línea).
2. **Plan de la línea**: `<select>` habilitado solo tras elegir operación.
   - Individual: montos disponibles (p. ej. $20–$100 según catálogo del tipo).
   - Multilínea Business RED: familia (Plus / Extreme / Supreme / Sin Fronteras).
3. **Escoger equipo**: botón **deshabilitado** (`disabled` + estilo atenuado) mientras la fila no tenga operación *y* plan. Al habilitarse y pulsarlo, abre el modal y consulta el motor.

Cambiar operación o plan de una fila que ya tenía equipo **limpia** `equipo`/`oferta`/`motorEquipos` de esa fila y obliga a reconsultar. No afecta a las demás filas.

## Integración con el motor

Al abrir el selector de una línea `i` (o al cambiar su operación/plan con el modal abierto):

```
POST /api/motor-ofertas/elegibles   (via crmApi, con Bearer vp_token)
{
  linea: {
    id: `linea_${i+1}`, indice: i+1, ban: <ban de la propuesta o null>,
    tipo: state.tipo === 'individual' ? 'individual' : 'multilinea_business_red',
    plan: { codigo, nombre, monto },
    familia_business_red: <familia> (solo si multilinea),
    evento: mapaOperacion(operacion),   // nueva→linea_nueva, portabilidad→portabilidad, renovacion→renovacion
    convergente: state.convergente,
    trade_in: { estado: 'no_requiere', validado: false }
  },
  contexto_ban: { posicion_en_ban: i+1, beneficios_usados_por_oferta: {} }
}
```

Respuesta → `state.cart[i].motorEquipos = resp.equipos`. Cada equipo trae `equipo{modelo_oficial, sku_sif, sap, precio_regular}`, `oferta{id,nombre}`, `plazos[]`, `beneficio`, `aplicacion_automatica`, `validaciones[]`, `vigencia`. El modal se renderiza desde esta lista, no desde `OFERTAS_DATA`.

**Estados del modal:**
- `cargando`: spinner/"Consultando ofertas vigentes…".
- `ok`: lista de equipos elegibles (agrupables por marca/tipo como hoy).
- `sin_equipos`: "No hay equipos elegibles para esta operación y plan" (respuesta 200 con `equipos: []`).
- `sin_version` (404 `version_vigente_no_disponible`): "No hay una versión vigente de ofertas publicada".
- `sin_sesion` (sin token / 401): "Inicia sesión en el CRM para ver equipos elegibles".
- `error`: "No se pudo consultar el motor de ofertas".

## Mapeo respuesta-motor → UI

Función pura nueva (helper en el mismo archivo o `ofertas-motor.js`): `mapMotorEquipoToRow(motorEquipo)` → forma que las funciones de render y la comparativa ya entienden (`{marca, modelo, precio, sku, oferta:{id,titulo,beneficio}, plazos, beneficioTipo}`). Se adaptan `renderEquipos`, `renderModalOfferPanel` y `assignOfferToLine` para leer de `cart[i].motorEquipos` en vez de `L.getEquiposFiltrados`/`OFERTAS_DATA`.

## Resumen / propuesta

La comparativa final (`renderProposal`) ya lee de `cart[i]`. Se ajusta para mostrar por línea: operación + plan + equipo + oferta + beneficio + plazo provenientes del motor. Sin cambios de fuente adicionales.

## Pruebas

`node:test`, contrato sobre el HTML (estilo `oferta-const-portal.test.js`):
- el selector de equipo está deshabilitado sin operación y plan (`disabled`);
- existen los tres eventos por línea (`nueva`/`portabilidad`/`renovacion`);
- hay selector de plan por línea;
- el modal llama a `/api/motor-ofertas/elegibles` (no `getEquiposFiltrados` para elegibilidad);
- maneja los estados `sin_version`, `sin_sesion`, `sin_equipos`;
- cambiar operación/plan limpia el equipo de esa línea.
- Prueba del helper `mapMotorEquipoToRow` con una respuesta de ejemplo del motor.

Validación visual en producción: 5 líneas individuales, escritorio y móvil, cada línea con operación+plan+equipo independientes, y verificación de que llegan al resumen.

## Alcance

- Solo `Planes para web/oferta-const.html` (+ posible `ofertas-motor.js` helper) y sus pruebas.
- No se modifica el motor (ya funciona), ni Asana/importador, ni se reprocesa la versión vigente.
- Deploy: solo el/los archivo(s) del constructor, con backup y reversa.

## Riesgos

- La versión vigente actual (v1) devuelve 0 equipos para algunos planes (p. ej. $50 individual). Es dato de la versión, no del constructor; el estado `sin_equipos` lo comunica con claridad.
- El constructor pasa a **depender de sesión + versión vigente**; sin ellas no muestra equipos (comportamiento deseado y explícito).
