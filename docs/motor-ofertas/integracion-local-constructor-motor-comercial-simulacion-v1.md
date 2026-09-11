# Integracion local Constructor - Motor Comercial Fijo + Benefits v1

Fecha local: 2026-08-30

## Alcance autorizado

Etapa local para conectar el Constructor al Motor Comercial solo en modo evaluacion / simulacion.

Limites respetados:

- No se desplego produccion.
- No se ejecutaron migraciones productivas.
- No se activo `autoaplica`.
- No se modificaron datos comerciales publicados.
- No se retiro la logica anterior del Constructor.
- No se modificaron proyectos externos al flujo comercial de `newcrm`.
- No se leyeron PDF, Excel ni reglas no publicadas desde el Constructor.

## Endpoint o servicio consumido

El Constructor consume el endpoint de lectura de consumidor ya creado:

- `GET /api/fuentes-comerciales/planes-fijos/reglas-compuestas-publicadas/vigente`

Contrato esperado:

- devuelve una unica version vigente;
- devuelve solo reglas `confirmado + vigente + publicadas`;
- excluye reglas no confirmadas, borradores, contradictorias, incompletas o reemplazadas;
- conserva `autoaplica = false`.

El loader del Constructor agrega token JWT del CRM cuando existe `localStorage.vp_token`, porque la ruta esta protegida por `requireAdmin`.

## Archivos del Constructor modificados

- `Planes para web/constructor-publications.js`
  - agrega endpoint `commercialRules`;
  - lee reglas publicadas vigentes;
  - expone `motorRulesVersion` y `motorRules`;
  - agrega `evaluateCommercialRulesSimulation`;
  - filtra reglas no publicables;
  - calcula elegibilidad de simulacion con motivos de descarte.
- `Planes para web/oferta-const.html`
  - agrega panel `motorSimulationPanel`;
  - construye contexto local de cliente/BAN/lineas/productos;
  - muestra reglas recibidas, elegibles, descartadas y combinaciones;
  - mantiene la comparacion contra comportamiento actual sin reemplazar calculos existentes.

## Ejemplo real de entrada cliente/BAN/linea

Caso local usado para la simulacion:

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

Fuente oficial local:

- `documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf`
- Paginas extraidas: 35
- Reglas compuestas generadas desde esa fuente: 9

## Reglas recibidas desde el Motor Comercial

Para la prueba real local se recibieron 9 reglas compuestas publicables:

- `fijo_benefits|meses_gratis|movil`
- `fijo_benefits|pago_penalidad|fijo`
- `fijo_benefits|bono_portabilidad|fijo`
- `fijo_benefits|doble_velocidad|fijo`
- `fijo_benefits|doble_data|movil`
- `fijo_benefits|descuento_porcentaje|movil`
- `fijo_benefits|descuento_accesorios|accesorio`
- `fijo_benefits|bono_streaming|fijo`
- `fijo_benefits|descuento_affinity|fijo`

## Reglas elegibles en la simulacion

Con el contexto de ejemplo, el evaluador marco como elegibles:

- `fijo_benefits|pago_penalidad|fijo`
- `fijo_benefits|bono_portabilidad|fijo`
- `fijo_benefits|doble_data|movil`
- `fijo_benefits|descuento_porcentaje|movil`
- `fijo_benefits|bono_streaming|fijo`

Todas se conservaron con `autoaplica = false`.

## Reglas descartadas y motivo

- `fijo_benefits|meses_gratis|movil`: `evento_no_aplica`
- `fijo_benefits|doble_velocidad|fijo`: `evento_no_aplica`
- `fijo_benefits|descuento_accesorios|accesorio`: `evento_no_aplica`, `producto_no_presente`
- `fijo_benefits|descuento_affinity|fijo`: `evento_no_aplica`

El evaluador tambien descarta reglas por:

- `estado_no_confirmado`;
- `estado_no_vigente`;
- `autoaplica_no_permitido`;
- `requiere_convergencia_confirmada`;
- `plan_minimo_no_cumplido`;
- `producto_no_presente`.

## Combinaciones calculadas

Resultado local:

- Reglas recibidas: 9
- Reglas elegibles: 5
- Reglas descartadas: 4
- Combinaciones calculadas: 4

Las combinaciones se devuelven como acciones `evaluar`, no como aplicacion automatica.

## Recomendacion generada

Modo:

- `simulacion`

Texto generado:

- `Evaluar 5 regla(s) publicada(s) contra el caso antes de decidir.`

La recomendacion no publica, no modifica propuesta y no toma decision automatica.

## Trazabilidad

La evaluacion conserva:

- version vigente leida desde el endpoint;
- identidad comercial de cada regla;
- contrato compuesto persistido;
- terminos vinculados;
- fuente oficial;
- seccion/pagina de origen cuando viene en la regla.

Ejemplo de fuente conservada:

```json
{
  "id": "beneficios-local",
  "familia": "beneficios",
  "nombre_original": "2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf"
}
```

## Comparacion contra comportamiento anterior

Antes:

- el Constructor mostraba Benefits como pendientes de publicacion;
- no leia reglas compuestas del Motor Comercial;
- no calculaba elegibilidad de Benefits.

Ahora:

- mantiene el mensaje de Benefits pendientes para no activar reglas heredadas;
- agrega un panel separado de Motor Comercial en modo evaluacion;
- permite comparar reglas publicadas vigentes contra el contexto actual;
- no altera carrito, totales, propuesta ni cierre comercial.

## Pruebas ejecutadas

Comandos y resultados:

- `node --test backend/test/constructor-motor-comercial-simulacion.test.js backend/test/oferta-const-portal.test.js backend/test/fijo-benefits-preview-contract.test.js backend/test/motor-comercial-reglas-compuestas-persistence.test.js backend/test/fijo-benefits-normalizer.test.js`
  - Resultado: 35 pruebas, 35 pass, 0 fail.
- `node --check "Planes para web/constructor-publications.js"`
  - Resultado: ok.
- `node --check backend/src/routes/fuentesComercialesRoutes.js`
  - Resultado: ok.
- `node --check backend/src/services/motorComercialReglasCompuestasPersistence.js`
  - Resultado: ok.
- Validacion de sintaxis del script inline de `Planes para web/oferta-const.html`
  - Resultado: `inline scripts ok 1`.
- Simulacion local desde PDF oficial con `scripts/extract_pdf_text.py`
  - Resultado: 35 paginas, 9 reglas recibidas, 5 elegibles, 4 descartadas, 4 combinaciones.

## Riesgos pendientes

- La integracion sigue local; no esta desplegada en produccion.
- La migracion existe localmente, pero no se ejecuto en produccion.
- Antes de activar flujo productivo falta validar migracion y lectura contra una base local/real equivalente al esquema actual.
- La simulacion no debe convertirse en aplicacion automatica sin una decision posterior.
- Las reglas con elegibilidad ausente deben continuar bloqueadas o descartadas; no completar condiciones por inferencia.

## Estado para decision

La etapa local queda lista para revision: el Constructor ya puede leer reglas publicadas vigentes desde el Motor Comercial y simular elegibilidad sin sustituir el comportamiento anterior.
