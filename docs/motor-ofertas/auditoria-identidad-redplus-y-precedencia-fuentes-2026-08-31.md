# Auditoria final de identidad comercial y precedencia de fuentes

Motor Comercial / Constructor - newcrm  
Fecha de auditoria: 2026-08-31  
Alcance: auditoria documental y ajuste de validador. No implementa promociones nuevas.

## Limites de esta etapa

- No se activo `autoaplica`.
- No se removio fallback.
- No se cambio carrito, totales, propuesta guardada ni calculo definitivo del Constructor.
- No se desplego produccion.
- No se ejecutaron migraciones.
- No se escribieron datos productivos.
- No se promovio el Motor Comercial como fuente definitiva.

## Fuentes revisadas

| Fuente | Tipo | Vigencia visible | Evidencia usada | Prioridad |
|---|---|---:|---|---:|
| `2026-09-01--Ofertas-Update-Plus-Financiamiento-27ago-16sept-2026.xlsx` | Excel oficial archivado | 2026-08-27 a 2026-09-16 | Hoja `Ofertas Red Plus`, filas 3-33; hoja `PLANES UPDATE`, filas 1-24 | 1 |
| `Tabla Ofertas Update Plus y Financiamiento 6 al 26 de agosto de 2026- PYMES.xlsx` | Publicacion movil productiva version 2 | 2026-08-06 a 2026-08-26 | API `/api/ofertas-movil/vigente`, bloque `business_red_plus` | 2 |
| `Nuevos Planes Multilineas Business Red PYMES-SUB-240802-rv.pdf` | PDF oficial de planes Business RED | Desde 2024-08-06 | Extracto local, paginas 5-10; lineas de plan `BREDP1` y precios por posicion | 1 para identidad de plan |
| `Boletin Extension Nuevo Plan Multilinea Business Red Plus-BYOP-BAN-260529.pdf` | PDF oficial BYOP BAN | 2026-06-01 a 2026-06-30 | Extracto local, paginas 2-5; codigo `BREDP1015` y restriccion BYOP | 1 para BYOP historico |
| `Tabla Ofertas Financiamiento 20 de junio al 3 de julio de 2026- PYMES.xlsx` | Excel oficial anterior | 2026-06-20 a 2026-07-03 | Extracto local `Planes de Lista`, filas R8, R18, R23 | 3 |
| Flujo anterior del Constructor | Logica historica | No es fuente oficial | Salida comparativa local | 4 |

## Regla de precedencia

1. Fuente oficial vigente y especifica para el mismo producto, codigo, modalidad, evento, equipo y fecha.
2. Publicacion estructurada que proviene de esa fuente oficial exacta.
3. Fuente oficial anterior aun valida solo si no existe reemplazo o contradiccion para el mismo alcance.
4. Flujo anterior del Constructor solo como referencia historica; no decide verdad comercial.

Si una fuente posterior existe pero no coincide en identidad comercial, el caso queda `FUENTE_AMBIGUA`.

## Inventario de identidad comercial

