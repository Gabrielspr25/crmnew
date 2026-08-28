# Agente local de Outlook

Este agente se instala en la computadora que mantiene Outlook clasico abierto. No se ejecuta desde el servidor web.

1. Copiar `CorreosAgent.ps1` a una carpeta local protegida.
2. Crear junto al script `CorreosAgent.local.psd1` con `CrmUrl`, `AgentToken` y `Mailbox`; no agregar ese archivo a Git.
3. Mantener Outlook clasico abierto antes de cada ejecucion; el agente no lo abre automaticamente.
4. Ejecutar inicialmente sin `-Run`: inspecciona la cola sin enviar ni mover mensajes. Si faltan carpetas, crea `Email de campana` y las subcarpetas necesarias.
5. Tras validar una campana de ensayo, crear una tarea programada cada 30 minutos con `-Run`, oculta y con limite corto de ejecucion.

El agente solo procesa asuntos que contengan `[CRM-CAMP-...]` o `[CRM-CLI-...]`. No mueve ni reporta mensajes sin ese identificador.
