# Fase 2D - Producto sin convergencia obligatoria

Generado: 2026-07-04 18:02:35

## Ajuste aprobado

Esta version aplica el ajuste correcto: **la convergencia no debe ser una propiedad obligatoria del producto**.

Un producto como `3Play`, `Claro Oficina`, `IOTG` o `ClaroTV+` puede existir y venderse regular sin convergencia. Lo que requiere convergencia es el beneficio, descuento, bono o promocion.

## Cambios realizados

- En `productos`, se elimino `requiere_convergencia`.
- En `productos`, se agrego `categoria_motor`.
- `categoria_motor` usa estos valores:
  - `producto_simple`
  - `paquete`
  - `equipo`
  - `accesorio`
  - `servicio_adicional`
- La convergencia queda en:
  - `promociones.requiere_convergencia`
  - `condiciones.COND_CONVERGENTE`
  - `reglas.condiciones_ids`
- Se agrego una hoja `notas_modelo` con las decisiones de arquitectura.

## Archivo generado

- `C:\Users\Gabriel\Documentos\Programas\newcrm\docs\motor-ofertas\02d-matriz-normalizada-producto-plan-regla.xlsx`

## Estado

Esta version queda mejor preparada para diseno de BD porque evita bloquear productos regulares y permite que el motor decida beneficios por regla.
