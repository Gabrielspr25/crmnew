# Estado de versión — 2 de agosto de 2026

## Alcance verificado en Clientes

La tabla de Clientes usa datos reales del CRM y muestra:

- Empresa.
- Tipo de BAN calculado por productos activos.
- Vendedor.
- Oportunidades por categoría: Fijo Ren, Fijo New, Móvil New, Móvil Ren y Claro TV.

No muestra fecha de renovación en la tabla principal. La fecha se conserva en
el detalle/modal del cliente.

## Clasificación de Tipo de BAN

- Solo Móvil: Móvil.
- Solo Fijo: Fijo.
- Solo MPLS: Fijo. MPLS es un circuito dedicado de Internet y un producto
  fijo independiente.
- Móvil + Fijo/MPLS: Convergente.
- Móvil + Cloud: Convergente.
- Móvil + Claro TV: Convergente.
- Fijo/MPLS + Cloud: Convergente.
- Fijo/MPLS + Claro TV: Convergente.

No se usan categorías inventadas como Business, Wireline, Small o Sin
clasificar en la columna Tipo de BAN.

## Verificación realizada

- Prueba de contrato de la tabla de Clientes aprobada.
- Validación de sintaxis del frontend y de la ruta de Clientes aprobada.
- CRM publicado comprobado: carga 50 filas sin errores visibles.
- El backend de producción responde correctamente en `/api/health`.

## Pendiente acordado

- Ordenar los clientes por renovación vencida más antigua primero, sin afectar
  la carga de la pantalla.
- Asana queda fuera de este cambio hasta que se retome expresamente.

## Control de archivos

- `.deploy-staging/` es material temporal de despliegue y no debe entrar en
  la versión de Git.
- `.local-backups/` contiene respaldos de recuperación y se conserva.
- `outputs/` contiene reportes generados y se conserva fuera del commit hasta
  decidir cuáles deben archivarse.
