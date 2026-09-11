# Constructor v1 - validacion integrada local contra backend y PostgreSQL real

Fecha: 2026-08-30  
Proyecto comercial activo: `newcrm`  
Entorno: local, PostgreSQL `crm_pro` en `::1:5432`, backend `http://localhost:4000`  
Alcance: lectura/simulacion local. Sin produccion, sin migraciones productivas y `autoaplica=false`.

## 1. Causa del faltante `public.ofertas_movil_versiones`

La tabla faltaba porque la base local `crm_pro` no tenia aplicadas todas las migraciones del repositorio. La migracion existente `backend/migrations/2026-08-05-ofertas-movil-versiones.sql` ya definia la tabla; no era necesario inventar una tabla nueva ni alterar el contrato. El mismo patron estaba documentado previamente: la base local es una foto incompleta y no existe tracking de migraciones aplicado.

Correccion aplicada solo localmente: ejecutar migraciones existentes contra `crm_pro` local y publicar datos desde fuentes oficiales archivadas.

## 2. Migraciones locales aplicadas

- `backend/migrations/2026-08-01-fuentes-comerciales.sql`
- `backend/migrations/2026-08-05-ofertas-movil-versiones.sql`
- `backend/migrations/2026-08-16-bases-informativas-publicaciones.sql`
- `backend/migrations/2026-08-29-motor-comercial-reglas-compuestas.sql`

No se ejecuto ninguna migracion productiva.

## 3. Evidencia de base local

Archivo: `tmp/constructor-v1-real-local/evidencia-db-summary-real-local.json`

- Base: `crm_pro`
- Host: `::1`
- Puerto: `5432`
- Tablas presentes:
  - `public.ofertas_movil_versiones`
  - `public.fuentes_comerciales`
  - `public.bases_informativas_publicaciones`
  - `public.motor_comercial_reglas_versiones`
  - `public.motor_comercial_reglas_compuestas`
- Motor Comercial vigente:
  - version `1dcf4dd1-16c6-41b7-a0f2-8dcad94411fd`
  - numero `1`
  - dominio `fijo_benefits`
  - estado `vigente`
  - reglas `9`
  - `autoaplica_false=true`
- Ofertas moviles vigentes:
  - version `220094ac-8bd3-400c-8378-44ab75e4202e`
  - numero `1`
  - ofertas `9`
- Modulos publicados:
  - `moviles`: 2 modulos
  - `fijos`: 9 modulos
  - `claro_tv`: 3 modulos

## 4. Fuentes oficiales usadas

- Benefits / Claro Full PYMES V.16:
  - `documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf`
  - SHA256 `e50a2fb7f1d40e45acb93ca312b44ed8efd67cf556796c44f529723938c4c9eb`
  - vigencia desde `2026-07-23`
- Ofertas moviles:
  - `documentos-ofertas/movil/ofertas-financiamiento/2026-07-25--Tabla-Ofertas-Financiamiento-23al29julio-2026-CORPORATIVO.xlsx`
  - `documentos-ofertas/equipos/listas-precios/2026-07-25--Lista-de-Precios-28mayo-31julio-2026-PYM-CORP.xlsx`
- Business Red:
  - `documentos-ofertas/movil/planes-multilinea/2026-07-25--Boletin-Nuevos-Planes-Multilineas-Business-Red-PYMES-SUB-240802-rv.pdf`
- Planes fijos / Claro TV:
  - `documentos-ofertas/fijo/estructura-planes/2026-07-25--LISTADO-ESTRUCTURA-PLANES-PYMESNEGOCIOS-TODOS-2026-15-260330.pdf`

## 5. API real validada

Backend local real iniciado con `npm run start` en puerto `4000`.

Endpoints verificados:

- `GET /api/health`: `ok=true`
- `GET /api/fuentes-comerciales/planes-fijos/reglas-compuestas-publicadas/vigente`: 9 reglas, version vigente
- `GET /api/ofertas-movil/vigente`: 9 ofertas vigentes
- `GET /api/equipos-lista`: 453 equipos activos disponibles para el Constructor
- `GET /api/planes-modulos/moviles`: publicacion movil presente, 2 modulos
- `GET /api/planes-modulos/fijos`: publicacion fijo presente, 9 modulos
- `GET /api/planes-modulos/claro_tv`: publicacion Claro TV presente, 3 modulos

## 6. Constructor v1 contra API real

Archivo: `tmp/constructor-v1-real-local/evidencia-constructor-real-local.json`  
Reporte visual local: `tmp/constructor-v1-real-local/evidencia-constructor-real-local.html`

Resultado del cargador del Constructor:

- `constructor_ready=true`
- API real sin mock: `true`
- reglas recibidas desde Motor Comercial: `9`
- ofertas moviles publicadas: `9`
- ofertas moviles con equipo reconciliado: `8`
- equipos publicados disponibles: `453`
- planes individuales: `4`
- planes multilinea: `4`
- grupos fijos: `9`
- grupos Claro TV: `3`
- `autoaplica_false=true`

Ejemplo real usado por la validacion:

- Plan movil: `Plan individual $35`, precio `$35.00`
- Equipo: `MOTOROLA MOTO G PLAY 2024`, precio `$129.99`, mensualidad simulada a 30 meses `$4.33`
- Fuente de reglas: Benefits Claro Full PYMES V.16, pagina 3, version vigente `1dcf4dd1-16c6-41b7-a0f2-8dcad94411fd`

