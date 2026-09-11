# Preparacion Motor Comercial como fuente principal del Constructor v1

Fecha: 2026-08-31  
Proyecto comercial activo: `newcrm`  
Alcance: preparacion local, sin activar `autoaplica`, sin despliegue y sin migraciones.

## Objetivo

Preparar el Constructor para que cada linea trabaje con una decision comercial unica:

`Motor Comercial / fallback anterior -> decision comercial seleccionada -> carrito -> totales -> propuesta`

## Resultado

- Se agrego una decision comercial seleccionada por linea.
- Si la linea viene del Motor, la decision queda marcada con `source = motor_comercial`.
- Si la linea aun viene del flujo anterior, queda marcada con `source = flujo_anterior_fallback`.
- La decision conserva plan, equipo, oferta, benefit, terminos, vigencia, fuente, version y totales.
- `autoaplica` se mantiene en `false`.
- El carrito, los totales y la propuesta leen la decision seleccionada cuando existe.
- El payload guardable de comparativa incluye `commercial_decisions`.
- Se agrego comparador de transicion para detectar diferencias entre fallback y Motor antes de activar fuente definitiva.

## Archivos modificados

- `Planes para web/constructor-publications.js`
- `Planes para web/oferta-const.html`
- `backend/test/constructor-motor-comercial-simulacion.test.js`

## Validaciones cubiertas

- Reglas confirmadas, vigentes, publicadas y `autoaplica=false`.
- Portabilidad.
- Renovacion.
- Cliente convergente y no convergente.
- Regla incompleta/no determinada bloqueada.
- Acumulacion e incompatibilidad.
- Tabletas y modems con beneficio de monto fijo.
- Comparacion entre flujo anterior y Motor.
- Fallback disponible durante la transicion.

## Pruebas ejecutadas

- `node --test backend/test/constructor-motor-comercial-simulacion.test.js`
  - Resultado: 11/11 OK.
- `node --check "Planes para web/constructor-publications.js"`
  - Resultado: OK.
- `node --test backend/test/benefits-portal-catalog.test.js backend/test/business-red-plus-eligibility.test.js backend/test/oferta-const-portal.test.js backend/test/constructor-business-red-plus-contract.test.js backend/test/constructor-motor-comercial-simulacion.test.js`
  - Resultado: 44/44 OK.

## Estado para decision

La arquitectura queda preparada para promover el Motor Comercial a fuente principal, pero todavia no se recomienda activarlo como fuente definitiva sin una validacion de equivalencia completa contra todos los casos productivos.

Pendientes antes de solicitar activacion definitiva:

- Validar con datos productivos reales cada familia Business RED, individuales y casos con cliente/BAN real.
- Confirmar que todas las reglas comerciales necesarias existen publicadas en el Motor, no solo las ya cubiertas.
- Verificar que las diferencias detectadas entre fallback y Motor son cero o estan aprobadas comercialmente.
- Mantener rollback/fallback hasta completar la comparacion.

## Limites cumplidos

- No se activo `autoaplica=true`.
- No se desplego produccion.
- No se ejecutaron migraciones.
- No se sustituyo todavia la logica anterior como definitiva.
