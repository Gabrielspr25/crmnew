# Actualizacion Motor Comercial sombra - boletines 23 julio y 27 agosto 2026

Fecha de trabajo: 2026-09-01

## Alcance ejecutado

- Motor Comercial se mantiene en modo sombra.
- `autoaplica` queda en `false`.
- No se modifico el calculo definitivo del Constructor.
- No hubo despliegue ni migraciones productivas.
- Se incorporo BYOP como modalidad de linea, no como tipo de linea.
- Se separo `account_type` de `modalidad_linea`.
- Las ambiguedades comerciales quedan como `requiere_revision`.

## Fuentes oficiales usadas

| Fuente | Uso | Evidencia |
|---|---|---|
| Boletin Oferta Descuentos Modems, MIFI y Tablets 23 julio 2026 | Regla oficial de descuento $130 para modems, MIFI y tablets Business RED Plus | SHA-256 `BDCD529BC1F2ABD8D71D0DCDA23F5142F67480249E00EF3451DEE1CDD61DECF5` |
| Ofertas Update Plus y Financiamiento 27 de agosto al 16 de septiembre de 2026.xlsx | Nuevas matrices Business RED Plus desde hoja `Ofertas Red Plus` | Archivado local en `documentos-ofertas/movil/ofertas-financiamiento/2026-09-01--Ofertas-Update-Plus-Financiamiento-27ago-16sept-2026.xlsx`; SHA-256 `33332298704723F3A3D859E70798371CC0A4D42B64ED90F2C212401DBF9E1091` |

## Normalizacion aplicada

- BYOP:
  - `tipo = multilinea_business_red`
  - `modalidad_linea = byop`
  - `account_type = Business BYOP Corporate` o el account type publicado
  - resultado: modalidad valida sin promocion de equipo.
- Account type:
  - Se conserva como condicion comercial separada.
  - No decide modalidad y no activa BYOP por inferencia.
- Business RED Plus 27 agosto:
  - Hoja reconocida: `Ofertas Red Plus`.
  - Plan reconocido: `Business Red Plus $60`.
  - Vigencia reconocida: `2026-08-27` a `2026-09-16`.
  - Grupos reconocidos: 4.
- Modems/MIFI/Tablets:
  - Descuento oficial: `$130`.
  - Codigos financiamiento: `F13024`, `F13030`.
  - Codigos Update Plus: `U13024`, `U13030`.
  - Fuente, vigencia y condiciones via Motor Comercial, no frontend.

## Validacion ejecutada

Comando:

```bash
node --test backend/test/motor-ofertas-contract.test.js backend/test/business-red-plus-eligibility.test.js backend/test/motor-ofertas-eligibility.test.js backend/test/motor-ofertas-normalizer.test.js backend/test/constructor-motor-comercial-simulacion.test.js
```

Resultado: 42/42 pruebas aprobadas.

Validacion de fuente oficial archivada:

```json
{
  "hoja": "Ofertas Red Plus",
  "plan": { "nombre": "Business Red Plus", "monto": 60 },
  "vigencia": { "desde": "2026-08-27", "hasta": "2026-09-16" },
  "grupos": 4,
  "warnings": []
}
```

Validador ampliado:

```bash
node tmp/constructor-equivalencia/validate-motor-equivalence.mjs
```

Resultado:

```json
{
  "ok": true,
  "conclusion": "NO_LISTO_PARA_PROMOVER",
  "totals": {
    "requiere decision comercial": 7,
    "Motor corrige flujo anterior": 3,
    "equivalentes": 3
  }
}
```

Archivos de evidencia generados:

- `tmp/constructor-equivalencia/equivalencia-motor-vs-flujo-anterior.json`
- `tmp/constructor-equivalencia/equivalencia-motor-vs-flujo-anterior.md`

## Conclusion

El Motor Comercial queda actualizado para evaluacion sombra con las reglas vigentes revisadas, pero no esta listo para promover como fuente principal del Constructor.

Motivo: la matriz de equivalencia aun muestra 7 casos que requieren decision comercial antes de activar el Motor como calculo definitivo, especialmente por diferencias de equipo/oferta/descuento entre el flujo anterior y el Motor.

