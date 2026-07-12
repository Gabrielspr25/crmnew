# Fase 2H - Planes base limpio

Generado: 2026-07-04 21:09:46

## Regla aplicada

`planes_base` no incluye promociones.

- Doble velocidad queda fuera de planes base.
- 1000 Megas por 6 meses queda fuera de planes base.
- 3Play $143.74 / $154.99 queda fuera de planes base y pertenece a promociones.
- Equipo gratis queda fuera de planes base.

## Columnas

`plan_id | producto_id | codigo_plan | nombre_plan | familia | tecnologia | velocidad_contratada | velocidad_recibida_regular | renta_mensual | contrato_requerido | estado | fuente_boletin | pagina_fuente | observaciones`

## Archivo

- `C:\Users\Gabriel\Documentos\Programas\newcrm\docs\motor-ofertas\02h-planes-base-limpio.xlsx`

## Conteo inicial

Se cargaron 58 planes base iniciales desde boletines/listado actual.

## Pendiente

- Validar si las rentas moviles individuales deben salir de la lista de precios vigente o de BD actual.
- Completar pagina exacta cuando el PDF tenga tabla visual/OCR pendiente.
- Si un plan tiene precio por cantidad de lineas, mantener `renta_mensual = tabla_por_lineas` y resolver detalle en una tabla futura `planes_tarifas`.
