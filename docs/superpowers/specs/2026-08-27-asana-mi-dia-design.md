# Asana Mi Dia - Diseno

## Objetivo

Unificar en Asana las llamadas agendadas, los proximos pasos comerciales y las tareas generales para que cada vendedor pueda comenzar el dia con una lista clara de pendientes.

## Experiencia

- La pantalla Asana incluye un bloque compacto `Mi dia` antes de las oportunidades.
- La agenda agrupa elementos en `Vencidas`, `Hoy` y `Proximas`.
- Una tarea puede existir sin cliente o vincularse opcionalmente a una oportunidad.
- Dentro de una oportunidad, el usuario puede agendar una tarea asociada al paso actual.
- Al completar una tarea vinculada, se completa el paso correspondiente y se muestra el siguiente paso de la oportunidad.
- Un vendedor ve sus propios elementos. Un administrador puede alternar entre su agenda y la del equipo.

## Datos

Se crea `public.asana_tasks` con titulo, notas, vencimiento, prioridad, estado, responsable, creador y referencias opcionales a cliente, oportunidad y paso. Las llamadas continúan en `public.opportunity_notes`, pero la agenda las consulta junto con las tareas.

## Reglas

- Titulo, vencimiento y responsable son obligatorios.
- Prioridades permitidas: baja, normal y alta.
- Estados permitidos: pendiente, completada y cancelada.
- Vendedores solo consultan y modifican sus tareas.
- Administradores pueden consultar el equipo y asignar tareas.
- Una tarea general no requiere cliente ni oportunidad.
- Completar una tarea no inventa fechas para el siguiente paso.

## Seguridad y errores

Todas las rutas requieren sesion. Los identificadores opcionales deben existir y respetar el alcance del vendedor. Un error de validacion no crea ni modifica tareas.

## Verificacion

Pruebas de contrato cubren migracion, rutas, permisos, agenda combinada y controles visuales. La interfaz y el backend se validan por sintaxis antes de cualquier despliegue.
