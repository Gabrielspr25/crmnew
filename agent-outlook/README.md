# Agente local de Outlook

Este agente se instala en la computadora que mantiene Outlook clásico abierto. No se ejecuta desde el servidor web.

1. Copiar `CorreosAgent.ps1` a una carpeta local protegida.
2. Crear junto al script `CorreosAgent.local.psd1` con `CrmUrl`, `AgentToken` y `Mailbox`; no agregar ese archivo a Git.
3. Verificar que en la cuenta indicada existan `Inbox/Email de campaña` y las carpetas: Interesados, Pendientes de responder, Reunión / llamada agendada, No contactar / baja y Fallidos.
4. Ejecutar inicialmente sin `-Run`: inspecciona la cola sin enviar ni mover mensajes.
5. Tras validar una campaña de ensayo, crear una tarea programada cada 30 minutos con `-Run`.

El agente solo procesa asuntos que contengan `[CRM-CAMP-…]` o `[CRM-CLI-…]`. No mueve ni reporta mensajes sin ese identificador.
