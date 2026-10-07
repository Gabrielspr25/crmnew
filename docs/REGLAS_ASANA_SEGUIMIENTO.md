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

## Renovaciones desde contratos y pagos — regla aprobada 2026-10-07

La lista y el detalle calculan las oportunidades desde los suscriptores reales
del cliente agrupado, sin depender de que existan productos guardados en Asana.
Regla completa aprobada y publicada el 2026-10-07:

- Fijo: no tiene fecha final registrada o su contrato venció (fecha final anterior al día actual de Puerto Rico).
- Móvil: tiene cero cuotas pendientes efectivas; vencimiento o ausencia de contrato por sí solos no lo incluyen.
- Las cuotas efectivas se calculan desde inicio y plazo por aniversario mensual, sin exigir vínculo a Tango. Clientes, Asana y comparativa-base comparten el cálculo, sin sobrescribir los registros originales.
- Otros productos conservan el criterio anterior: sin fecha final, vencidos o cero cuotas. Las nuevas/adicionales manuales se conservan.

Cuando faltan inicio o plazo válidos se conserva la cuota guardada. Pagos vacíos no equivalen a cero. Se señalan datos faltantes, fechas/plazo
inconsistentes y contradicciones entre pagos realizados y pendientes. No se
modifican los contratos ni se inventan cuotas o precios.

La clasificación usa la línea real: G móvil, O/V fijo, T MPLS, K Cloud y
line_kind TV para Claro TV. Solo Fijo se suma en dinero, con mensualidad válida;
los demás se cuentan en unidades. Fijo sin precio conserva su oportunidad y
muestra Sin precio. Se deduplica por suscriptor y teléfono/producto.

Se excluyen canceladas, inactivas, No renueva y productos guardados explícitamente
como vendidos/completados. Las ventas sincronizadas con reporte confirmado
descuentan una sola vez la línea/producto/teléfono y desde su fecha de oportunidad.
Las nuevas y adicionales manuales se conservan con su cruce existente de ventas.

No se insertan opportunity_lines desde lecturas ni se crea seguimiento para toda
la cartera. Enviar un cliente a seguimiento habilita este cálculo para ese cliente;
los seguimientos existentes se benefician inmediatamente, sin backfill.

## Adjuntos de notas — publicado 2026-10-07

En Gestión rápida > Nota se pueden adjuntar o pegar imágenes JPG, PNG y WebP,
y seleccionar PDF, Word (DOC/DOCX) o Excel (XLS/XLSX). Máximo cinco archivos
por nota y 10 MB por archivo. Una nota puede contener solo archivos.

Los archivos se vinculan a la nota, con nombre, formato, tamaño, autor y fecha.
Las imágenes muestran miniatura y vista previa; PDF tiene vista previa; Word y
Excel se descargan para abrirlos en su aplicación. Todas las descargas exigen
sesión y permiso de administrador/supervisor o vendedor propietario del
seguimiento. La consulta previa del seguimiento conserva sus permisos existentes;
otros vendedores no reciben metadatos ni contenido de los adjuntos.

Los archivos viven fuera del frontend estático con nombres UUID. Su formato se
valida por contenido. Si falla el guardado, se revierten nota/metadatos y archivos.
Eliminar una nota la oculta junto con sus adjuntos y conserva el historial.
La estructura se crea mediante migración explícita, nunca desde lecturas.
