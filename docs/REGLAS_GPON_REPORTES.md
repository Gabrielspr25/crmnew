# GPON y reportes inteligentes

## Revision GPON por linea fija

La revision GPON/aumento es informacion comercial manual por suscriptor fijo.
No pertenece a la cartera importada, no viene de Tango y no reemplaza el plan,
precio, estado ni fecha contractual del suscriptor.

Se guarda en `public.subscriber_gpon_reviews` con:

- `subscriber_id`: linea revisada.
- `gpon_applies`: si aplica GPON.
- `gpon_note`: nota corta del aumento u oportunidad, maximo 80 caracteres.
- `reviewed_at`: fecha de revision.
- `reviewed_by`: usuario que guardo la revision.

La modal del cliente muestra los controles solo cuando la linea se clasifica como
`fijo` por `line_kind` o por `PRODUCT_TYPE` fijo (`O`, `T`, `V`).

## Reportes

La caja inteligente de reportes interpreta preguntas de negocio y ejecuta
consultas de solo lectura predefinidas. No acepta SQL libre ni comandos.

Intenciones iniciales:

- GPON, fibra o aumento: lineas fijas con revision GPON/aumento.
- Vencidos, renovar o renovaciones: lineas activas vencidas, proximas o sin
  fecha de vencimiento.
- Convergencia: clientes con movil y fijo activos.
- Movil: lineas moviles activas.
- Fijo: lineas fijas activas.

Los resultados salen de `clients`, `bans`, `subscribers` y
`subscriber_gpon_reviews`, usando datos reales de `public`.
