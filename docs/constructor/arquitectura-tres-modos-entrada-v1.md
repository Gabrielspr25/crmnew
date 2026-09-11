# Arquitectura tres modos de entrada del Constructor v1

Fecha: 2026-09-01  
Proyecto: `newcrm`  
Estado: implementacion local preparatoria, sin despliegue.

## Objetivo

Preparar el Constructor Comercial para recibir tres entradas sin crear tres logicas comerciales:

1. `Traer cliente del CRM`
2. `Construir manualmente`
3. `Consultar al asistente`

Las tres desembocan en un unico objeto `commercialScenario`. El Motor Comercial sigue siendo la fuente de reglas; la entrada solo describe el contexto.

## Principio

```
CRM --------\
Manual ------> commercialScenario -> Motor Comercial publicado -> Constructor
Consulta ---/
```

La consulta interpreta intencion del vendedor, pero no decide promociones. No puede inventar precio, equipo, descuento, limite, vigencia, elegibilidad ni price code.

## Contrato comun

El contrato se construye con `ConstructorPublications.buildCommercialScenario()`:

```js
{
  source_mode: 'crm' | 'manual' | 'consultation',
  autoaplica: false,
  client: { id, name },
  ban: { number, status },
  account_type,
  full_ban_lines,
  selected_lines,
  selected_lines_count,
  event,
  plan,
  equipment_preferences,
  selected_equipment,
  financing,
  term,
  budget,
  convergence,
  seller_preferences,
  original_query,
  commercial_truth: 'motor_comercial_publicado'
}
```

`full_ban_lines` conserva el contexto completo del BAN. `selected_lines` contiene solo las lineas objetivo de la operacion.

## Modo CRM

Nombre visible: `Traer cliente del CRM`.

Entrada actual: `crm_client_id` en la URL desde el CRM. El Constructor lee `/api/clients-real/:id` usando la sesion del CRM y carga:

- cliente;
- BAN;
- account type si existe;
- lineas activas del BAN;
- telefono;
- plan actual;
- renta actual;
- equipo;
- fechas y termino cuando existen;
- pagos restantes si existen.

El vendedor puede marcar o desmarcar lineas antes de crear la oferta. Si selecciona 3 lineas de un BAN con 10, el escenario conserva las 10 en `full_ban_lines` y pone 3 en `selected_lines`.

No modifica CRM ni lineas. Solo prepara contexto.

## Modo Manual

Nombre visible: `Construir manualmente`.

Conserva el flujo actual del Constructor:

- escoger tipo de plan;
- plan;
- cantidad de lineas;
- equipo/oferta;
- productos fijos/TV;
- comparativa y propuesta.

El cambio es que el flujo manual tambien actualiza `commercialScenario` con `source_mode='manual'`.

## Modo Consulta

Nombre visible: `Consultar al asistente`.

La pantalla muestra una caja grande para la necesidad del vendedor. No usa proveedor externo de IA. El interprete local extrae solo intencion estructural basica:

- cantidad de lineas;
- evento;
- preferencia de marca;
- presupuesto maximo;
- objetivo del vendedor.

Bloqueos documentados:

- `interprete_local`;
- `consulta_no_decide_promociones`;
- `motor_comercial_define_elegibilidad`.

La consulta no modifica el Constructor hasta que el vendedor pulse `Cargar propuesta al Constructor`.

## Integracion con Motor Comercial

El Motor Comercial permanece en modo sombra/evaluacion:

- `autoaplica=false`;
- fallback existente activo;
- calculo definitivo actual intacto;
- carrito, totales y propuesta guardada no son reemplazados por esta etapa.

El escenario comun queda preparado para alimentar el Motor publicado cuando se autorice la etapa de decision.

## Puntos modificados

- `Planes para web/constructor-publications.js`: agrega helper puro `buildCommercialScenario`.
- `Planes para web/oferta-const.html`: agrega entrada visual de tres modos y genera/actualiza `commercialScenario`.
- `backend/test/oferta-const-portal.test.js`: agrega pruebas de contrato para los tres modos y la consulta sin proveedor externo.

## Riesgos

- La seleccion fina por BAN depende de que `/api/clients-real/:id` tenga lineas y campos suficientes; si faltan datos, el escenario conserva valores vacios y no inventa.
- La consulta actual es un interprete local. Solo interpreta patrones para preparar el escenario.
- Si se requiere mas capacidad de lenguaje, debe evaluarse un modelo local/open source en infraestructura propia, sin servicios externos por token.
- Falta validar visualmente con cliente real en navegador antes de produccion.

## Trabajo futuro

1. Mejorar el interprete local o evaluar modelo local/open source propio si se autoriza.
2. Agregar endpoint dedicado de escenario CRM si `/api/clients-real/:id` no cubre todos los campos.
3. Permitir seleccion por BAN cuando el cliente tenga varios BANs.
4. Enviar `commercialScenario` completo al endpoint del Motor cuando el Motor deje de estar solo en sombra.
5. Validar con casos reales: BAN una linea, BAN multilinea, seleccion parcial, manual y consulta desde CRM.

## Restricciones cumplidas

- No deploy.
- No migraciones.
- No `autoaplica=true`.
- No se quito fallback.
- No se cambio calculo definitivo.
- No se duplicaron reglas comerciales.
- No se introdujo proveedor externo.
