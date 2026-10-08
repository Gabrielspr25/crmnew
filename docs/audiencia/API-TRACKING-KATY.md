# API de seguimiento para plugin de Katy

## Estado comprobado — 7 de octubre de 2026

API y transporte MCP publicados en el servidor del CRM. Endpoint HTTPS /mcp; API /api/tracking/v1. Se comparten el mismo proceso y store de Audiencia para conservar serialización de escrituras. El servidor usa OAuth con consentimiento del propietario, códigos de un solo uso, PKCE S256, permisos acotados y revocación. ChatGPT detectó emisor, recurso, endpoints, registro dinámico y permisos en su formulario real. Complemento privado creado e instalado en ChatGPT: Seguimiento newcrm para Katy. Cuenta de Gabriel conectada y cinco herramientas descubiertas (tres de lectura y dos de escritura). Katy ejecutó la consulta real: revisión 14, seis proyectos y 151 ramas de newcrm, coincidentes con comprobación independiente productiva.

Audiencia permanece intacta en producción: su retirada fue cancelada antes de publicar. El panel-personal separado no se modificó.

## Contrato de versión 1

Base propuesta al montar: /api/tracking/v1.

| Método y ruta | Permiso | Operación |
|---|---|---|
| GET /projects | tracking:read | Proyectos y revisión |
| GET /nodes?project=newcrm | tracking:read | Ramas de seguimiento filtradas |
| GET /nodes/:id | tracking:read | Rama, notas vinculadas y revisión |
| PATCH /nodes/:id | tracking:write | Actualizar campos permitidos de una rama |
| POST /nodes/:id/notes | tracking:write | Registrar nota/decisión vinculada |

Actualización publicada el 2026-10-08: GET /projects y GET /nodes/:id incluyen
`business_rules`, con versión, fecha de aprobación y reglas del resumen
`docs/audiencia/reglas-negocio.json`. Audiencia > newcrm > Reglas del negocio
consulta esa misma fuente. No es una nota ni modifica el seguimiento privado;
PUT /data ignora business_rules recibidas del navegador. No agrega herramientas
ni amplía scopes. Tras el reinicio se reconectó la cuenta existente y se comprobó
la lectura real del complemento: revisión 16 y regla de cuotas móviles vacías.

PATCH recibe revision y changes. Campos permitidos: description, status, fulfillment, verification, assignee, role, nextStep, deadline, reviewedAt, requirements, missing, corrections, improvements, steps, evidence y workState. No altera id, project, parentId, kind ni history. El validador existente comprueba estados, responsables, fechas y evidencia; no basta pedir publicado_verificado para acreditar una publicación.

POST notes recibe revision y text, hasta 5.000 caracteres. La fecha se genera en el servidor; el autor procede del autorizador. La nota se almacena en tracking.decisions y queda auditada, sin reemplazar notas ni historial.

GET /nodes/:id devuelve notes filtradas por nodeId de la rama solicitada. Esto permite a Katy releer una nota después de guardarla sin recibir notas de otros trabajos. La consulta no altera datos ni revisión. El registro de clientes OAuth se conserva en el archivo privado katy-oauth-clients.json, con escritura atómica y permisos 600; solo contiene metadatos del cliente, nunca tokens. Los códigos y accesos siguen siendo efímeros y un reinicio exige reconexión, conservando el registro del complemento.

Cada escritura conserva todo el resto de Audiencia, exige revisión entera no negativa, comprueba conflicto y reutiliza store.write con autor. Cache-Control no-store. Respuestas 400 petición inválida, 401 sin autenticación, 403 sin scope, 404 rama inexistente, 409 revisión obsoleta; errores internos sin detalles privados.

## Autenticación y conexión

La fábrica requiere un autorizador real en cada petición, que devuelva identidad y scopes de integración. No acepta una identidad enviada en el cuerpo ni fabrica una sesión CRM del propietario. Los tokens reader/writer de los tests existen solo dentro de la fixture y nunca se publican.

El gateway está en plugins/katy-tracking/src/gateway.mjs. Reutiliza la sesión vigente del propietario exclusivamente para consentir en el origen CRM; ChatGPT recibe un token independiente de integración, nunca el JWT personal. Las escrituras se atribuyen a Katy con el propietario que autorizó. Los tokens duran una hora y la renovación un día. El estado OAuth es efímero: un reinicio revoca accesos y exige reconectar. Solo se admiten callbacks HTTPS de ChatGPT con formato /connector/oauth/{identificador}; comprobar la URL real durante el registro.

Validación local: once pruebas de API/identidad/propietario y ocho de transporte, descubrimiento, OAuth y gateway, incluyendo el flujo HTTP completo de autorización, consentimiento, canje y consulta MCP. Producción: salud 200, MCP anónimo 401 con desafío OAuth y metadatos públicos correctos. Respaldo validado de BD, server.js y Audiencia: /home/gabriel/backups/katy-plugin-20261007. Reversa: restaurar server.js del respaldo y reiniciar ventaspro-nuevo; conservar archivos y datos existentes. No se ejecutaron migraciones ni se cambiaron registros de Audiencia para estas pruebas.

Creación, consentimiento y mensaje de prueba confirmados por Gabriel y ejecutados. Instalación, cuenta conectada y consulta productiva real del dot verificadas. Escritura productiva ejercitada por Gabriel mediante Katy: nota guardada y releída en revisión 15; no duplicada. Registro DCR persistente y cuenta reconectada comprobados. Detalle: 2026-10-07-plugin-katy-publicacion.md.

Fuentes oficiales consultadas: [Construir servidor MCP](https://developers.openai.com/plugins/build/mcp-server) y [Empaquetar plugin](https://developers.openai.com/plugins/build/plugins). El transporte MCP expone herramientas y el paquete las registra; la autenticación de usuario debe completarse por el mecanismo soportado del cliente.
