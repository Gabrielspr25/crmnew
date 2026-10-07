# Adjuntos en notas de Asana — publicación verificada

Gabriel aprobó diseño, pruebas, migración con respaldo y deploy. Superficie:
CRM PYMES > Asana > Seguimiento > Gestión rápida > Nota.

## Resultado

Selector múltiple y pegado de capturas, lista pendiente removible, nota de texto
o solo archivos, miniaturas, apertura y descarga autenticada. JPG/JPEG, PNG,
WebP, PDF, DOC/DOCX y XLS/XLSX; cinco archivos de diez MB por nota.

Tabla nueva `public.opportunity_note_attachments`, propiedad de `crm_user`, con
FK a notas/seguimientos y metadatos. Archivos privados en
`backend/uploads/asana-notes`, sin exposición estática y con nombre UUID.
No se modificaron contratos, suscriptores, oportunidades ni referidos.

## Pruebas

- 29 pruebas backend dirigidas aprobadas, incluyendo HTTP sobre PostgreSQL
  aislado: permisos, límite exacto de cinco, rechazo de seis y de más de diez MB,
  contenido inválido, nota sin texto, descarga, borrado lógico y rollback.
- Navegador aislado: PNG real, PDF, DOCX y XLSX desde selector, pegado, apertura,
  descarga y recarga; anchos 390, 768, 1280 y 1440, cero errores JavaScript.
- Revisión independiente: sin bloqueos; se conservó la consulta anterior del
  seguimiento mientras los archivos requieren permisos del propietario/admin.
- Prueba productiva mediante selector real del navegador: se guardó una captura
  real de CAS como evidencia técnica; 201, miniatura, vista previa, descarga con
  hash idéntico y persistencia después de recarga.
- Acceso público sin sesión: 401; vendedor ajeno: 403. CAS conserva sus cuatro
  oportunidades. Se archivaron cuatro evidencias técnicas repetidas generadas
  durante la comprobación; queda una visible, sin tocar notas comerciales.

La comprobación inicial esperaba el cuerpo de la respuesta de carga aunque el
servidor ya había guardado correctamente. Se consume explícitamente el JSON
antes de recargar. También se corrigió el límite multipart para aceptar los
cinco archivos completos más el texto; regresión aprobada.

## Publicación

Respaldo validado de BD y archivos en
`/home/gabriel/backups/asana-adjuntos-20261007`. Migración autorizada aplicada;
solo router/servicio de adjuntos, integración focalizada de Asana y frontend
publicados desde la base productiva. PM2 reiniciado. Nginx ya admite 100 MB y
no requirió cambios. Eliminar una nota conserva el historial y oculta archivos.

Evidencia: `output/asana-attachments/public-proof.json`, `public-1440.png`,
`public-390.png`, `public-imagen.png` y `public-download.png`.

Pendiente del encargo: ninguno. Uso: recargar Asana, abrir el seguimiento,
seleccionar Nota y pulsar Adjuntar o pegar una captura.
