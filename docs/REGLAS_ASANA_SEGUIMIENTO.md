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
