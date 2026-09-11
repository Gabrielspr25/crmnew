# Validacion local DB - Motor Comercial a Constructor v1

Fecha local: 2026-08-30

## Alcance autorizado

Validacion local contra una base PostgreSQL equivalente al esquema real:

`Migracion -> Persistencia -> Versionado -> Publicacion -> Lectura de consumidor -> Constructor en simulacion`

Limites respetados:

- No se desplego produccion.
- No se ejecutaron migraciones productivas.
- No se activo `autoaplica`.
- No se sustituyo la logica anterior del Constructor.
- No se modificaron datos comerciales publicados.
- No se modificaron proyectos externos al flujo comercial de `newcrm`.
- No se avanzo a activacion productiva.

## Base/esquema utilizado

Base local configurada por el backend:

- Host local: `localhost:5432`
- Base: `crm_pro`
- Schema operativo: `public`
- Validacion ejecutada dentro de una transaccion `BEGIN` con `ROLLBACK` final.

La prueba uso un adaptador transaccional con savepoints para que las funciones de servicio pudieran abrir y cerrar sus propias transacciones sin confirmar cambios permanentes en la base local.

## Migraciones ejecutadas localmente

Migracion aplicada dentro de la transaccion local:

- `backend/migrations/2026-08-29-motor-comercial-reglas-compuestas.sql`

Tablas validadas dentro de la transaccion:

- `public.motor_comercial_reglas_versiones`
- `public.motor_comercial_reglas_fuentes`
- `public.motor_comercial_reglas_compuestas`
- `public.motor_comercial_reglas_terminos`
- `public.motor_comercial_reglas_historial`

Despues del `ROLLBACK`, se verifico que la base local no conservara tablas `motor_comercial_reglas_%`.

## Evidencia antes/despues

Antes de aplicar migracion en la transaccion:

- No se exigio crear una base nueva porque el usuario local no tiene permiso `CREATE DATABASE`.
- Se uso la base local equivalente `crm_pro`.
- Se tomo estado de tablas operativas existentes (`public.clients`, `public.planes_modulos`) cuando estaban presentes.

Despues de aplicar migracion en la transaccion:

- Las 5 tablas del Motor Comercial existen dentro de la transaccion.
- Los conteos de tablas operativas revisadas se mantienen iguales antes/despues.
- La migracion no rompe relaciones existentes validadas por la prueba.

Despues del rollback:

- Consulta local: `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'motor_comercial_reglas_%'`
- Resultado: `0`

## Version publicada

Flujo validado:

1. Se persistio una primera version `aprobada`.
2. Se publico como `vigente`.
3. Se persistio una version `validada` y se comprobo que no se puede publicar.
4. Se intento persistir una regla `requiere_revision` y se rechazo.
5. Se persistio una segunda version `aprobada`.
6. Se forzo una falla durante publicacion para validar rollback.
7. Se publico correctamente la segunda version.
8. La primera version paso a `reemplazada`.
9. La segunda version quedo como unica `vigente`.

## Reglas recuperadas

Lectura de consumidor validada con:

- `readCurrentPublishedCompositeRules`
- Endpoint que envuelve esa lectura:
  - `GET /api/fuentes-comerciales/planes-fijos/reglas-compuestas-publicadas/vigente`

La lectura recupero solo reglas:

- `estado_confianza = confirmado`
- `estado_publicacion = vigente`
- `autoaplica = false`
- `accion_version <> vence`
- version unica vigente

Reglas usadas en la version final de prueba:

- `fijo_benefits|bono_streaming|fijo`
- `fijo_benefits|bono_portabilidad|movil`
- `fijo_benefits|pago_penalidad|fijo`

Cada regla conserva terminos vinculados y fuente oficial versionada.

## Prueba de reemplazo de version

La publicacion de la segunda version comprobo:

- version anterior identificada;
- version anterior marcada como `reemplazada`;
- reglas anteriores marcadas como `reemplazada`;
- nueva version marcada como `vigente`;
- reglas nuevas marcadas como `vigente`;
- lectura posterior limitada a la nueva version.

## Prueba de rollback

Se inyecto una falla despues de iniciar el reemplazo de version y antes de registrar historial de publicacion.

Estado validado despues del error:

- primera version continuo `vigente`;
- segunda version continuo `aprobada`;
- no quedaron estados parciales;
- la publicacion pudo repetirse correctamente despues del fallo.

## Trazabilidad regla -> version -> fuente

La prueba valido que cada regla leida por consumidor conserve:

- id de version vigente;
- identidad comercial estable;
- contrato JSONB;
- terminos vinculados;
- fuente oficial dentro del contrato;
- nombre original del PDF oficial:
  - `2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf`

## Constructor en simulacion

La lectura vigente se paso al evaluador del Constructor:

- `ConstructorPublications.evaluateCommercialRulesSimulation`

Contexto usado:

```json
{
  "cliente": {
    "convergente": true,
    "ban": "BAN-001"
  },
  "lineas": [
    {
      "linea": 1,
      "evento": "portabilidad",
      "producto": "movil",
      "plan_monto": 65
    }
  ],
  "productos": ["movil", "fijo"]
}
```

Resultado validado:

- reglas recibidas por Constructor iguales a reglas publicadas leidas;
- recomendacion en modo `simulacion`;
- al menos una regla elegible;
- todas las reglas elegibles conservan `autoaplica = false`.

## Pruebas automatizadas

Archivo agregado:

- `backend/test/motor-comercial-local-db-validation.test.js`

Cobertura incluida:

- migracion contra base local equivalente;
- persistencia de reglas compuestas;
- publicacion inicial;
- publicacion de segunda version;
- reemplazo de version vigente;
- rollback ante error durante publicacion;
- exclusion de regla no confirmada;
- exclusion de version no aprobada;
- trazabilidad regla -> version -> fuente;
- lectura de consumidor;
- lectura desde Constructor en simulacion.

Resultado:

- `node --test backend/test/motor-comercial-local-db-validation.test.js`
  - 1 prueba, 1 pass, 0 fail.

## Incompatibilidades encontradas con el esquema actual

- El usuario local de PostgreSQL no tiene permiso `CREATE DATABASE`; por eso la validacion uso transaccion aislada sobre `crm_pro`.
- No se detectaron incompatibilidades de la migracion con el esquema local actual dentro de la transaccion.
- La migracion local crea objetos en `public`, por lo que para pruebas aisladas se requiere transaccion con rollback o una base temporal creada por un usuario con permisos suficientes.

## Riesgos pendientes

- Esta validacion no autoriza ejecucion de migraciones productivas.
- Antes de produccion se requiere backup, ventana de migracion, usuario con permisos revisados y autorizacion explicita.
- La lectura HTTP completa del endpoint en entorno productivo sigue pendiente de validacion despues de migrar local/produccion autorizada.
- El Constructor sigue en modo simulacion; no debe aplicar beneficios automaticamente.
- Falta decision directiva para activacion productiva del Motor Comercial.

## Estado para decision

La validacion local contra base equivalente queda lista: migracion, persistencia, versionado, publicacion, rollback, lectura de consumidor y simulacion del Constructor fueron comprobados sin dejar cambios permanentes.
