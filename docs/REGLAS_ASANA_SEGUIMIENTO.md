# Reglas de Asana y Seguimiento

## Entrada operativa

Una oportunidad de seguimiento solo puede crearse para un cliente que tenga una
empresa o nombre utilizable. Se rechazan valores vacios y marcadores historicos:
guion largo, `-`, `null` y `sin nombre`.

El mensaje al usuario es: `El cliente no tiene empresa ni nombre. Completalo antes
de enviarlo a seguimiento.`

## Lista de Asana

La vista Asana muestra unicamente oportunidades activas cuyo cliente tiene una
identidad operativa valida. Los registros historicos sin empresa o nombre se
conservan en la base de datos, pero se excluyen de la lista operativa para evitar
filas en blanco, sin BAN o sin suscriptores.

Esta regla no elimina ni actualiza clientes, BAN, suscriptores, oportunidades,
ventas, tareas o notas existentes.

## Cartera al enviar desde Cliente

Cuando un cliente existente se envia a Seguimiento desde su ficha, la oportunidad
de origen `desde_cliente` incorpora sus lineas activas y suspendidas como lineas
de renovacion. Las suspendidas se tratan como activas para este flujo.

La clasificacion se obtiene de la linea real: tipo `G` es movil, `O` y `V` son
fijo, `T` es MPLS y `K` es Cloud. Cada suscriptor se agrega una sola vez a la
oportunidad; volver a enviar el mismo cliente completa solamente las lineas que
faltan y nunca reemplaza lineas agregadas manualmente por el vendedor.

Las lineas canceladas no entran automaticamente a Asana. Esta carga no modifica
clientes, BAN, suscriptores ni estados: solo materializa la cartera existente en
la oportunidad para que sus contadores y pasos de seguimiento reflejen la realidad.