## 7. Casos ejecutados

| Caso | Aplicadas | Descartadas | Total estimado | Bloqueada |
|---|---:|---:|---:|---|
| convergente | 6 | 3 | `$41.67` | no |
| no convergente | 0 | 9 | `$50.00` | si |
| portabilidad | 5 | 4 | `$50.00` | no |
| renovacion | 6 | 3 | `$101.11` | no |
| beneficio incompatible | 5 | 4 | `$50.00` | no |
| beneficio acumulable | 3 | 6 | `$99.99` | no |
| regla no determinada/bloqueada | 5 | 5 | `$50.00` | si |

La prueba negativa `regla_no_determinada_bloqueada` inyecta una regla local incompleta para confirmar que el Constructor la descarta con motivo `dato_no_determinado`; no se publica esa regla ni se agrega a la base comercial.

## 8. Errores encontrados y corregidos

- `public.ofertas_movil_versiones` no existia en `crm_pro` local.
  - Causa: migracion existente no aplicada en la base local.
  - Correccion: aplicar migracion local existente.
- El Constructor seguia sin quedar listo aunque habia modulos en `planes_modulos`.
  - Causa: faltaba metadata publicada en `bases_informativas_publicaciones`; el loader rechaza modulos sin publicacion.
  - Correccion: aplicar migracion local existente y registrar publicaciones locales con `public.publicar_base_informativa`.
- Script local `publish-official-base-data.mjs` tenia un import invalido y una variable mal nombrada.
  - Correccion: ajustes tecnicos locales.
- El script intentaba usar fallback manual para Business Red.
  - Correccion: removido; solo se aceptan filas extraidas desde el parser del PDF oficial.
- La prueba `motor-comercial-local-db-validation.test.js` usaba el dominio real `fijo_benefits` y se mezclaba con reglas publicadas reales.
  - Correccion: dominio aislado `local_db_validation` dentro de transaccion rollback.

## 9. Capturas/evidencia visual

Se intento generar captura PNG con Chrome headless desde `http://localhost:4000/constructor/oferta-const.html`, pero Chrome fallo antes de renderizar por error fatal de GPU en Windows (`GPU process isn't usable`). No se creo PNG valido.

Evidencia visual alternativa generada y abierta en Codex:

- `tmp/constructor-v1-real-local/evidencia-constructor-real-local.html`

Ese HTML renderiza los siete casos con los datos leidos desde API real y el evaluador real del Constructor.

## 10. Pruebas ejecutadas

- `node tmp\constructor-v1-real-local\publish-real-fijo-benefits.mjs`: OK
- `node tmp\constructor-v1-real-local\publish-official-base-data.mjs`: OK
- `node tmp\constructor-v1-real-local\publish-base-module-publications.mjs`: OK
- `node tmp\constructor-v1-real-local\validate-constructor-real-api.mjs`: OK
- `node tmp\constructor-v1-real-local\db-summary.mjs`: OK
- `node --test backend\test\constructor-motor-comercial-simulacion.test.js backend\test\constructor-publications-runtime.test.js backend\test\oferta-const-portal.test.js`: 20/20 OK
- `node --test backend\test\motor-comercial-local-db-validation.test.js backend\test\motor-comercial-reglas-compuestas-persistence.test.js backend\test\fijo-benefits-normalizer.test.js`: 21/21 OK

## 11. Archivos modificados

- `backend/test/motor-comercial-local-db-validation.test.js`
- `tmp/constructor-v1-real-local/publish-official-base-data.mjs`
- `tmp/constructor-v1-real-local/publish-base-module-publications.mjs`
- `tmp/constructor-v1-real-local/validate-constructor-real-api.mjs`
- `tmp/constructor-v1-real-local/db-summary.mjs`
- `docs/motor-ofertas/constructor-v1-validacion-integrada-real-local.md`

Archivos de evidencia generados:

- `tmp/constructor-v1-real-local/evidencia-publicacion-real-local.json`
- `tmp/constructor-v1-real-local/evidencia-base-oficial-local.json`
- `tmp/constructor-v1-real-local/evidencia-publicaciones-modulos-local.json`
- `tmp/constructor-v1-real-local/evidencia-constructor-real-local.json`
- `tmp/constructor-v1-real-local/evidencia-constructor-real-local.html`
- `tmp/constructor-v1-real-local/evidencia-db-summary-real-local.json`

## 12. Riesgos pendientes

- Las publicaciones locales se hicieron en `crm_pro` local para validacion; no prueban produccion.
- Chrome headless no pudo generar PNG por fallo GPU local. La validacion visual queda cubierta por HTML local navegable, no por captura PNG.
- La version movil usada tiene vigencia documental `2026-07-23` a `2026-07-29`; sirve para integracion local reproducible, pero no debe publicarse como verdad comercial vigente sin nueva autorizacion/fuente actual.
- La reconciliacion encontro 8 de 9 ofertas moviles con equipo; una oferta quedo sin equipo reconciliado contra lista publicada.
- Constructor sigue en simulacion: no sustituye carrito, totales ni propuesta productiva.
- `autoaplica` se mantiene en `false`.
