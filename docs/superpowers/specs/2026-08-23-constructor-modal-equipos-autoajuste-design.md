# Modal de equipos con autoajuste

## Objetivo

La modal de selección de equipos debe aprovechar el alto disponible de la pantalla para evitar que el primer equipo y sus opciones queden comprimidos.

## Diseño aprobado

- La modal crecerá automáticamente hasta un máximo cercano al alto visible de la pantalla.
- El encabezado, las marcas y el detalle del equipo permanecerán visibles.
- Cuando la lista exceda el espacio disponible, el desplazamiento ocurrirá dentro de la lista de equipos.
- En pantallas pequeñas, la modal conservará márgenes mínimos y no se saldrá del área visible.

## Alcance

Solo cambia el tamaño y el desplazamiento de la modal. No cambian las reglas de elegibilidad, precios, equipos, eventos, planes ni el motor de ofertas.

## Validación

- Abrir el Constructor en escritorio.
- Seleccionar Multilínea y Business Red Plus.
- Abrir `Escoger equipo` en la primera línea.
- Confirmar que la modal usa casi todo el alto disponible.
- Confirmar que la lista se desplaza sin mover el encabezado ni el detalle.
