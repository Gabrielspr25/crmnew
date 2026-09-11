# Publicacion local y lectura de consumidor - Reglas compuestas Fijo + Benefits v1

Fecha local: 2026-08-29

## Alcance autorizado

Etapa local para demostrar:

`Reglas compuestas confirmadas -> version aprobada -> publicacion local atomica -> lectura desde API/servicio -> comparacion contra lo aprobado`

Limites respetados:

- No se conecto Constructor.
- No se activo `autoaplica`.
- No se desplego produccion.
- No se ejecuto ninguna migracion productiva.
- No se modificaron datos comerciales publicados.
- No se modificaron proyectos externos al flujo comercial de `newcrm`.
- No se inventaron reglas comerciales.

## Estado base

Fuente oficial:

- `documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf`

Prueba real local:

- Paginas extraidas: 35
- Reglas normalizadas: 58
- Beneficios principales: 9
- Terminos oficiales: 49
- Reglas compuestas actuales: 9
- Autoaplicables: 0

## Modelo usado

La etapa reutiliza la migracion local:

- `backend/migrations/2026-08-29-motor-comercial-reglas-compuestas.sql`

Tablas usadas:

- `public.motor_comercial_reglas_versiones`
- `public.motor_comercial_reglas_fuentes`
- `public.motor_comercial_reglas_compuestas`
- `public.motor_comercial_reglas_terminos`
- `public.motor_comercial_reglas_historial`

No se agrego una tabla separada de publicacion porque el estado `vigente` en `motor_comercial_reglas_versiones`, junto al indice unico parcial por dominio, modela la publicacion local atomica de una version completa.

## Servicio implementado

Archivo:

- `backend/src/services/motorComercialReglasCompuestasPersistence.js`

Funciones agregadas:

- `publishApprovedCompositeRulesVersion`
  - Requiere una version `aprobada`.
  - Bloquea versiones no aprobadas.
  - Bloquea reglas no confirmadas, no aprobadas o con `autoaplica` distinto de `false`.
  - Ejecuta publicacion con `BEGIN/COMMIT`.
  - Reemplaza la version vigente anterior dentro de la misma transaccion.
  - Marca las reglas de la version nueva como `vigente`.
  - Registra historial append-only.
- `readCurrentPublishedCompositeRules`
  - Busca solo la version `vigente` del dominio.
  - Devuelve solo reglas con:
    - `estado_confianza = confirmado`;
    - `estado_publicacion = vigente`;
    - `autoaplica = false`;
    - `accion_version <> vence`.
  - Lee terminos vinculados desde persistencia.

## API local agregada

Rutas agregadas en `backend/src/routes/fuentesComercialesRoutes.js`:

- `POST /api/fuentes-comerciales/planes-fijos/reglas-compuestas/:versionId/publicar-local`
  - Publica localmente una version aprobada.
  - No publica al Portal.
  - No conecta Constructor.
- `GET /api/fuentes-comerciales/planes-fijos/reglas-compuestas-publicadas/vigente`
  - Lectura de consumidor local.
  - Devuelve solo la version vigente y reglas publicables.

## Evidencia de publicacion local

Flujo probado:

1. Version aprobada:
   - `version-aprobada`
   - estado antes de publicar: `aprobada`
2. Version anterior:
   - `version-vieja`
   - estado antes de publicar: `vigente`
3. Publicacion local:
   - abre `BEGIN`;
   - bloquea version objetivo con `FOR UPDATE`;
   - bloquea reglas de la version con `FOR UPDATE`;
   - reemplaza version anterior;
   - marca version nueva como `vigente`;
   - marca reglas nuevas como `vigente`;
   - registra historial;
   - cierra `COMMIT`.
4. Version vigente resultante:
   - `version-aprobada`
   - `estado_publicacion = vigente`

## Comparacion aprobado vs publicado vs leido

Prueba con las 9 reglas compuestas actuales del PDF oficial:

| Etapa | Version | Reglas | Filtro |
| --- | --- | ---: | --- |
| Aprobado | version aprobada local | 9 | reglas compuestas confirmadas |
| Publicado local | version vigente local | 9 | publicacion atomica de version aprobada |
| Leido por consumidor | version vigente local | 9 | confirmadas + vigentes + autoaplica false |

No se mezclan versiones porque `readCurrentPublishedCompositeRules` primero identifica una unica version `vigente` y luego consulta reglas con `WHERE version_id=$1`.

## Exclusion de reglas no publicables

La publicacion local rechaza:

- versiones que no esten en `aprobada`;
- reglas con `estado_confianza` distinto de `confirmado`;
- reglas que no esten en estado publicable;
- reglas con `autoaplica` distinto de `false`;
- reglas vencidas como accion de version para lectura de consumidor.

## Ejemplo real incluido

Desde el PDF oficial 2026:

```json
{
  "identidad_comercial": "fijo_benefits|bono_streaming|fijo",
  "terminos": 11,
  "compatibilidad": "no_acumula",
  "limite": {
    "cantidad": 1,
    "unidad": "BAN"
  },
  "autoaplica": false,
  "pagina": 3
}
```

## Pruebas automatizadas

Pruebas agregadas o ampliadas:

- migracion append-only y sin mezcla de versiones;
- identidad comercial sin precio;
- diff `nuevo`, `modifica`, `vence`, `sin_cambio`;
- persistencia atomica;
- lectura posterior de version persistida;
- publicacion local atomica;
- rechazo de version no aprobada;
- rechazo de reglas no publicables;
- lectura de consumidor filtrada;
- prueba real con PDF oficial 2026 y 9 reglas compuestas.

## Riesgos pendientes

- La migracion sigue sin ejecutarse en produccion.
- La publicacion local depende de que las tablas existan en una base preparada.
- La lectura de consumidor todavia no esta conectada al Constructor.
- `autoaplica` sigue deshabilitado.
- Antes de produccion se requiere backup, migracion controlada, validacion contra base real y autorizacion explicita.
