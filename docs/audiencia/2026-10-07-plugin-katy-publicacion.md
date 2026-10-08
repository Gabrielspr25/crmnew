# Conexión privada de Katy — 7 de octubre de 2026

## Publicado y comprobado

- Gateway MCP y API de seguimiento montados en el proceso existente de newcrm; reutilizan el store de Audiencia sin abrir una segunda cola de escrituras.
- HTTPS: https://crmp.ss-group.cloud/mcp.
- OAuth: registro dinámico, consentimiento del propietario con sesión CRM vigente, códigos de un solo uso, PKCE S256, tokens independientes y permisos tracking:read / tracking:write.
- Respaldo validado de BD, servidor y registro Audiencia antes de publicar. Sin migraciones ni backfill.
- Diez pruebas de API/autorización/propietario y siete de OAuth/transporte/gateway aprobadas. Flujo HTTP completo probado con datos aislados.
- Salud pública 200. MCP anónimo 401 y metadatos OAuth correctos. ChatGPT detectó los endpoints y permisos del servidor.
- Complemento «Seguimiento newcrm para Katy» creado e instalado en la cuenta de Gabriel. La UI muestra una cuenta conectada y cinco herramientas: tres de lectura, dos de escritura.
- Corrección durante integración: callback real de ChatGPT usa /connector/oauth/{identificador}. La validación inicial esperaba otra terminación; se agregó prueba que reprodujo el rechazo y se publicó la corrección.

## Prueba del dot

Gabriel autorizó enviar la prueba de lectura a Katy. Mensaje enviado en su chat existente y leído. Katy devolvió revisión 14, seis proyectos con sus nombres, 151 ramas de newcrm y un próximo paso real de la corrección de búsqueda de teléfono. El conteo y revisión coinciden con la lectura independiente del servidor. Lectura productiva real del dot comprobada; no se hizo escritura productiva de prueba.

Contraste independiente por lectura del archivo productivo: revisión 14, seis proyectos, 151 ramas de newcrm. No se modificó el registro para esta comprobación.

## Alcance y continuidad

Puede consultar proyectos y ramas, actualizar descripción/próximo paso/fecha/estado del trabajo y guardar una nota vinculada con revisión e historial. No expone clientes, ofertas ni reglas comerciales. La prueba inicial de lectura no limita los permisos de escritura ya consentidos.

Estado OAuth efímero: reiniciar el backend revoca la conexión y requiere reconectar. Tokens de una hora, renovación hasta un día. No se almacena el JWT personal en ChatGPT. Los permisos normales de ChatGPT para operaciones de escritura se conservan.

## Corrección de lectura de notas y reconexión

Katy guardó por orden directa de Gabriel «prueba de conexión completada» en «Verificar Consulta y coordinación de Katy»; producción pasó a revisión 15. La lectura independiente confirmó una sola nota vinculada. El detalle de rama omitía tracking.decisions, por lo que Katy no podía releerla. Se reprodujo en una prueba fallida y GET /nodes/:id ahora devuelve notes filtradas por nodeId. La prueba API comprueba aislamiento entre trabajos y lectura sin escrituras; el flujo MCP OAuth comprueba el texto devuelto.

El reinicio reveló que el registro DCR también era efímero: reconectar devolvía invalid_client. Se agregó persistencia atómica exclusiva de metadatos públicos del cliente en katy-oauth-clients.json privado (600), sin códigos, tokens ni sesiones CRM. Se recuperó la identificación y callback del complemento existente, observados en su solicitud real, conservando permisos y consentimiento del propietario. La prueba de reinicio conserva el cliente incluso después de dos días y rechaza accesos inexistentes.

Once pruebas de backend y ocho de plugin pasan. Publicación focal respaldada en /home/gabriel/backups/katy-notas-20261007 (incluye BD y Audiencia). Sin migraciones ni cambios adicionales a trabajos/notas. Reconexión realizada en ChatGPT con la misma cuenta y mismos scopes; aviso visible «Primary ya está conectada». Se envió a Katy únicamente la relectura de la nota existente, sin duplicarla. Katy confirmó el texto «prueba de conexión completada» y revisión 15, sin agregar notas ni modificar datos. Captura: output/katy-plugin/katy-nota-verificada.png. Lectura independiente productiva posterior coincide con revisión 15 y una sola nota.

Reversa: restaurar /home/gabriel/backups/katy-plugin-20261007/server.js a backend/src/server.js y reiniciar ventaspro-nuevo. Los datos de Audiencia se conservan. No restaurar datos salvo incidente comprobado y autorización específica.
