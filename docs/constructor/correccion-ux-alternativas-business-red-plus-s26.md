# Correccion UX y alternativas - Business RED Plus / 10 Samsung S26

Fecha: 2026-09-01

## Alcance

Correccion puntual local de presentacion y filtrado de Consulta Inteligente para el caso:

`Tengo 10 lineas Business RED Plus para renovar y quiero Samsung S26. Que me propones?`

No se cambio la regla comercial principal del S26. No se activo `autoaplica`. No se desplego. No se modificaron migraciones ni calculo definitivo del Constructor.

## Causa

- La Consulta mostraba el detalle del Motor por posicion, pero el resumen superior seguia tomando el estado manual inicial del Constructor: `Manual / Individual $35 / 1 linea`.
- Las alternativas automaticas no conservaban de forma estricta la categoria pedida cuando el vendedor solicitaba un smartphone. En la fuente movil, algunos smartphones vienen clasificados como `gama_alta` o `gama_baja`, no como `smartphone`; eso podia mezclar o descartar candidatos de forma visualmente incorrecta.
- Las alternativas repetidas se mostraban linea por linea, aunque comercialmente eran el mismo equipo/regla/resultado disponible para varias posiciones.
- Los totales podian quedar visualmente como `$0.00` cuando faltaba informacion, en vez de distinguir entre total calculable y total pendiente.

## Correccion aplicada

- Se normalizo categoria de producto para tratar `gama_alta`, `gama_baja`, `telefono`, `celular`, `movil` e `iphone` como `smartphone`.
- Cuando la consulta pide `Samsung S26`, las alternativas automaticas quedan filtradas a `categoria_producto=smartphone`.
- Se agrupan alternativas por equipo, beneficio, mensualidad, fuente y regla, mostrando `Disponible hasta X linea(s) pendiente(s)`.
- Se ordenan alternativas solo para presentacion: gratis, menor mensualidad y mayor descuento.
- Se muestra detalle individual de las 10 lineas devueltas por el Motor.
- Se calculan totales desde el resultado del Motor: renta de planes, equipos, descuentos/creditos y total estimado.
- El resumen superior refleja Consulta Inteligente, Business RED Plus, 10 lineas, Renovacion, Samsung Galaxy S26 y `autoaplica=false`.
- Los pasos manuales del Constructor quedan ocultos mientras la Consulta no se cargue con `Cargar al Constructor`.

## Evidencia local

Captura local:

`tmp-evidencia/constructor-business-red-plus-s26-ux-local-final.png`

Resultado visual validado:

- 10 lineas mostradas individualmente.
- Linea 1: S26 gratis.
- Lineas 2 y 3: S26 con 50%.
- Lineas 4 a 10: S26 regular.
- Resumen: 3 con promocion/beneficio, 7 regular, 0 requiere revision.
- Totales: renta planes `$650.00`, equipos `$224.00`, descuentos/creditos `$56.00`, total estimado `$874.00`.
- Alternativas automaticas: solo smartphones; sin tabletas, iPad, MIFI ni modem.
- Fuente visible: tabla oficial vigente `Tabla Ofertas Update Plus y Financiamiento 27 de agosto al 16 de septiembre de 2026 - PYMES.xlsx`.

## Pruebas ejecutadas

- `node --check "Planes para web\constructor-publications.js"`: OK.
- `node --test backend\test\constructor-intelligent-consultation.test.js backend\test\motor-commercial-candidates.test.js backend\test\business-red-plus-publication.test.js`: 42/42 OK.
- `node --test backend\test\constructor-intelligent-consultation.test.js backend\test\motor-commercial-candidates.test.js backend\test\oferta-const-portal.test.js`: 51/51 OK.
- Regresion Constructor/Motor/Benefits/Fijo: 133/133 OK.

## Archivos modificados

- `Planes para web/constructor-publications.js`
- `Planes para web/oferta-const.html`
- `backend/test/constructor-intelligent-consultation.test.js`
- `docs/constructor/correccion-ux-alternativas-business-red-plus-s26.md`

## Riesgos pendientes

- Esta correccion esta validada localmente. Falta autorizacion separada para desplegar.
- El ranking de alternativas es solo presentacion; la elegibilidad sigue viniendo del Motor Comercial.
- No se promovio Motor Comercial como fuente definitiva ni se retiro fallback.

## Correccion adicional - total multilínea Business RED Plus

Fecha: 2026-09-01

### Problema

La Consulta calculaba la renta del plan Business RED Plus como `cantidad_lineas x tarifa_base`. Para 10 lineas esto producia `$650.00`, lo cual es incorrecto para un plan multilínea por suscriptor.

### Solucion

- `mobileCatalog()` ahora conserva, desde el modulo publicado existente, los costos por posicion (`lineCosts`), codigos por posicion (`lineCodes`), costos con AutoPay (`autoPayLineCosts`) y acumulados por cantidad (`lineTotals`, `autoPayTotals`).
- `consultationScenarioForEvaluation()` usa esos acumulados oficiales para Business RED Plus.
- La pantalla muestra dos escenarios cuando el vendedor no especifica AutoPay:
  - Sin AutoPay.
  - Con AutoPay.
- No se duplico ninguna tabla comercial. Los valores salen del catalogo/módulo movil ya publicado.

### Validacion del caso S26

Consulta:

`Tengo 10 lineas Business RED Plus para renovar y quiero Samsung S26. Que me propones?`

Resultado local:

| Escenario | Total plan | Equipos regular | Creditos/descuentos equipos | Total equipos neto | Total mensual estimado |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sin AutoPay | `$350.00` | `$280.00` | `$56.00` | `$224.00` | `$574.00` |
| Con AutoPay | `$250.00` | `$280.00` | `$56.00` | `$224.00` | `$474.00` |

Captura local:

`tmp-evidencia/constructor-business-red-plus-s26-total-local-final.png`

### Pruebas adicionales

- Business RED Plus acumulado regular/AutoPay validado para 1, 2, 3, 5, 8 y 10 lineas.
- Regresion: 10 lineas ya no puede calcularse como `10 x $65`.
- Validacion visual local confirmo que no aparece `$650.00` en el resultado de Consulta.
