# Asana: referido libre y asignación desde Vendedor

Diseño y desarrollo autorizados por Gabriel: cualquier persona puede ser el referente; mostrar «Referido por» debajo del vendedor, editar ambos desde la etiqueta de la misma fila. No ocupar espacio si no hay referido.

Estado: publicado y comprobado en producción el 7 de octubre de 2026, tras autorización expresa de Gabriel para migración, publicación y reinicio.

Campo nuevo revisable: `public.sales_opportunities.referred_by_name varchar(200)`, nullable, sin backfill. Migración `backend/migrations/2026-10-07-asana-referidos.sql`. El texto se normaliza y valida; vacío lo limpia. El referido pertenece a la oportunidad. Las asignaciones se sincronizan con Cliente y todas sus oportunidades activas, siguiendo el comportamiento existente de edición de Cliente.

La etiqueta del vendedor abre un editor compacto. Administración/supervisor elige vendedor y referente; un vendedor edita solo el referente de su oportunidad. El editor conserva la asignación si no la cambió; detecta conflictos por edición simultánea en lugar de sobrescribirlos. La tabla conserva 13 columnas y los anchos responsive aprobados. La búsqueda encuentra también el nombre del referente. La salida se escapa como texto.

Servicio `backend/src/services/asanaReferral.js`: validación, permisos, vendedor existente, bloqueo Cliente antes de oportunidad, cambios atómicos y nota de historial con actor. La oportunidad editada queda como la más recientemente actualizada para evitar que la agrupación muestre otra oportunidad sin el referido. Ruta autenticada `PATCH /api/asana-real/:id/referral`; lista/detalle exponen referido y vendedor ID. La ruta local invalida su caché después del commit.

Pruebas realizadas:

- 14 pruebas unitarias/contratos dirigidos aprobadas, incluyendo permisos, texto libre, límites, error sin escrituras, asignación y conflictos.
- HTTP con PostgreSQL aislado en `127.0.0.1:55437/asana_referral_test`: migración, autenticación, referido propio/ajeno, recarga, vendedor válido/inexistente, limpieza del campo, auditoría y rollback inducido. Dos reasignaciones concurrentes de oportunidades del mismo Cliente devuelven 200 y 409, sin bloqueos mutuos ni incoherencia.
- El ciclo HTTP pasó con la ruta local y con el artefacto preparado sobre producción.
- Navegador + PostgreSQL aislado con ese artefacto: editor, guardar vendedor y referido, recargar, buscar, validación, conflicto visible conservando datos, salida HTML escapada y limpieza opcional. Pantallas de 390, 768, 1280, 1440, 1600 y 1920 px; 13 columnas, tabla cabe desde 1440 px, modal dentro del viewport, cero errores de página.
- Sintaxis frontend y backend y diff de espacios comprobados; revisión de código independiente sin hallazgos relevantes pendientes.

Evidencia con datos explícitos de prueba: `output/asana-referidos/editor-local.png` y `local-*.png`. La prueba usa agenda/alertas vacías solo como soporte de pantalla; listados y guardados de referidos usan consultas reales de las rutas y BD aislada.

Preparación de publicación: `output/asana-referidos/app.html` y `asanaReal.js`, generados exclusivamente sobre los archivos productivos descargados, porque la ruta local contiene trabajo ajeno y difiere de producción. Servicio y migración se deben publicar junto a estos artefactos. Bases: frontend SHA-256 `fae7e516018f263ad28a4c92d499741f8cc2f4564a94569b3690c8d8431fd9b1`; ruta productiva `f6f00ebeecc65a09ed21a471ffc89f9972e945be2a366ba1809cb9aa2faee422`.

Publicación: backup de frontend, ruta y BD en `/home/gabriel/backups/asana-referidos-20261007` (dump 4.6 MB comprobado con pg_restore). Migración ejecutada con ON_ERROR_STOP y confirmada; servicio/ruta/frontend publicados desde los artefactos preparados; backend `ventaspro-nuevo` reiniciado en PM2 y salud `ok: true`.

Al revisar la captura productiva, se ajustó el editor a un campo por fila para aprovechar sus 440 px; se repitió el ciclo local PostgreSQL/navegador antes de publicar esa corrección estática. Hash final frontend `d54f6d8ead71b79c4ac998714d7474237ffaec7cf75a156b7cd325df8a176964`; ruta `a201f96ba8816ae3564caff6ad9d15bcb1ab7c90d8972022f6d757edf4c5a409`; servicio `55f7c0caff680e73898463def3d75596d9700dc4a08f66f97723d2d013a36e96`.

Prueba autenticada pública: lista HTTP 200 con 41 seguimientos y los campos nuevos; editor abre con vendedor/referido vigentes; Guardar sin cambios HTTP 200 y recarga correcta. Comparación de snapshots BD de la oportunidad y Cliente: vendedor, referido, fechas e historial idénticos antes/después. No se inventó un referido ni se reasignó un cliente para probar en producción. El ciclo de cambio efectivo fue demostrado previamente con PostgreSQL aislado. Las seis medidas públicas conservaron 13 columnas, y la tabla cabe desde 1440 px; campos del editor con al menos 240 px útiles; cero errores de página. Evidencia `public-proof.json`, `public-editor-1440.png` y `public-*.png`. La respuesta Chrome añade una línea de beacon de Cloudflare; quitando únicamente esa línea, el HTML coincide con el hash del artefacto publicado. Sesión técnica y archivos temporales retirados.

Pendientes del encargo: ninguno. Próximo paso recomendado: recargar Asana > Clientes y pulsar la etiqueta del vendedor para registrar el referente real.

Ajuste posterior solicitado por Gabriel: «Referido por» en verde, usando `var(--sc-green)` del tema. Se cambió exclusivamente esa declaración CSS; frontend anterior y dump adicional respaldados en la misma carpeta (`app-before-green.html`, `crm-before-green.dump`). Archivo público SHA-256 `65f025741363830a3348c18e2640e4e73cd30e29e892c15957e1bb10bd826425`. Prueba de color computado con el CSS descargado de producción: modo suave `rgb(162, 232, 121)` y día `rgb(63, 143, 30)`. No se modificaron datos ni lógica ni se reinició el backend para este ajuste estático.
