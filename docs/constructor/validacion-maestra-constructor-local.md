# Validacion maestra local - Constructor Comercial

Generado: 2026-09-04T18:40:34.896Z

- Entorno: local
- Produccion: NO
- autoaplica: false
- Conclusion: LISTO_PARA_PRUEBA_CONTROLADA

## Resumen

- Casos: 14
- Equivalentes locales: 12
- Bloqueos esperados: 2
- Fallas: 0

## Casos

| Caso | Entrada | Estado | Comparacion | Bloqueos |
| --- | --- | --- | --- | --- |
| VM-001 8 renovaciones Samsung A37 | 8 renovaciones Samsung A37 | equivalente_local | equivalente_en_modo_sombra |  |
| VM-002 10 renovaciones Samsung S26 | 10 renovaciones Samsung S26 | equivalente_local | equivalente_en_modo_sombra |  |
| VM-003 5 renovaciones mixtas | 3 iPhone Pro + 2 Samsung S26 | equivalente_local | equivalente_en_modo_sombra |  |
| VM-004 Caso mixto + 2 tablets | 3 iPhone Pro + 2 S26 + 2 tablets | equivalente_local | equivalente_en_modo_sombra |  |
| VM-005 Cliente convergente | cliente convergente | equivalente_local | equivalente_en_modo_sombra |  |
| VM-006 Cliente no convergente | cliente no convergente | equivalente_local | equivalente_en_modo_sombra |  |
| VM-007 BYOP | Business RED Plus BYOP | equivalente_local | equivalente_en_modo_sombra |  |
| VM-008 Presupuesto maximo | no pasar de $500 | equivalente_local | equivalente_en_modo_sombra |  |
| VM-009 Movil + Fijo | movil + fijo | equivalente_local | equivalente_en_modo_sombra |  |
| VM-010 3 meses gratis | le corresponden 3 meses gratis? | equivalente_local | equivalente_en_modo_sombra |  |
| VM-011 Limites por BAN | lineas fuera de cupo promocional | equivalente_local | equivalente_en_modo_sombra |  |
| VM-012 FUENTE_AMBIGUA | candidato con fuente ambigua | bloqueo_esperado | requiere_revision | FUENTE_AMBIGUA no se muestra como recomendacion automatica |
| VM-013 Cambio de precio por nueva revision | IoT septiembre vs revision anterior | bloqueo_esperado | requiere_revision | Comparacion anterior vs nueva queda pendiente hasta tener/publicar ambas revisiones en el mismo flujo local |
| VM-014 Consulta progresiva/agente | Tengo este cliente -> 3 iPhone Pro y 2 S26 -> 2 tablets -> Benefits | equivalente_local | equivalente_en_modo_sombra |  |

## Tres entradas

| Modo | Escenario | Total regular | Total AutoPay | Equivalente |
| --- | --- | ---: | ---: | --- |
| CRM | Business RED Plus / renovacion / 10 lineas / S26 | 574 | 474 | si |
| Manual | Business RED Plus / renovacion / 10 lineas / S26 | 574 | 474 | si |
| Agente/Consulta | Business RED Plus / renovacion / 10 lineas / S26 | 574 | 474 | si |

## Riesgos pendientes

- No promover Motor como fuente definitiva hasta cerrar fuentes no publicadas y bloqueos esperados.
- Persistencia durable del Agente requiere migracion futura aprobada.
- REDPLUS $60 vs BREDP1 $65 sigue bloqueado por seguridad comercial.
- La comparacion de precio IoT anterior/nueva requiere completar el flujo con ambas revisiones.

