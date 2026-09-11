# Constructor v1 - integracion local Motor Comercial a propuesta real en modo sombra

Fecha: 2026-08-30  
Proyecto comercial activo: `newcrm`  
Entorno: local, backend `http://localhost:4000`, PostgreSQL local `crm_pro`  
Alcance: propuesta real del Constructor en modo sombra. Sin produccion, sin migraciones productivas, sin `autoaplica`.

## 1. Resultado

El Constructor ahora calcula en paralelo:

1. Flujo actual de propuesta: plan, equipo, productos Fijo/TV y total usado por el vendedor.
2. Motor Comercial: reglas publicadas vigentes, Benefits elegibles/descartados, combinaciones, recomendacion y total simulado.
3. Diferencias: plan, equipo, descuentos, Benefits y total.

El total que guarda/imprime la propuesta sigue siendo el del flujo actual (`d.totalOferta`). El Motor Comercial se muestra solo como comparacion en modo sombra y no modifica automaticamente la propuesta.

## 2. Archivos modificados

- `Planes para web/constructor-publications.js`
  - Agrega `evaluateCommercialShadowProposal`.
  - Compara actual vs Motor sin sustituir resultados.
  - Devuelve diferencias de plan, equipo, descuentos, Benefits y total.
- `Planes para web/oferta-const.html`
  - Agrega estado `motorShadow`.
  - Inserta seccion `Motor Comercial - modo sombra` dentro de la propuesta real.
  - Muestra total flujo actual, total Motor, descuento Motor, diferencias, reglas aplicadas, reglas descartadas, combinaciones y recomendacion.
  - Mantiene guardado con `offer_total:d.totalOferta`.
- `backend/test/constructor-motor-comercial-simulacion.test.js`
  - Cubre modo sombra, bloqueo de regla no determinada y no sustitucion del total actual.
- `tmp/constructor-v1-real-local/validate-constructor-shadow-real-api.mjs`
  - Evidencia local contra backend real/API real.
- `tmp/constructor-v1-real-local/evidencia-constructor-shadow-real-local.json`
- `tmp/constructor-v1-real-local/evidencia-constructor-shadow-real-local.html`

## 3. Ejemplo completo de propuesta

Evidencia: `tmp/constructor-v1-real-local/evidencia-constructor-shadow-real-local.json`

- Cliente: `Cliente sombra local`
- BAN: `BAN-SOMBRA-001`
- Plan: primer plan individual publicado >= `$50`
- Equipo: primer equipo reconciliado desde oferta movil publicada
- Producto fijo: primer producto fijo publicado con precio >= `$29.99`
- Motor Comercial:
  - version `1dcf4dd1-16c6-41b7-a0f2-8dcad94411fd`
  - reglas recibidas: `9`
  - `autoaplica=false`

Totales del ejemplo:

| Medida | Valor |
|---|---:|
| Total actual cliente | `$145.00` |
| Total flujo actual propuesta | `$86.66` |
| Total Motor Comercial sombra | `$86.66` |
| Diferencia de total | `$0.00` |

La diferencia de total es cero porque las reglas reales publicadas no tienen evidencia suficiente de aplicacion monetaria mensual automatica para descontar en el total. El Motor si detecta Benefits elegibles y descartados, pero no los convierte en descuento aplicado.

## 4. Casos validados

| Caso | Total actual | Total Motor | Diferencia | Aplicadas | Descartadas | Estado |
|---|---:|---:|---:|---:|---:|---|
| convergente | `$86.66` | `$86.66` | `$0.00` | 5 | 4 | evaluable |
| no convergente | `$50.00` | `$50.00` | `$0.00` | 0 | 9 | bloqueada |
| portabilidad | `$86.66` | `$86.66` | `$0.00` | 5 | 4 | evaluable |
| renovacion | `$101.11` | `$101.11` | `$0.00` | 6 | 3 | evaluable |
| acumulacion | `$86.66` | `$86.66` | `$0.00` | 5 | 4 | evaluable |
| incompatibilidad | `$86.66` | `$86.66` | `$0.00` | 5 | 4 | evaluable |
| equipo + oferta + benefit | `$86.66` | `$86.66` | `$0.00` | 5 | 4 | evaluable |
| regla no determinada/bloqueada | `$86.66` | `$86.66` | `$0.00` | 5 | 5 | bloqueada |

## 5. Diferencias detectadas

Con las reglas reales actuales, la diferencia principal no es de total sino de Benefits:

- Flujo actual: no aplica Benefits publicados al total.
- Motor Comercial: identifica reglas elegibles y descartadas por contexto.
- Descuento monetario Motor: `$0.00` en los casos reales porque no se autoaplica ningun beneficio sin evidencia suficiente de aplicacion mensual.
- Regla no determinada: bloqueada con motivo `dato_no_determinado`.

Ejemplo de reglas aplicadas en caso convergente/portabilidad:

- `fijo_benefits|bono_streaming|fijo`
- `fijo_benefits|bono_portabilidad|fijo`
- `fijo_benefits|descuento_porcentaje|movil`
- `fijo_benefits|doble_data|movil`
- `fijo_benefits|pago_penalidad|fijo`

Ejemplo de reglas descartadas:

- `fijo_benefits|descuento_accesorios|accesorio`
  - motivos: `evento_no_aplica`, `producto_no_presente`
- `fijo_benefits|descuento_affinity|fijo`
  - motivo: `evento_no_aplica`
- `fijo_benefits|doble_velocidad|fijo`
  - motivo: `evento_no_aplica`

## 6. Pruebas ejecutadas

- `node --check "Planes para web\constructor-publications.js"`: OK
- `node --test backend\test\constructor-motor-comercial-simulacion.test.js`: 8/8 OK
- `node --test backend\test\constructor-motor-comercial-simulacion.test.js backend\test\constructor-publications-runtime.test.js backend\test\oferta-const-portal.test.js`: 22/22 OK
- `node --test backend\test\motor-comercial-local-db-validation.test.js backend\test\motor-comercial-reglas-compuestas-persistence.test.js backend\test\fijo-benefits-normalizer.test.js`: 21/21 OK
- `node tmp\constructor-v1-real-local\validate-constructor-shadow-real-api.mjs`: OK contra API real local

## 7. Riesgos pendientes

- Sigue siendo local; no demuestra produccion.
- No se activó `autoaplica`; cualquier descuento monetario real requiere autorizacion y evidencia documental de aplicacion.
- El total Motor puede igualar el total actual cuando los Benefits son informativos, creditos no mensuales o carecen de aplicacion automatica demostrable.
- La validacion visual PNG con Chrome sigue limitada por el fallo local de GPU ya documentado; se dejo HTML navegable como evidencia visual.
- No se sustituyo carrito, totales ni propuesta productiva.
