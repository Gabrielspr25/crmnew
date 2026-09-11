# Integracion Constructor -> Comparativa v1

Fecha: 2026-09-04  
Proyecto: `newcrm`  
Estado: implementacion local, sin despliegue, sin migraciones.

## Objetivo

Permitir que la propuesta final generada por Consulta Inteligente se envie al modulo existente de Comparativas sin crear plantillas nuevas ni recalcular promociones dentro de Comparativa.

Flujo:

```text
Consulta Comercial
-> commercialScenario final
-> Motor Comercial
-> commercialDecision
-> respuesta comercial simple
-> Enviar a Comparativa
-> POST /api/comparativas
```

## Auditoria de Comparativas existente

El CRM ya tiene el modulo de Comparativas:

- backend: `POST /api/comparativas` en `backend/src/routes/misc.js`;
- frontend CRM: pestaña Comparativas del cliente en `frontend/app.html`;
- Constructor: funciones existentes `comparisonData()`, `saveComparisonToCrm()`, `comparisonHtmlDocument()`, `downloadComparisonHtml()`, `downloadComparisonExcel()` y `printComparison()` en `Planes para web/oferta-const.html`.

El contrato actual acepta:

- `client_id`;
- `name`;
- `current_total`;
- `offer_total`;
- `lines`;
- `notes`;
- `source`;
- `payload`.

La integracion nueva reutiliza ese contrato con `source = constructor_agente_comercial`.

## Respuesta comercial simple

`evaluateCommercialConsultation()` ahora produce `commercial_response` como vista comercial principal:

- titulo `Cotizacion`;
- resumen de lineas, evento y plan;
- equipos agrupados;
- plan sin AutoPay y con AutoPay cuando existe;
- equipos netos;
- resumen de promociones de equipo;
- `autoaplica=false`.

La vista principal no expone por defecto:

- `source_mode`;
- `commercialScenario`;
- `confidence`;
- `rule_id`;
- `publication_id`;
- estructuras internas del Motor.

La trazabilidad queda disponible en la accion secundaria `Ver por que aplica`.

## Envio a Comparativa

La accion `Enviar a Comparativa`:

1. exige contexto de cliente CRM (`crm_client_id`);
2. valida que la consulta no este bloqueada;
3. compara la huella del escenario mostrado contra el escenario actual;
4. si no coincide, bloquea con `consulta_comparativa_mismatch`;
5. construye el body para `/api/comparativas` con `buildConsultationComparisonPayload()`;
6. envia el escenario final y la decision del Motor en `payload`;
7. marca `recalculate_in_comparativa=false`.

Comparativa presenta la propuesta recibida. No decide promociones, elegibilidad ni Benefits.

## Benefits

Solo se envian como aplicados los Benefits/reglas confirmados por Motor/Servicios.

Los elementos con:

- `requiere_revision`;
- `FUENTE_AMBIGUA`;
- contradiccion;
- fuente incompleta;
- no determinado;

quedan fuera de `beneficios_aplicados` y se conservan aparte en `beneficios_revision`.

## Caso probado

Caso contractual:

```text
5 renovaciones
Business RED Extreme
4 iPhone 17
1 Franklin CG890
Convergente
```

Resultado esperado:

- respuesta comercial simple;
- accion manual `Enviar a Comparativa`;
- payload con cliente/contexto, 5 lineas, Extreme, 4 iPhone, 1 modem, precio, AutoPay, Benefits confirmados, total y diferencia si existe dato actual;
- sin recalculo de promociones dentro de Comparativa.

## Pruebas

Archivo:

- `backend/test/constructor-intelligent-consultation.test.js`

Cobertura agregada:

- respuesta comercial simple sin trazas tecnicas por defecto;
- payload para Comparativa existente;
- bloqueo `consulta_comparativa_mismatch`;
- presencia de accion `Enviar a Comparativa`;
- no se agrega proveedor externo;
- `autoaplica=false`.

## Restricciones cumplidas

- No deploy.
- No produccion.
- No migraciones.
- No nuevas plantillas de Comparativa.
- No modulo duplicado de Comparativas.
- No recalculo de promociones en Comparativa.
- No cambios al Motor Comercial.
- No `autoaplica=true`.

## Riesgos pendientes

- Validacion visual navegada pendiente con cliente/BAN real antes de cualquier despliegue.
- Las plantillas actuales de Comparativa pueden requerir revision comercial/visual posterior.
- La persistencia durable de la conversacion completa del Agente sigue bloqueada hasta autorizar migracion dedicada.
