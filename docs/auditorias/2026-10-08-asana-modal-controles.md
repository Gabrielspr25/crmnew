# Asana: controles dentro del checklist

Publicado el 8 de octubre de 2026. Modal ampliada a 960 px máximos, adaptable al ancho disponible. Incluye prioridad manual, calendario para agendar llamada, hora y motivo opcionales, fecha confirmada y + Nueva nota con el editor y los adjuntos existentes.

Validación: 13 pruebas dirigidas aprobadas y sintaxis del artefacto exacto. Revisión detectó pérdida de adjuntos al refrescar la lista; corregida con prueba de conservación e hidratación mientras la modal permanece abierta.

Producción: respaldo frontend y pg_dump restaurable en /home/gabriel/backups/asana-modal-controles-20261008. Publicación estática sin reiniciar backend. SHA256 local, servidor y HTML público: 43d89674fd7f3b13071a4f5208c16cd8f2ac9ea9e8f9ed5685e0cfd35cb00548.

Chrome autenticado: Samary muestra cinco líneas, prioridad Alta, calendario y notas reales. Fecha vacía rechazada antes de guardar. + Nueva nota enfoca asanaLogBody y muestra Adjuntar. Captura: output/asana-modal-controls/modal-publicada.png. No se crearon llamadas ni notas de prueba en producción. No cambian elegibilidad, contratos ni schema.

Entrega focal en codex/asana-cuotas-vacias-checklist-20261008; se conservaron cambios locales ajenos.
