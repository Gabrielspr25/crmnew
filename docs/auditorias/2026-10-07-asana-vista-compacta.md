# Asana: vista compacta y agenda desde Clientes

Cambios visuales solicitados y autorizados por Gabriel el 7 de octubre de 2026.

- Se retira del detalle el bloque de oportunidades/productos y el aviso de revisión de contratos/pagos; también el aviso de la lista. El cálculo y los datos se conservan.
- Se retira la columna Agenda con el teléfono deshabilitado de la tabla Clientes. Se ajustan los colspan a doce columnas.
- Se conserva la prioridad manual y se añade debajo un botón Agendar que abre una ventana compacta con fecha, hora y motivo. Hora inicial 09:00; motivo vacío guarda Llamar al cliente.
- El guardado usa la ruta existente POST /api/asana-real/:id/log con type llamada y scheduled_call_at en ISO, construido desde la fecha/hora local. No hay cambios de backend ni base de datos.
- La fecha de la primera llamada pendiente, tomada del mapa existente de alertas, aparece debajo del botón al recargar los datos.

Publicación: frontend/app.html preparado desde el archivo productivo vigente para preservar trabajo ajeno. Respaldo en /home/gabriel/backups/asana-vista-20261007. Sin reinicio de backend.

Verificación: sintaxis de scripts; Chrome con funciones reales del artefacto local y publicado y API simulada para no crear llamadas ficticias; apertura, validación, payload de guardado y anchos 390/768/1280. Código público servido 200, salud 200, eliminación de bloques comprobada, botón Adjuntar al seleccionar Nota comprobado. No se creó una llamada real en producción para esta prueba.
