# Admin Ofertas: fuentes comerciales unicas

## Objetivo

Reemplazar los flujos separados de Admin Ofertas por una unica superficie llamada **Fuentes comerciales**. Cada fuente oficial publicada debe alimentar una seccion definida del Portal de Ofertas.

## Alcance

Los modulos son: lista de equipos, planes fijos, planes moviles, inalambrico/IoT, Claro TV, servicios, ofertas/promociones y directorio de fijo.

Admin conservara solo Fuentes comerciales. No habra pestañas, botones, cargas, editores ni publicaciones separadas para esos modulos.

## Flujo comun

1. Elegir el modulo.
2. Subir el documento oficial.
3. Archivar original con nombre, fecha, hash y vigencia detectada.
4. Validar formato y comparar contra la publicacion vigente del mismo modulo.
5. Si el formato y los datos requeridos son validos, reemplazar automaticamente solo ese modulo; si fallan, no reemplazar nada y informar el error.
6. Registrar fuente, hash, resultado y cambios aplicados.
7. Servir el contenido publicado desde una API nueva y verificar su pagina del portal.

Una fuente invalida o no disponible no puede producir datos inventados ni alterar la publicacion vigente.

## Datos y documentos

Los documentos comerciales ya archivados permanecen como fuentes. Se eliminan los flujos heredados de Admin y sus datos de publicacion heredados se reemplazaran progresivamente con versiones generadas por Fuentes comerciales.

Cada publicacion conserva: modulo, fuente o fuentes, SHA-256, vigencia, fecha de publicacion y snapshot normalizado.

## APIs y portal

Se retiraran las APIs heredadas que alimentan cada flujo antiguo. El portal puede quedar temporalmente sin contenido de un modulo mientras se reconstruye su API nueva. Cuando una fuente sea publicada, su API devuelve solo la version vigente de ese modulo.

## Controles

- Una sola fuente de lectura por modulo para Admin y Portal.
- Validacion y comparacion obligatorias antes de cualquier reemplazo automatico.
- Reemplazo trazable y reversible solo mediante una nueva fuente valida.
- Pruebas de carga valida, fuente no disponible, comparacion, publicacion y pagina publica.
- Verificacion de que ningun boton o ruta heredada siga visible en Admin Ofertas.

## Entregas en orden

1. Crear el modelo comun de fuentes/versiones y las APIs de lectura/publicacion.
2. Reemplazar Admin Ofertas por Fuentes comerciales modular.
3. Adaptar Portal de Ofertas modulo por modulo a las APIs nuevas.
4. Retirar rutas y componentes heredados despues de probar cada reemplazo.

## Decisiones confirmadas

- Se elimina por completo la interfaz y logica anterior de Admin Ofertas.
- El portal puede quedar temporalmente sin una seccion mientras se reconstruye.
- No se presentan promociones como condiciones permanentes.
- Los documentos oficiales existentes no se eliminan como parte de la limpieza de interfaz.

## Regla operativa: Lista de Equipos

Lista de Equipos acepta exclusivamente Excel oficial (`.xlsx` o `.xls`) desde Fuentes comerciales. La carga archiva el original y SHA-256; luego reconoce el formato de lista mediante codigos de item y pestaÃ±as compatibles. Si no encuentra equipos o excede el limite de seguridad, responde con error y deja el catalogo publicado intacto. Si es valido, guarda una version en `equipos_uploads`, enlazada a la fuente comercial, y reemplaza la lista activa en una sola transaccion: equipos presentes se actualizan/reactivan; equipos ausentes quedan inactivos; mensualidades y precios pospago se sustituyen solo para los equipos incluidos. Admin informa el total procesado.

## Regla de corte: PDF de estructura de planes fijos

`LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf` se archiva una sola vez y se interpreta por secciones. Claro TV inicia en **Planes televisión 1 Play** e incluye **Complementos televisión 1 Play** y **Equipos y decodificadores STV / Claro TV / Televisión Internet**. El bloque termina antes de **Equipos oferta Internet**, que pertenece a Telefonía fija. **Valores agregados** pertenece a Planes fijos, no a Claro TV.

Cada salida conserva página y encabezado del bloque. La falta de una sección en una versión nueva no autoriza a sustituirla con datos de otra sección.
