# Fase 2I - Planes base con tarifas normalizadas

Generado: 2026-07-04 21:32:16

## Ajuste aplicado

Se elimino el valor textual `tabla_por_lineas` de `planes_base`.

Ahora:

- `planes_base.precio_variable = true` para planes con precio por cantidad de lineas.
- `planes_base.renta_mensual` queda vacio cuando el precio es variable.
- Se agrego la hoja `planes_tarifas`.

## Nueva hoja `planes_tarifas`

Columnas:

`plan_tarifa_id | plan_id | cantidad_lineas_desde | cantidad_lineas_hasta | precio_regular | precio_autopay | vigencia_id | estado | fuente_boletin | pagina_fuente | observaciones`

## Estado

- Business Red Plus tiene tarifas cargadas de 1 a 10 lineas.
- Business Red Extreme/Supreme/Sin Fronteras/BYOP quedan como pendientes de normalizar desde la tabla oficial completa antes de usar el motor.

## Archivo

- `C:\Users\Gabriel\Documentos\Programas\newcrm\docs\motor-ofertas\02i-planes-base-tarifas.xlsx`

## Proximo paso

Con productos y planes base/tarifas estabilizados, el siguiente entregable debe ser `promociones`.
