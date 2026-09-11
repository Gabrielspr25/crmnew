# Validacion operativa completa del Constructor Comercial v1

Fecha: 2026-09-01  
Proyecto comercial activo: `newcrm`  
Alcance: validacion local. Sin despliegue, sin migraciones, sin `autoaplica=true`, sin remover fallback.

## Objetivo

Validar el recorrido operativo:

```text
CRM / Manual / Consulta
-> commercialScenario
-> Motor Comercial
-> ofertas por linea
-> limites BAN
-> candidatos y alternativas
-> Fijo / Convergencia / Benefits
-> seleccion del vendedor
-> Cargar al Constructor
-> propuesta final visual
```

No se crearon reglas comerciales nuevas. La Consulta no decide elegibilidad; solo interpreta intencion y pide candidatos al Motor.

## Cambio de seguridad agregado

Se agrego una comparacion obligatoria antes de cargar una propuesta desde Consulta al Constructor:

- `consultationDecisionFingerprint`: huella del `commercialScenario` mostrado al vendedor;
- `consultationScenarioFingerprint()`: huella del escenario que se intenta cargar;
- bloqueo `consulta_constructor_mismatch` si ambos no coinciden.

Si hay diferencia entre lo visto en Consulta y lo cargado al Constructor, se bloquea la carga y se muestra alerta. Esto evita promover una seleccion distinta a la decision presentada.

## Evidencia local

Backend local:

- `GET http://localhost:4000/api/health`: `{"ok":true,"service":"ventaspro-nuevo"}`
- `GET http://localhost:4000/constructor/oferta-const.html`: `HTTP 200`

Captura local generada:

- `tmp-constructor-validacion-operativa.png`

La captura valida que la pantalla muestra:

- tres modos de entrada: Consulta, CRM y Manual;
- boton `Preparar opciones`;
- boton `Cargar propuesta al Constructor` deshabilitado antes de una decision;
- `autoaplica=false`;
- plan manual como fallback disponible.

## API real local

Se valido la lectura de la version vigente local:

```json
{
  "id": "220094ac-8bd3-400c-8378-44ab75e4202e",
  "numero": "1",
  "estado": "vigente",
  "vigencia": {
    "desde": "2026-07-23T04:00:00.000Z",
    "hasta": "2026-07-29T04:00:00.000Z"
  },
  "datos_count": 9,
  "fuentes_count": 2,
  "resumen_keys": ["offers", "reglas", "equipment", "blockingContradictions"]
}
```

El endpoint real local de candidatos respondio:

```json
{
  "status": 404,
  "ok": false,
  "codigo": "esquema_business_red_plus_no_publicado"
}
```

Conclusion tecnica: la API real local tiene una version vigente con 9 reglas en `datos`, pero esa version no publica `resumen.business_red_plus`. Por eso el endpoint `POST /api/motor-ofertas/candidatos-alternativas` no puede devolver candidatos reales por linea contra la base local actual. No se creo una tabla, regla ni estructura falsa para pasar la prueba.

## Casos maestros

| Caso | Resultado Motor/Contrato | Resultado visual Constructor | Estado |
|---|---|---|---|
| Renovacion 8 lineas Samsung A37 | Cubierto por pruebas de candidatos: 4 promociones y lineas restantes como candidatas regulares/alternativas segun limite BAN. | Pantalla local lista para Consulta y carga manual; API real local bloqueada por falta de `business_red_plus` publicado. | Bloqueado para validacion real local completa. |
| Renovacion 10 lineas Samsung S26 | Cubierto por pruebas: posiciones con promocion y posiciones a regular; no cambia equipo automaticamente. | Constructor conserva seleccion manual y no auto carga. | Validado por contrato, pendiente API real local. |
| Cliente real desde CRM | La Consulta conserva cliente, BAN, lineas, `account_type`, Fijo y convergencia cuando el escenario viene cargado. | Modo CRM visible; no se re-pide informacion si viene del CRM. | Pendiente prueba con BAN real navegada porque candidatos API real local no esta publicable. |
| Cliente convergente | Cubierto por pruebas: no inventa convergencia; solo la conserva si viene confirmada. | Benefits siguen en modo sombra/evaluacion. | Validado por contrato. |
| Presupuesto maximo | Cubierto por pruebas: interpreta `no pasar de $500`; los candidatos siguen viniendo del Motor. | Consulta muestra intencion y no decide promocion. | Validado por contrato. |

## Pruebas ejecutadas

```text
node --check "Planes para web\constructor-publications.js"
node --check backend\src\routes\motorOfertasRoutes.js
node --check backend\src\services\businessRedPlusEligibility.js
node --test backend\test\motor-commercial-candidates.test.js backend\test\constructor-intelligent-consultation.test.js backend\test\business-red-plus-eligibility.test.js backend\test\constructor-business-red-plus-contract.test.js backend\test\oferta-const-portal.test.js backend\test\constructor-motor-comercial-simulacion.test.js backend\test\constructor-publications-runtime.test.js backend\test\benefits-portal-catalog.test.js backend\test\motor-comercial-local-db-validation.test.js
```

Resultado:

- sintaxis: OK;
- suite dirigida: 92/92 pruebas aprobadas.

## Diferencias y bloqueos

- No hay diferencia detectada en pruebas de contrato entre Consulta, candidatos, modo sombra y fallback.
- Si Consulta intenta cargar un `commercialScenario` distinto al mostrado, ahora se bloquea con `consulta_constructor_mismatch`.
- La validacion con API real local queda bloqueada porque la version vigente no contiene `resumen.business_red_plus`.
- No se resolvio el bloqueo por inferencia ni copiando reglas desde frontend.

## Archivos modificados

- `Planes para web/oferta-const.html`
- `backend/test/constructor-intelligent-consultation.test.js`
- `docs/constructor/validacion-operativa-completa-v1.md`

## Restricciones cumplidas

- No deploy.
- No migraciones.
- No `autoaplica=true`.
- No se removio fallback.
- No se promovio Motor como calculo definitivo.
- No se modifico calculo definitivo.
- No se agrego proveedor IA externo.
- No se inventaron promociones.
- No se resolvio `FUENTE_AMBIGUA` por inferencia.

## Riesgos pendientes

- Publicar o corregir localmente, con fuente oficial y autorizacion separada, una version vigente que incluya el bloque `business_red_plus` consumible por candidatos.
- Ejecutar la validacion navegada con un BAN real cuando el endpoint de candidatos pueda devolver reglas por linea desde la API real local.
- Repetir los casos A37, S26, CRM real, convergente y presupuesto con datos reales completos antes de promover el Motor.

## Clasificacion final

`LISTO_PARA_PRUEBA_CONTROLADA`

No esta listo para promocion controlada ni para fuente definitiva. El contrato y la pantalla local pasan, pero la API real local de candidatos no puede completar la prueba operativa contra la version vigente actual porque falta `business_red_plus` publicado en el resumen de la version.
