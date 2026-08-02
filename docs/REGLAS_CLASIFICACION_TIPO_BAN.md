# Reglas de clasificación de Tipo de BAN

Estas reglas aplican a la columna **Tipo de BAN** de Clientes. Se calculan con
productos activos reales; no usan etiquetas manuales de BAN ni categorías
inventadas.

## Productos base

- **Móvil**: cliente con líneas móviles activas.
- **Fijo**: cliente con líneas fijas activas.
- **MPLS**: circuito dedicado de Internet; es un producto fijo independiente.
  Un cliente con solo MPLS se clasifica como **Fijo**.

## Servicios adicionales

- **Claro TV** y **Cloud** son componentes adicionales.

## Resultado de la clasificación

- Solo Móvil: **Móvil**.
- Solo Fijo o solo MPLS: **Fijo**.
- Móvil y Fijo/MPLS: **Convergente**.
- Móvil y Claro TV: **Convergente**.
- Móvil y Cloud: **Convergente**.
- Fijo/MPLS y Claro TV: **Convergente**.
- Fijo/MPLS y Cloud: **Convergente**.

Un cliente que solo tiene Cloud o Claro TV, sin Móvil, Fijo ni MPLS, no recibe
una clasificación base en esta columna.
