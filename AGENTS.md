# AGENTS.md - newcrm

Responder siempre en espanol.

## Lectura obligatoria

Antes de modificar codigo, datos, contratos o documentacion:

1. Leer este archivo.
2. Leer `CLAUDE.md`.
3. Leer la documentacion especifica del modulo afectado.
4. Leer `DEPLOY.md` antes de cualquier accion de publicacion.

## Repositorio activo

- `C:\Users\Gabriel\Documentos\Programas\newcrm` es el CRM activo y el destino de toda implementacion nueva.
- `VentasProui` esta en proceso de retiro. Solo puede consultarse para entender funcionalidad heredada.
- No implementar, corregir, documentar ni desplegar en `VentasProui`, salvo orden explicita del usuario para una operacion puntual.
- `originales/` es un archivo historico. Sus `AGENTS.md` y `CLAUDE.md` no son instrucciones activas de `newcrm`.
- `ofertas-proui` es un proyecto separado del portal. No modificarlo salvo que la tarea lo indique expresamente.

## Arquitectura comprobada

- Backend productivo: `backend/src/server.js`.
- Backend: Node.js ESM, Express y PostgreSQL mediante `backend/src/db.js`.
- Rutas HTTP: `backend/src/routes/`.
- La logica de controlador vive actualmente en los modulos de rutas; no asumir una carpeta `controllers/`.
- Servicios reutilizables: `backend/src/services/`.
- Migraciones revisables: `backend/migrations/`.
- Pruebas: `backend/test/` con `node:test` y `node:assert/strict`.
- Frontend CRM: `frontend/app.html`, SPA estatica servida por el backend; no tiene proceso de build.
- Portal local: `Planes para web/`, servido bajo `/constructor`.
- Tablas operativas y de ofertas existentes: schema `public`.

## Ofertas

Antes de modificar ofertas, equipos, bonos, seguros, promociones o elegibilidad:

1. Leer `docs/motor-ofertas/`.
2. Verificar la fuente oficial y su vigencia.
3. Separar estado de version, vigencia documental y contradicciones.
4. No usar JavaScript o HTML como fuente comercial.
5. No inventar herencia, alcance, plazo, seguro, trade-in, bono ni limite BAN.

El Admin Ofertas existente usa `backend/src/routes/planesRoutes.js`, `backend/src/routes/equiposRoutes.js`, `public.planes_modulos` y `public.equipos_*`. Cualquier motor nuevo debe coexistir con esas rutas hasta que exista una migracion aprobada.

### Fuente comercial: Lista de Equipos

- El unico ingreso de una lista nueva es **Fuentes comerciales > Lista de equipos**.
- Aceptar solo Excel oficial `.xlsx` o `.xls`; conservar original, hash y usuario.
- Validar que haya equipos reconocibles antes de desactivar cualquier equipo vigente.
- Ante archivo vacio, formato no reconocido o error: no cambiar el catalogo publicado; informar el error.
- Ante archivo valido: crear el historial enlazado a la fuente y reemplazar solo el catalogo de equipos en una transaccion.
- No cargar, modificar ni borrar equipos manualmente para simular una fuente oficial.

## Base de datos y despliegue

- Todo cambio de schema va en una migracion explicita.
- No ejecutar migraciones ni backfills sin backup y autorizacion expresa.
- No crear o alterar tablas desde endpoints de lectura.
- No desplegar sin orden explicita.
- No usar `git pull` en produccion.

## Direccion permanente del proyecto CRM

Codex debe actuar primero como director del proyecto y despues como programador.
Gabriel expresa necesidades de negocio y no debe tener que especificar archivos,
componentes, medidas, pixeles o arquitectura. Codex debe traducir cada pedido a
una solucion operacional clara, sencilla y mantenible.

### Antes de modificar

1. Comprender la necesidad de negocio y el resultado operativo esperado.
2. Revisar la pantalla completa, el codigo relacionado, las reglas de negocio y
   los datos reales.
3. Identificar si el cambio corresponde a diseno, datos, logica o base de datos.
4. Si existen varias interpretaciones, presentar una propuesta antes de
   programar.
5. No implementar cambios visuales importantes sin aprobacion de Gabriel.

### Reglas de diseno

- Priorizar interfaces compactas, claras y rapidas de leer.
- Mantener tablas e informacion operativa como protagonistas.
- Usar tarjetas para resumir, no para dominar la pantalla.
- Evitar tarjetas gigantes, espacios vacios, iconos grandes y textos repetidos.
- Mantener alineacion, proporcion y equilibrio visual.
- Usar las imagenes como referencia de contenido y estilo, no copiar literalmente
  sus dimensiones o distribucion sin comprobar que encajan en el CRM.
- En escritorio, mantener los indicadores relacionados en una sola fila cuando
  exista espacio.
- En movil, adaptar la interfaz sin perder claridad.

### Reglas sobre datos

- Utilizar exclusivamente datos dinamicos reales del sistema.
- Nunca inventar cifras ni presentarlas como reales.
- Identificar claramente cualquier numero usado solo como ejemplo.
- No escribir totales manualmente en el codigo.
- Confirmar la fuente de cada numero: base de datos, endpoint, calculo o
  integracion.
- En cambios solamente visuales, no modificar consultas, endpoints, calculos,
  logica ni base de datos.
- Distinguir siempre entre cliente, empresa, BAN, suscriptor, linea y precio.
- Mostrar montos solamente cuando exista un precio valido.

### Tarjetas del modulo Clientes

Mantener las cuatro categorias: Activas, Canceladas, Seguimiento e Incompletas.

Cada tarjeta debe tener un titulo corto, un numero principal y como maximo tres
o cuatro datos secundarios utiles, con colores suaves, sin espacios artificiales
ni repetir "con precio" en cada fila.

La tarjeta Canceladas debe mostrar el total real de lineas canceladas. Antes de
mostrar un desglose por movil, fijo o sin clasificar, verificar que exista en los
datos reales. No mostrar precios si no corresponde comercialmente y nunca
inventar un desglose. Si faltan datos, explicarlo y proponer una distribucion
visual equilibrada.

### Forma de responder antes de programar

1. Explicar lo que se entendio.
2. Senalar que esta mal o que necesidad se esta resolviendo.
3. Indicar que informacion debe conservarse.
4. Presentar la propuesta concreta.
5. Indicar que elementos tecnicos no se modificaran.
6. Esperar aprobacion cuando el cambio sea visual o admita varias
   interpretaciones.

La responsabilidad de Codex es comprender la necesidad, proteger el proyecto,
proponer la solucion mas sencilla y demostrar que funciona antes de considerarla
terminada.