| nombre_fuente | hoja/fuente | codigo_plan | codigo_familia | nombre_comercial | modalidad | tarifa_base | tarifa_primera_linea | max_lineas | esquema | vigencia_desde | vigencia_hasta | fuente_prioridad | evidencia | confianza | observacion |
|---|---|---|---|---|---|---:|---:|---:|---|---|---|---:|---|---|---|
| Ofertas Plan Individual y Familiar Red Plus $60 | Excel 27/agosto, hoja `Ofertas Red Plus` | REDPLUS / familiar no confirmado en oferta | REDPLUS | Red Plus individual/familiar | update_plus / financiamiento | 60 | 60 | 8 | individual/familiar | 2026-08-27 | 2026-09-16 | 1 | Filas 3-5, 10-12, 18-20, 25-27: "Aplica a tarifa individual y familiares Red Plus" | confirmada para Red Plus, no para BREDP1 | No prueba que aplique a Business RED Plus `BREDP1`. |
| Plan nacional individual Red Plus | Excel 27/agosto, hoja `PLANES UPDATE` | REDPLUS | REDPLUS | Red Plus | individual | 60 | 60 | 1 | individual | 2026-08-27 | 2026-09-16 | 1 | Fila 11: `REDPLUS | 60` | confirmada | Reemplaza/actualiza precio individual frente a fuentes previas, pero no sustituye por si solo `BREDP1`. |
| Plan nacional familiar Red Plus | Excel 27/agosto, hoja `PLANES UPDATE` | VREDPLU1 | REDPLUS | Red Plus familiar | familiar | 220 | no_detallada | 8 | familiar | 2026-08-27 | 2026-09-16 | 1 | Fila 22: `VREDPLU1 | 8 Lineas por $220` | confirmada | Relacionado a Red Plus familiar; no es Business RED Plus suscriptor. |
| Business RED Plus multilínea | PDF Nuevos Planes Multilineas Business Red | BREDP1 | business_red_plus | Business RED Plus | financiamiento / pospago | 350 total 10 lineas | 65 | 10 | multilínea por suscriptor | 2024-08-06 | vigente sin reemplazo especifico localizado | 1 | Paginas 5-7: primera linea $65; codigo de activacion `BREDP1`; lineas 1-10 `BREDP1..BREDP10` | confirmada | Identidad distinta de `REDPLUS` individual/familiar. |
| Business RED Plus lineas 2-10 | PDF Nuevos Planes Multilineas Business Red | BREDP2..BREDP10 | business_red_plus | Business RED Plus por posicion | financiamiento / pospago | 350 total 10 lineas | 45/20/30/15/35... | 10 | multilínea por suscriptor | 2024-08-06 | vigente sin reemplazo especifico localizado | 1 | Tabla de procedimiento: linea 2 $45, linea 3 $20, linea 4 $30, linea 5 $15, lineas 6-10 $35 | confirmada | El job asigna codigo/renta segun posicion; el vendedor inicia con `BREDP1`. |
| Business Red Plus individual anterior | Tabla 20/junio-03/julio, `Planes de Lista` | BREDPLUS | business_red_plus | Business Red Plus individual | individual | 65 | 65 | 1 | individual | 2026-06-20 | 2026-07-03 | 3 | Fila R8: `BREDPLUS | 65`; "Reemplaza REDPLUS" | historica | Fuente anterior; no debe prevalecer sobre `REDPLUS $60` para individual vigente, salvo confirmacion comercial de continuidad. |
| Business RED Plus BYOP BAN | Boletin BYOP BAN / Tabla 20/junio | BREDP1015 | business_red_plus_byop | Business RED Plus BYOP BAN | BYOP | 150 por BAN | 150 cargo BAN / promedio variable | 10 | multilínea BAN | 2026-06-01 | 2026-06-30 | 3 | Paginas 2-5: solo BYOP, smartphones, clientes nuevos, 2-10 lineas; `BREDP1015`; tabla R23 | confirmada historica | Modalidad separada. BYOP no habilita promocion de equipo. |

## Relacion entre `$60`, `$65`, `REDPLUS`, `BREDPLUS` y `BREDP1`

`REDPLUS $60` esta probado en el Excel del 27/agosto como plan individual y como base de ofertas individuales/familiares Red Plus. La hoja de ofertas repite que aplica a "tarifa individual y familiares Red Plus" y la hoja `PLANES UPDATE` contiene `REDPLUS | 60` y `VREDPLU1 | 8 Lineas por $220`.

`BREDP1 $65` esta probado en el boletin de planes Business RED como plan multilínea Business RED Plus por suscriptor. Ese boletin indica primera linea $65, activacion con `BREDP1`, maximo 10 lineas y reasignacion nocturna a `BREDP2..BREDP10` segun posicion.

No hay evidencia oficial suficiente para declarar que `Ofertas Red Plus $60` reemplaza las ofertas Business RED Plus `BREDP1`. Por tanto:

- `REDPLUS` no debe tratarse como sinonimo de `BREDP1`.
- `BREDPLUS` historico individual de $65 no debe confundirse con `BREDP1`.
- La similitud de nombres "Red Plus" / "Business Red Plus" no autoriza equivalencia.
- La diferencia $60 vs $65 queda bloqueada como `FUENTE_AMBIGUA` para escenarios Business RED Plus multilínea.

## Casos ambiguos auditados

| Caso | Plan/familia | Tarifa | Evento | Posicion | Equipo | Flujo anterior | Motor Comercial | Regla/fuente exacta | Clasificacion |
|---|---|---:|---|---:|---|---|---|---|---|
| A. Business RED Plus linea 1 | `business_red_plus` / `BREDP1` | 65 flujo viejo y Motor publicado; 60 en sombra 27/agosto | linea nueva / portabilidad | 1 | Flujo viejo: iPhone 17 256GB; Motor: Galaxy S25 Fe | Usa Excel 30/jul-05/ago, oferta vencida frente a fuentes posteriores | Usa publicacion 06/ago-26/ago o sombra 27/ago segun prueba | 27/ago solo prueba `REDPLUS` individual/familiar; no prueba `BREDP1` | FUENTE_AMBIGUA |
| B. Business RED Plus renovacion | `business_red_plus` / `BREDP1` | 65 flujo viejo y Motor publicado; 60 en sombra 27/agosto | renovacion | 1 | Flujo viejo: iPhone 17 256GB; Motor: Galaxy S25 Fe | Usa Excel 30/jul-05/ago | Usa publicacion 06/ago-26/ago o sombra 27/ago segun prueba | No hay fuente vigente especifica localizada que diga si la oferta 27/ago reemplaza `BREDP1` | FUENTE_AMBIGUA |
| C. Business RED Plus 27/agosto linea 1 | `business_red_plus` tratado como `BREDP1` en escenario | 60 en Motor sombra; 65 en flujo anterior | portabilidad | 1 | Motor: Galaxy S25 Fe | Conserva $65 y equipo de fuente anterior | Parser interpreta `Ofertas Red Plus $60` como Business Red Plus | Excel 27/agosto, hoja `Ofertas Red Plus`, filas 3-33; alcance textual individual/familiar | FUENTE_AMBIGUA |

