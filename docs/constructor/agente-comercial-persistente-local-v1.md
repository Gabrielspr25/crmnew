# Agente Comercial persistente local v1

## Alcance

Esta etapa prepara la conversacion comercial como una sesion local auditable dentro del Constructor, sin proveedor externo de IA y sin duplicar la inteligencia comercial del Motor Comercial.

La capa del agente solo interpreta intencion del vendedor y mantiene contexto entre turnos. No decide promociones, precios, elegibilidad, vigencias, limites BAN ni compatibilidad.

## Flujo

```text
Consulta del vendedor
-> interprete local
-> commercialScenario persistido en sesion local
-> Motor Comercial publicado
-> resultado / alternativas
-> respuesta explicada al vendedor
```

## Estado local implementado

- `createCommercialAgentSession()` crea una sesion local con `commercialScenario`.
- `applyCommercialAgentTurn()` agrega turnos, conserva contexto y genera un nuevo escenario.
- La sesion conserva lineas, evento, equipo, presupuesto, plan/familia y preferencias.
- Si no hay respuesta del Motor Comercial, el agente bloquea con `motor_result_required`.
- `external_provider=false`.
- `interpreter_type=local_rule_based`.
- `autoaplica=false`.

## Casos cubiertos

- Mantener el mismo `commercialScenario` entre turnos.
- Convertir `Tengo 5 renovaciones` en evento `renovacion` y 5 lineas seleccionadas.
- Leer varios equipos en una sola frase, por ejemplo `3 iPhone Pro y 2 S26`.
- Agregar categorias despues, por ejemplo `Agregame 2 tablets`.
- Reemplazar equipo sin decidir promociones, por ejemplo `Reemplaza los 2 S26 por Samsung A37`.
- Conservar presupuesto, por ejemplo `No quiero pasar de $500`.
- Preguntar por Benefits sin inventar respuesta comercial.

## Limites conservados

- No hay proveedor externo de IA.
- No hay API keys ni secretos nuevos.
- No se activa `autoaplica`.
- No se quita fallback.
- No se modifica el calculo definitivo.
- No se despliega.
- No se ejecutan migraciones.
- No se inventan promociones ni elegibilidad.

## Pendiente

- Persistencia durable por cliente/BAN requiere autorizacion de modelo/migracion.
- Auditoria historica en base de datos queda pendiente.
- Validacion visual integrada en navegador queda pendiente.
- Publicacion productiva no esta autorizada.

## Pruebas

```text
node --test backend\test\constructor-intelligent-consultation.test.js
```

Resultado local:

```text
27/27 pruebas aprobadas
```
