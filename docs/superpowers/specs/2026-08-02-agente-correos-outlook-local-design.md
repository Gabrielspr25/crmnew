# Agente local de Correos y campañas CRM

## Objetivo

Incorporar al CRM un módulo de Correos que cubra dos flujos separados:

1. Correos 1 a 1: Gabriel selecciona un cliente, revisa y edita un borrador enriquecido y lo envía manualmente desde Outlook.
2. Campañas: Gabriel crea una campaña editable y la programa; un agente local en su servidor personal envía los lotes desde Outlook y organiza únicamente sus respuestas relacionadas.

El agente se ejecuta en la computadora de Gabriel. Si se apaga, al encenderse reanuda la cola pendiente sin duplicar envíos.

## Campañas

Cada campaña conserva nombre, estado, período de inicio y fin, asunto editable, contenido enriquecido editable, destinatarios, adjuntos y programación. La programación tendrá inicialmente un máximo configurable por lote y un intervalo configurable; el valor inicial será 100 correos cada 30 minutos.

Al guardar una campaña, el CRM agrega un identificador estable y visible al asunto, por ejemplo `[CRM-CAMP-024]`. Ese identificador permite distinguir respuestas de campaña, incluso si Outlook antepone `RE:`.

El contenido no será compartido ni fijo entre campañas: cada campaña mantiene su propia plantilla y puede editarse antes de iniciarse o durante una pausa. Las modificaciones solo afectan correos aún pendientes.

## Correos 1 a 1

El usuario selecciona un único cliente y el CRM genera un borrador enriquecido editable con los datos comerciales reales que estén disponibles: empresa, BAN, suscriptores activos, planes y montos válidos. No se inventarán datos faltantes.

El asunto incorpora un identificador individual, por ejemplo `[CRM-CLI-123-001]`. El usuario puede modificar texto y formato antes de abrir el borrador en Outlook. El agente detecta el mensaje enviado y sus respuestas por ese identificador, y conserva ambos eventos en la ficha del cliente.

## Alcance seguro en Outlook

El agente solo lee y clasifica mensajes cuyo asunto contenga el identificador de una campaña activa o de un borrador 1 a 1 registrado. No alterará mensajes ajenos de las cuentas Outlook.

Las respuestas identificadas se clasificarán en las carpetas existentes bajo `Email de campaña`:

- Interesados
- Pendientes de responder
- Reunión / llamada agendada
- No contactar / baja
- Fallidos

Si no hay seguridad suficiente, el mensaje se conservará en `Pendientes de responder`. Los mensajes que no pertenezcan a un identificador CRM no se moverán ni se reportarán.

## Reportes y trazabilidad en CRM

El módulo mostrará por campaña: programados, enviados, pendientes, respuestas, interesados, reuniones/llamadas, bajas y fallidos. Para correos 1 a 1, la ficha del cliente mostrará la línea de tiempo de borrador, envío y respuestas clasificadas.

El agente reportará en CRM solamente metadatos necesarios para la trazabilidad: identificador del mensaje, campaña o cliente, fecha, carpeta o clasificación y estado. El contenido completo del correo no se copiará al CRM salvo que se habilite explícitamente en una fase posterior.

## Componentes y límites técnicos

- Frontend: panel de Campañas, editor enriquecido, generación de borrador 1 a 1, cola y reportes.
- Backend CRM: persistencia de campañas, destinatarios, borradores individuales, eventos y endpoints autenticados para el agente local.
- Agente local Windows: tarea recurrente que consulta la cola, envía por Outlook, inspecciona enviados y respuestas, y notifica al CRM.

La primera versión no usa SMTP ni Microsoft Graph. No requiere credenciales nuevas en el servidor productivo. No cambia datos de Clientes, Asana, Comisiones, Ofertas ni reglas comerciales.

## Errores y pruebas

El agente debe registrar errores de entrega sin reintentos indefinidos, evitar duplicados por identificador de mensaje y respetar los límites configurados. Se probarán contratos de cola, identificación por asunto, idempotencia, clasificación y render del editor; la publicación se verificará con una campaña de prueba sin destinatarios externos antes de activar un envío real.
