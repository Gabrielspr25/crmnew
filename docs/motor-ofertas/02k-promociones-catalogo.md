# 02k - Promociones catalogo

## Estado

`promociones` queda creada como catalogo de beneficios comerciales.

Archivo:

- `02k-promociones-catalogo.xlsx`

## Regla aplicada

Cada fila representa una promocion o beneficio comercial, no una regla completa.

En esta hoja no se modelan todavia:

- condiciones exactas
- acciones calculables
- compatibilidad
- prioridades
- modelos de equipos
- limites por BAN
- formulas de calculo

Eso queda para las proximas entidades: `condiciones`, `acciones` y `reglas`.

## Encabezado aprobado

```text
promo_id | nombre | familia | producto_id | tipo_promocion | descripcion | requiere_convergencia | fecha_inicio | fecha_fin | estado | fuente_boletin | pagina_fuente | observaciones
```

## Resultado

- Promociones cargadas: 22
- Estados:
  - activo: 9
  - vencido-pero-vendible: 12
  - pendiente-decision: 1
- Validacion: todos los `producto_id` existen en la hoja `productos`.

## Promociones incluidas

- AutoPay Business Red $10
- AutoPago Claro Oficina $5
- 3 meses gratis movil convergente
- Doble / Proxima velocidad Internet Fijo
- 1000 Megas por 6 meses
- 3Play convergente $143.74
- 3Play convergente $154.99
- Bono Streaming $10 por BAN
- Bono portabilidad movil $150
- Bonos portabilidad movil hasta $500
- Pago balance equipo/accesorios hasta $800
- Bono portabilidad fijo $150 en 24 meses
- Pago penalidad fijo hasta $200
- Descuentos ClaroTV+ asociados a 3Play
- Doble data Internet On The Go
- Doble data Claro Oficina/FWA
- Equipo gratis smartphone
- 50% descuento smartphone
- Credito/descuento fijo smartphone
- Descuentos modems, MiFi y tablets $130-$500
- 10% descuento accesorios convergente
- $0 deposito + AutoPay

## Notas importantes

- `requiere_convergencia` se mantiene a nivel de promocion solo como marca general. La decision exacta vivira en `condiciones` y `reglas`.
- Las promociones vencidas quedan como `vencido-pero-vendible` porque el criterio del proyecto es que no se bloquean hasta que un boletin nuevo las reemplace o elimine.
- `PROMO_3PLAY_CONVERGENTE_154_99` queda como `pendiente-decision` por posible conflicto/reemplazo con `PROMO_3PLAY_CONVERGENTE_143_74`.
- Las promociones de equipos no contienen modelos. Los modelos, precios, creditos, trade-in, prioridad entre gratis/50%/credito y limites por BAN se normalizan despues.

## Siguiente paso

Construir `condiciones`.

La hoja `condiciones` debe convertir los requisitos comerciales en evaluaciones atomicas que el motor pueda leer, por ejemplo:

- cliente es convergente
- evento es portabilidad
- evento no es renovacion
- plan pertenece a Business Red
- plan tiene renta minima
- tecnologia es GPON
- cantidad de lineas esta dentro del rango permitido
- producto es tablet, MiFi o modem
- equipo gratis excluye bono de portabilidad
