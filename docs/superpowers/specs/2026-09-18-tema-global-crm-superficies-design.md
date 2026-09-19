# Tema global del CRM en todas las superficies

## Objetivo

El modo claro y el modo oscuro deben pintar de forma coherente toda la interfaz del CRM, incluidas las vistas principales, modales, BANes, suscriptores, tablas, filtros, formularios, badges y acciones. El cambio es exclusivamente visual.

## Problema comprobado

La modal del perfil de cliente adopta el fondo claro del CRM, pero las filas de suscriptores conservan fondos, bordes y textos oscuros fijados en estilos propios. Esto rompe el modo claro y hace que el modal parezca compuesto por dos temas distintos.

## Diseno aprobado

1. La paleta global de `body[data-theme]` sigue siendo la unica fuente de color para superficies, texto, bordes y estados.
2. Los componentes que hoy fijan colores oscuros se adaptan mediante selectores semanticos de modo dia y variables existentes. No se cambia el marcado ni las funciones de negocio.
3. Las filas de suscriptores conservan su estructura compacta: telefono, servicio, plan/equipo, renta, contrato, vencimiento, notas y acciones. Solo cambian los colores para asegurar contraste.
4. La auditoria cubre superficies globales y locales: contenedor de modal, pestañas, BAN, filtros, filas de suscriptor, celdas, controles de workflow, formularios, badges, tablas, enlaces y estados.
5. Se agregan contratos visuales que prueban que los selectores de las filas de suscriptor no mantienen colores oscuros en modo dia y que conservan los tokens globales en modo oscuro.
6. El modo oscuro no cambia: las reglas nuevas quedan acotadas a `body[data-theme="day"]`.

## Limites

- No cambiar endpoints, consultas, calculos, datos de clientes, BANes, suscriptores, precios, permisos ni flujos de guardar/cancelar.
- No modificar la estructura de las filas ni inventar informacion comercial.
- Desplegar solo `frontend/app.html` y sus pruebas dirigidas, con respaldo previo y comprobacion visual en produccion.

## Verificacion

1. Prueba dirigida en rojo y verde para el contrato de tema de suscriptores.
2. Bateria de contratos de Clientes y BANes.
3. Captura en produccion de la modal en modo claro y oscuro.
4. Confirmacion de `GET /api/health` despues del despliegue.
