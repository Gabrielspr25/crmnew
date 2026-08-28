# Matriz 1 con respaldo de Portafolio para líneas sin descuento

## Objetivo

Cuando una línea Business Red Plus no reciba descuento en la hoja `Ofertas Business Red Plus`, el constructor debe seguir ofreciendo alternativas comerciales válidas tomadas de `Ofertas Equipos en Portafolio`, según el valor real del plan de esa línea.

## Regla aprobada

1. `Ofertas Business Red Plus` (Matriz 1) conserva la prioridad y determina el beneficio del equipo por posición de línea.
2. Si Matriz 1 indica equipo gratis o descuento, se muestra ese resultado sin reemplazarlo.
3. Si Matriz 1 indica `NO TIENE DESCUENTO`, desde la línea 5 hasta la línea 10, el motor consulta también `Ofertas Equipos en Portafolio`.
4. La consulta de Portafolio usa el valor real del plan asignado a esa línea, la familia Business Red Plus, el evento de la línea, el plazo y los términos de la fila.
5. Solo se muestran equipos elegibles. No se heredan ofertas por monto si los términos no incluyen Business Red Plus.
6. Los límites por BAN modifican el beneficio cuando la fuente permite financiar fuera del límite; no eliminan el equipo.
7. Cada resultado conserva hoja, fila, vigencia, beneficio, pago mensual, price code y términos aplicables.

## Enfoques considerados

- Recomendado: combinar resultados dentro del motor de elegibilidad. Mantiene una sola decisión trazable y evita lógica comercial en el HTML.
- Alternativa descartada: hacer una segunda consulta desde el constructor. Duplicaría reglas en la interfaz y podría producir resultados contradictorios.
- Alternativa descartada: sustituir Matriz 1 por Portafolio desde la línea 5. Perdería los equipos financiados a precio regular que Matriz 1 todavía permite.

## Flujo

1. El vendedor escoge Business Red Plus, cantidad de líneas y evento por línea.
2. El motor evalúa Matriz 1 por posición.
3. Para líneas 5 a 10 sin descuento, evalúa las filas publicadas de Portafolio compatibles con Business Red Plus y con el valor de esa línea.
4. Fusiona por modelo/capacidad sin duplicados y conserva el resultado comercial más específico de cada fuente.
5. El modal muestra únicamente equipos elegibles y el pago mensual correspondiente a esa línea.

## Límites

- No cambia los precios de los planes ni los descuentos de Matriz 1.
- No cambia reglas de convergencia, bonos, seguro, taxes o trade-in.
- No usa HTML o JavaScript como fuente comercial.
- No agrega datos manuales; consume la versión oficial publicada del motor.
- No modifica base de datos ni ejecuta migraciones.

## Pruebas de aceptación

- Línea 4 conserva exclusivamente el resultado de Matriz 1.
- Línea 5 sin descuento incorpora ofertas de Portafolio que incluyan Business Red Plus y cumplan el valor del plan.
- Línea 10 usa la misma regla de respaldo.
- Una fila individual no aparece en una línea multilínea aunque su monto coincida.
- Una fila que excluye Business Red Plus no aparece.
- No hay equipos duplicados.
- Cada equipo muestra pago mensual, beneficio y fuente correctos.
