# Validacion integral tres modos con Fijo y Convergencia v1

Fecha: 2026-09-01  
Proyecto: `newcrm`  
Alcance: validacion local e integracion de contrato. Sin despliegue y sin migraciones.

## Resumen ejecutivo

Se valido que `CRM`, `Manual` y `Consulta` son tres formas de crear contexto y no tres motores comerciales. Las tres entradas desembocan en `commercialScenario`, se convierten a una base de propuesta comun y consumen la misma evaluacion del Motor Comercial existente.

Resultado: **validacion local aprobada con pruebas** para el contrato comun, Fijo, Benefits y Convergencia. El Motor sigue en sombra/evaluacion; no se activa como calculo definitivo.

## Arquitectura encontrada

| Capa | Archivo / servicio | Uso actual |
|---|---|---|
| Constructor visual | `Planes para web/oferta-const.html` | Entrada CRM/manual/consulta, seleccion de plan, equipo, fijo/TV y propuesta. |
| Publicaciones del Constructor | `Planes para web/constructor-publications.js` | Carga publicaciones comerciales, evalua reglas publicadas y conserva modo sombra. |
| Motor movil/equipos | `/api/ofertas-movil/vigente`, `/api/motor-ofertas/elegibles` | Version movil vigente y elegibilidad de equipos. |
| Fijo / TV | `/api/planes-modulos/fijos`, `/api/planes-modulos/claro_tv` | Productos publicados agregables al escenario. |
| Benefits / Convergencia | `/api/fuentes-comerciales/planes-fijos/reglas-compuestas-publicadas/vigente` | Reglas confirmadas, vigentes, publicadas y `autoaplica=false`. |
| CRM | `/api/clients-real/:id` | Cliente, BAN y lineas existentes para modo CRM. |

No se encontro una segunda logica comercial por modo. El cambio realizado agrega un mapeador comun:

`commercialScenario -> buildBaseProposalFromCommercialScenario() -> evaluateCommercialProposal()`

## Contrato validado

`commercialScenario` conserva:

- `source_mode`: `crm`, `manual` o `consultation`;
- cliente y BAN;
- `account_type`;
- `full_ban_lines`;
- `selected_lines`;
- evento;
- plan/familia;
- preferencias de equipo;
- equipos seleccionados;
- servicios fijos;
- convergencia;
- consulta original cuando aplica;
- `commercial_truth = motor_comercial_publicado`;
- `autoaplica=false`.

La base enviada al Motor contiene:

- `cliente.convergente`;
- `cliente.convergencia_estado`;
- `lineas`;
- `productos`;
- `servicios_fijos`;
- `precio_base_mensual`;
- `equipo_mensual`;
- `source_mode`.

## Recorrido por modo

### CRM

Recorrido validado:

`/api/clients-real/:id -> commercialScenario(source_mode=crm) -> base propuesta -> Motor Comercial`

El CRM puede aportar cliente, BAN, lineas, plan actual, renta, equipo, fechas y pagos cuando existan. La seleccion parcial conserva el BAN completo en `full_ban_lines` y solo las lineas objetivo en `selected_lines`.

Lo que todavia requiere seleccion del vendedor:

- evento de la operacion cuando no viene confirmado;
- plan/oferta objetivo;
- equipo nuevo;
- servicios fijos que se van a agregar si no existen completos en CRM;
- confirmacion comercial cuando convergencia no tenga evidencia suficiente.

### Manual

Recorrido validado:

`flujo manual actual -> commercialScenario(source_mode=manual) -> base propuesta -> Motor Comercial`

El Constructor manual sigue funcionando y no se reconstruyo. La diferencia es que ahora puede expresar el mismo escenario normalizado que CRM.

### Consulta

Recorrido validado:

`texto vendedor -> intencion estructurada -> commercialScenario(source_mode=consultation) -> base propuesta -> Motor Comercial`

