# Constructor v1 - Elegibilidad y calculo de propuesta local

Fecha local: 2026-08-30

## Alcance autorizado

Validacion local del Constructor v1 para:

`Cliente/BAN/Linea/Evento -> Plan base + precio base + equipo + ofertas + Benefits -> reglas elegibles -> combinaciones validas -> recomendacion -> alternativas`

Limites respetados:

- Solo reglas publicadas y vigentes del Motor Comercial.
- `autoaplica = false`.
- Sin despliegue.
- Sin migraciones productivas.
- Sin sustitucion del flujo productivo anterior.
- Sin modificacion de datos comerciales publicados.
- Sin reglas inventadas ni elegibilidad inferida.

## Implementacion

Archivo principal:

- `Planes para web/constructor-publications.js`

Funcion agregada:

- `evaluateCommercialProposal`

La funcion:

- recibe version vigente, reglas publicadas y propuesta base;
- reutiliza `evaluateCommercialRulesSimulation`;
- descarta reglas no confirmadas, no vigentes o autoaplicables;
- bloquea reglas con datos `no_determinado`;
- evalua convergencia, evento, plan minimo y producto;
- respeta `compatibilidad = acumula`;
- respeta `compatibilidad = no_acumula` eligiendo una sola regla incompatible por prioridad;
- mantiene descartes con motivo;
- devuelve propuesta local, reglas aplicadas, descartadas, combinaciones, recomendacion y alternativas.

Panel visible:

- `Planes para web/oferta-const.html`

El panel muestra:

- version del Motor Comercial;
- total base;
- propuesta local estimada;
- reglas aplicadas;
- reglas descartadas y motivo;
- alternativas;
- combinaciones calculadas;
- aviso de que no sustituye calculos actuales.

## Ejemplo completo cliente -> propuesta

Entrada:

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
  "productos": ["movil", "fijo"],
  "precio_base_mensual": 105,
  "equipo_mensual": 20
}
```

Resultado:

```json
{
  "total_base_mensual": 125,
  "descuento_mensual_estimado": 15,
  "total_estimado_mensual": 110,
  "bloqueada": false,
  "autoaplica": false
}
```

## Reglas aplicadas

- `fijo_benefits|bono_portabilidad|movil`
- `fijo_benefits|doble_data|movil`

## Reglas descartadas y motivo

- `fijo_benefits|bono_streaming|fijo`
  - `beneficio_incompatible`

## Combinaciones calculadas

Combinaciones validas:

- Linea 1 + portabilidad + movil + `bono_portabilidad`
- Linea 1 + portabilidad + movil + `doble_data`

Todas las combinaciones tienen:

- `accion = evaluar`
- `autoaplica = false`

## Recomendacion

```json
{
  "modo": "simulacion",
  "autoaplica": false,
  "texto": "Revisar propuesta con 2 regla(s) elegible(s), sin autoaplicacion."
}
```

## Alternativas generadas

- Sin Benefits:
  - total mensual estimado: `$125.00`
- Solo `bono_streaming`:
  - total mensual estimado: `$115.00`
- Solo `bono_portabilidad`:
  - total mensual estimado: `$110.00`
- Solo `doble_data`:
  - total mensual estimado: `$125.00`
- Recomendada para revision:
  - `bono_portabilidad + doble_data`
  - total mensual estimado: `$110.00`

## Casos probados

1. Cliente convergente:
   - permite reglas que exigen convergencia cuando tambien coinciden evento, producto y plan.
2. Cliente no convergente:
   - descarta con `requiere_convergencia_confirmada`.
3. Portabilidad:
   - aplica reglas cuyo evento publicado incluye `portabilidad`.
4. Renovacion:
   - se prueba como evento separado y no hereda portabilidad.
5. Beneficio incompatible:
   - reglas `no_acumula` compiten y solo queda una seleccionada; la otra se descarta con `beneficio_incompatible`.
6. Beneficio acumulable:
   - reglas `acumula` se suman a la combinacion valida si cumplen contexto.
7. Regla incompleta/no determinada:
   - descarta con `dato_no_determinado` y bloquea la propuesta local.

## Pruebas ejecutadas

Comando:

- `node --test backend/test/constructor-motor-comercial-simulacion.test.js`

Resultado:

- 6 pruebas, 6 pass, 0 fail.

## Riesgos pendientes

- La propuesta calculada sigue siendo local y no productiva.
- Los descuentos solo se calculan como monto mensual cuando la regla trae aplicacion mensual explicita.
- Beneficios sin impacto mensual explicito se muestran como beneficio/recomendacion, pero no reducen el total estimado.
- Falta autorizacion futura para conectar este calculo al cierre real de propuesta.
- Falta validacion visual en navegador real antes de cualquier publicacion.

## Estado para decision

Constructor v1 ya evalua elegibilidad real y calcula propuesta/alternativas en modo local, usando solo reglas publicadas vigentes y manteniendo `autoaplica = false`.
