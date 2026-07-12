# Fase 2C - Separacion Producto / Plan / Promocion

Generado: 2026-07-04 17:58:47

## Cambio aplicado

Esta version corrige la observacion principal: no mezclar producto con oferta.

- `Business Red` queda como producto unico: `PROD_BUSINESS_RED`.
- `Plus`, `Extreme`, `Supreme`, `Sin Fronteras` quedan como planes: `PLAN_BR_*`.
- `Internet Fijo` queda como producto: `PROD_INTERNET_FIJO`.
- Velocidades 30M, 50M, 100M, 150M, 200M, 300M, 350M, 450M, 500M, 650M, 1000M quedan como planes base.
- `3Play` queda como producto: `PROD_3PLAY`.
- `3Play $143.74` y `3Play $154.99` quedan como promociones: `PROMO_3PLAY_143_74` y `PROMO_3PLAY_154_99`.
- Equipos se separan en smartphone, tablet, MiFi, router/modem y accesorios.
- `Servicios SOC` se renombra conceptualmente a `Servicios adicionales`.

## Archivo generado

- `C:\Users\Gabriel\Documentos\Programas\newcrm\docs\motor-ofertas\02c-matriz-normalizada-producto-plan-promo.xlsx`

## Columnas nuevas en productos

`producto_id`, `codigo`, `nombre`, `familia`, `tipo`, `requiere_convergencia`, `requiere_plan`, `requiere_contrato`, `estado`, `descripcion`.

## Estado

Esta version es una base mejor para tablas reales de BD. Todavia falta completar valores desde todos los boletines, pero la forma del modelo ya evita duplicidad y separa correctamente plan/oferta.