La consulta local solo interpreta intencion basica:

- cantidad de lineas;
- evento;
- marca preferida;
- presupuesto;
- objetivo del vendedor.

Bloqueos mantenidos:

- `interprete_local`;
- `consulta_no_decide_promociones`;
- `motor_comercial_define_elegibilidad`.

La consulta no decide convergencia, promociones, descuentos, elegibilidad, precios ni vigencias.

## Integracion con Fijo

Fijo no se duplico. El escenario puede incluir `fixed_services` y esto agrega el producto `fijo` al contexto del Motor.

Validado:

- escenario movil solamente produce `productos=['movil']`;
- escenario movil + fijo produce `productos=['movil','fijo']`;
- Benefits de convergencia leen el contexto combinado;
- la propuesta puede sumar Fijo como producto adicional sin mezclarlo con precio movil.

## Integracion con Convergencia

Convergencia no se infiere por ausencia de datos. El mapeo reconoce:

- `convergence.estado='convergente'` -> `cliente.convergente=true`;
- `convergence.estado='requiere_revision'` -> no aplica beneficio y conserva estado de revision;
- sin evidencia -> `no_confirmada`.

Si una regla exige convergencia y el escenario no la prueba, el Motor descarta la regla con motivo `requiere_convergencia_confirmada`.

## Casos probados

| Caso | Entrada | Resultado |
|---|---|---|
| A | CRM + movil solamente + no convergente | No aplica Benefit de convergencia; regla descartada con motivo. |
| B | CRM + movil + fijo + convergente | Aplica la misma regla publicada que Manual/Consulta. |
| C | Manual con los mismos datos del caso B | Misma decision del Motor que CRM. |
| D | Consulta con los mismos datos del caso B | Misma decision del Motor que CRM y Manual; consulta no decide regla. |
| E | Datos insuficientes para demostrar convergencia | No aplica beneficio; queda con `convergencia_estado=requiere_revision`. |
| F | Benefit existente incompatible/no aplicable | Motor descarta beneficio incompatible con motivo `beneficio_incompatible`. |

## Pruebas ejecutadas

- `node --check "Planes para web\constructor-publications.js"` -> OK.
- `node --test backend\test\constructor-motor-comercial-simulacion.test.js` -> 15/15 OK.

## Diferencias encontradas

No se detectaron diferencias comerciales entre CRM, Manual y Consulta cuando usan los mismos datos normalizados. La forma de capturar datos varia; la regla aplicada no varia.

## Bloqueos

- La consulta usa un interprete local; no depende de proveedor externo y solo prepara intencion estructurada.
- La evidencia de convergencia desde CRM depende de los datos disponibles. Si falta Tax ID, BAN unido/separado o producto fijo confirmado, se bloquea el Benefit.
- El Motor sigue en modo sombra; no se promueve como calculo definitivo.
- La ambiguedad `REDPLUS $60` vs `BREDP1 $65` sigue fuera de esta etapa y permanece bloqueada segun auditoria previa.

## Recomendacion de siguiente etapa

Antes de produccion, validar visualmente en navegador con:

1. cliente CRM real movil solamente;
2. cliente CRM real movil + fijo;
3. seleccion parcial de lineas dentro de un BAN;
4. consulta desde cliente CRM cargado;
5. comparacion de la misma operacion creada por CRM, Manual y Consulta.

Luego, si Gabriel aprueba el comportamiento visual, se puede preparar deploy controlado de esta entrada del Constructor, manteniendo `autoaplica=false` y fallback activo.

## Restricciones cumplidas

- No deploy.
- No migraciones.
- No `autoaplica=true`.
- No se quito fallback.
- No se cambio calculo definitivo.
- No se duplicaron reglas de Fijo.
- No se duplicaron reglas de Convergencia.
- No se inventaron reglas faltantes.
- Consulta no decide elegibilidad comercial.
- No se modifico produccion.