## Casos ya resueltos en esta auditoria

| Caso | Resultado | Motivo |
|---|---|---|
| BYOP como `accountType` vs modalidad de linea | MOTOR_CORRECTO | BYOP se mantiene separado: `account_type` no debe activar por si mismo una promocion de equipo. |
| Business RED / BYOP sin equipo | MOTOR_CORRECTO | La fuente BYOP BAN exige traer equipo propio y excluye promocion de equipo. |
| Tabletas/MIFI/Modems con descuento $130 | MOTOR_CORRECTO | Existe regla oficial de descuento $130 para tablets/modems/MIFI, con codigos `F13024/F13030` y `U13024/U13030`; el flujo anterior no reconciliaba equipo. |
| Caso individual dentro del evaluador Business RED | MOTOR_CORRECTO | El evaluador Business RED debe rechazar esquema individual; requiere evaluador individual separado. |

## Ajuste de validador

Se actualizo `tmp/constructor-equivalencia/validate-motor-equivalence.mjs` para separar:

- `equivalencia_con_flujo_anterior`: indica si el resultado del Motor difiere o no del flujo anterior.
- `conformidad_con_fuente_oficial`: clasifica contra la fuente oficial como `MOTOR_CORRECTO`, `MOTOR_DESACTUALIZADO`, `FLUJO_ANTERIOR_DESACTUALIZADO`, `AMBOS_DESACTUALIZADOS` o `FUENTE_AMBIGUA`.

Esto evita promover como "decision comercial" una diferencia que realmente es una ambiguedad documental.

## Clasificacion final

| Tema | Clasificacion final | Decision operativa |
|---|---|---|
| `REDPLUS $60` vs `BREDP1 $65` | FUENTE_AMBIGUA | Bloquear uso de `REDPLUS $60` como Business RED Plus multilínea hasta conseguir fuente oficial especifica. |
| Fuente 30/jul-05/ago vs 06/ago-26/ago | FUENTE_AMBIGUA para promocion vigente actual | Ambas son anteriores al 27/agosto; no bastan para activar calculo definitivo hoy. |
| Parser 27/agosto como Business RED Plus | FUENTE_AMBIGUA | Corregir en etapa posterior para que `Ofertas Red Plus` no se normalice automaticamente como `business_red_plus`. |
| BYOP | MOTOR_CORRECTO | Mantener modalidad separada y sin promocion de equipo. |
| Tablets/MIFI/Modems $130 | MOTOR_CORRECTO | Mantener consumo desde Motor Comercial publicado, sin duplicar en frontend. |

Conclusión: **NO LISTO PARA PROMOVER** el Motor Comercial como fuente principal definitiva del Constructor mientras `REDPLUS $60` y `BREDP1 $65` sigan sin una fuente oficial que autorice su equivalencia o reemplazo.

## Recomendaciones para la siguiente autorizacion

1. Localizar o recibir el boletin/Excel vigente especifico de ofertas Business RED Plus `BREDP1` posterior al 26/agosto, si existe.
2. Ajustar el parser para que la hoja `Ofertas Red Plus` se clasifique como `REDPLUS` individual/familiar o quede `requiere_revision` cuando el escenario sea `BREDP1`.
3. Revisar la politica de version vigente: produccion mantiene version movil 2 con vigencia hasta 2026-08-26; no debe mezclarse con sombra 27/agosto sin publicacion aprobada.
4. Ampliar la matriz de equivalencia para exigir coincidencia de `codigo_plan`, `codigo_familia`, modalidad y maximo de lineas antes de comparar equipos.
5. Mantener `autoaplica=false` hasta que no queden `FUENTE_AMBIGUA` en Business RED Plus.

## No cambiar todavia

- No activar `autoaplica=true`.
- No quitar fallback.
- No reemplazar calculo anterior del Constructor.
- No cambiar totales definitivos.
- No publicar la version 27/agosto como Business RED Plus.
- No mapear `REDPLUS`, `BREDPLUS` y `BREDP1` por similitud de nombre.
- No resolver el precio $60/$65 por inferencia.
