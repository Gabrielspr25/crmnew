# Correccion publicacion Business RED Plus para prueba controlada

Fecha: 2026-09-01  
Proyecto: `newcrm`  
Estado: `LISTO_PARA_PRUEBA_CONTROLADA` local. Sin deploy, sin migraciones, sin `autoaplica=true`.

## Bloqueo original

La API local tenia una version movil vigente con 9 reglas en `public.ofertas_movil_versiones`, pero el resumen publicado no incluia `resumen.business_red_plus`.

Efecto:

```text
POST /api/motor-ofertas/candidatos-alternativas
-> 404 esquema_business_red_plus_no_publicado
```

## Causa

La publicacion general movil reemplazaba `resumen` por el resumen del preview general. Ese preview no contiene el subcontrato especializado `business_red_plus`, por lo que una publicacion general podia perder ese bloque.

La base local tampoco tenia una version historica previa con `resumen.business_red_plus`, por eso fue necesario publicar localmente el bloque Business RED Plus desde la fuente oficial correcta.

## Fuente oficial usada

Business RED Plus publicado desde:

- Excel: `C:/Users/Gabriel/Dropbox/Boletines Vigentes PYMES/27 AL 16 DE SEPTIEMBRE 2026/Tabla Ofertas Update Plus y Financiamiento 27 de agosto al 16 de septiembre de 2026- PYMES.xlsx`
- Hoja: `Ofertas Business Red Plus`
- SHA-256 Excel: `bc46975ee50c0a33aa1a7474422001f8947db5f8d7ecd9db550d18881bec48b0`
- PDF respaldo: `C:/Users/Gabriel/Dropbox/Boletines Vigentes PYMES/27 AL 16 DE SEPTIEMBRE 2026/PLANES MOVILES VIGENTES/Nuevos Planes Multilineas Business Red PYMES-SUB-240802-rv.pdf`
- SHA-256 PDF: `42c17492f7398fe1a2c09374364c9c67050b7a08cd7df216e0fe53676bcf6dfa`
- Plan detectado: `Business Red Plus`
- Tarifa: `$65`
- Vigencia: `2026-08-27` a `2026-09-16`
- Grupos publicados: `4`

No se mezclo con `REDPLUS $60`. Esa fuente queda separada como ambigua para `BREDP1` y no se promovio por similitud de nombre.

## Correccion aplicada

- La publicacion general movil ahora conserva el bloque `resumen.business_red_plus` vigente cuando el preview general no lo trae.
- Se publico localmente una nueva version movil vigente con el bloque Business RED Plus oficial.
- La Consulta del Constructor ahora envia `business_red_plus` al Motor solo cuando:
  - el texto lo indica explicitamente (`Business Red Plus` / `BREDP1`), o
  - el escenario CRM/manual ya es multiliena con familia publicada.
- Se bloqueo la inferencia accidental desde el selector interno `plus` cuando el escenario no es multilinea.
- El resumen visual de Consulta ahora cuenta `financiado` sin descuento como regular, no como beneficio.
- La fuente en alternativas deja de mostrarse como `[object Object]`.

## Version local publicada

```json
{
  "id": "7eb458c8-28c7-463a-9559-16f33a291a8e",
  "numero": "2",
  "estado": "vigente",
  "vigencia_desde": "2026-08-27",
  "vigencia_hasta": "2026-09-16",
  "business_red_plus": true,
  "plan": { "nombre": "Business Red Plus", "monto": 65 },
  "groups": 4
}
```

Evidencia:

- `tmp-evidencia/business-red-plus-publicacion-before.json`
- `tmp-evidencia/business-red-plus-publicacion-after.json`
- `tmp-evidencia/business-red-plus-api-validation.json`
- `tmp-evidencia/business-red-plus-browser-validation.json`

## Casos validados

| Caso | Resultado |
| --- | --- |
| Version vigente | API `200`, version `2`, `business_red_plus=true`, 4 grupos |
| Endpoint candidatos | Ya no devuelve `esquema_business_red_plus_no_publicado` |
| A37 8 renovaciones | API `200`, 0 candidatos Business RED Plus; A37 no esta en el bloque oficial Business RED Plus publicado |
| A37 alternativas gratis | Sin alternativas vigentes bajo ese filtro; no se invento promocion |
| S26 10 renovaciones | API `200`, 30 candidatos; incluye S26 gratis/descuentos/regulares por posicion |
| Consulta generica S26 | No infiere Business RED Plus; queda sin candidatos si el plan no viene en escenario |
| Consulta Business Red Plus S26 | Visual: 3 lineas con beneficio, 7 regulares, alternativas devueltas por Motor |
| REDPLUS $60 vs BREDP1 $65 | Permanece separado; no se mapea por inferencia |

## Capturas

- `tmp-evidencia/constructor-business-red-plus-local.png`
- `tmp-evidencia/constructor-business-red-plus-consulta-a37.png`
- `tmp-evidencia/constructor-business-red-plus-consulta-s26.png`
- `tmp-evidencia/constructor-business-red-plus-consulta-s26-business-red-plus.png`

## Pruebas

Especificas:

```text
node --test backend\test\constructor-intelligent-consultation.test.js backend\test\motor-commercial-candidates.test.js backend\test\business-red-plus-publication.test.js
```

Resultado: `40/40` aprobadas.

Regresion amplia:

```text
node --test backend\test\business-red-plus-publication.test.js backend\test\motor-commercial-candidates.test.js backend\test\business-red-plus-eligibility.test.js backend\test\constructor-intelligent-consultation.test.js backend\test\constructor-business-red-plus-contract.test.js backend\test\motor-ofertas-contract.test.js backend\test\motor-ofertas-normalizer.test.js backend\test\motor-ofertas-eligibility.test.js backend\test\constructor-motor-comercial-simulacion.test.js backend\test\constructor-publications-runtime.test.js backend\test\benefits-portal-catalog.test.js backend\test\fijo-benefits-normalizer.test.js backend\test\fijo-benefits-preview-contract.test.js backend\test\oferta-const-portal.test.js
```

Resultado: `131/131` aprobadas.

## Archivos modificados

- `backend/src/routes/motorOfertasRoutes.js`
- `backend/test/business-red-plus-publication.test.js`
- `Planes para web/constructor-publications.js`
- `Planes para web/oferta-const.html`
- `backend/test/constructor-intelligent-consultation.test.js`
- `tmp-evidencia/publicar-business-red-plus-local.mjs`
- `tmp-evidencia/auditar-business-red-plus-local.mjs`
- `tmp-evidencia/validar-business-red-plus-api-local.mjs`
- `tmp-evidencia/capturar-consulta-business-red-plus-local.mjs`
- `tmp-evidencia/inspeccionar-consulta-browser-local.mjs`
- `docs/constructor/correccion-publicacion-business-red-plus-prueba-controlada.md`

## Riesgos pendientes

- A37 no esta confirmado dentro del bloque oficial `Business RED Plus $65` publicado; no debe tratarse como promocion Business RED Plus sin nueva fuente o decision comercial.
- La prueba fue local. No hubo deploy ni cambio productivo.
- No se ejecuto migracion.
- `autoaplica` permanece `false`.
- El Motor no fue promovido como calculo definitivo.

## Conclusion

`LISTO_PARA_PRUEBA_CONTROLADA`
