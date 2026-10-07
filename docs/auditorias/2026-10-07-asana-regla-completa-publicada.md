# Regla completa publicada: cuotas y oportunidades

Gabriel autorizó aplicar la regla completa, probar y publicar el 7 de octubre de 2026.

## Regla

Fijo: contrato vencido o sin fecha final; sumar mensualidad válida en dólares, conservar sin precio sin inventar monto. Móvil: únicamente cero cuotas pendientes efectivas. Descuento mensual desde inicio y plazo por aniversario en Puerto Rico, independiente de Tango. Datos insuficientes conservan el dato guardado, sin convertir vacío en cero. Canceladas, No renueva y ventas confirmadas coincidentes se excluyen. Nuevas/adicionales manuales se conservan. Otros productos conservan el criterio previo.

## Alcance y cifras

- 3207 líneas operativas auditadas.
- 1069 líneas de 515 clientes tienen cuotas efectivas diferentes.
- 78 líneas de 18 clientes cambian en 41 seguimientos auditados.
- Cero filas de suscriptores o contratos sobrescritas: cálculo dinámico en lecturas, sin migración ni backfill.

Clientes, Asana y comparativa-base comparten effectiveContractPayments. El número calculado sigue un calendario; no acredita un cobro bancario ni registra un pago real. Metas y Panel General siguen usando ventas confirmadas de Comisiones; no convierten oportunidades en ventas. Las tarjetas de estados Activas/Canceladas/Seguimiento/Incompletas y las alertas contractuales de Clientes conservan su significado.

## Evidencia pública

39 pruebas dirigidas aprobadas. Regresiones cubren aniversario, sin origen Tango, entradas vacías, fecha inválida, Fijo vigente con cero cuotas, Móvil con deuda aunque vencido, cancelación, deduplicación, ventas confirmadas y manuales. Verificación autenticada pública compara los 41 agregados con la auditoría; detalle y cuotas de tres clientes; Chrome comprueba la tabla con datos reales y cero errores.

- Barranquitas Y Aibonito Memorial: 7 móviles y $214.98 fijo.
- CAS AND PROJECT MANAGMENT: 1 móviles y $0.00 fijo.
- JIREH CONSULTING ENGINEERING & NETWORK DESING: 0 móviles y $0.00 fijo.

El reporte anterior de 9 móviles para Barranquitas simulaba solo recálculo de cuotas manteniendo elegibilidad antigua. La regla completa separada fijo/móvil da 7; es el resultado publicado y verificado.

Respaldo de cuatro archivos y dump validado: /home/gabriel/backups/asana-regla-completa-20261007. Publicados cuatro artefactos focalizados, SHA256 comparado, PM2 online y salud pública 200. CSV por línea y por seguimiento en output/asana-regla-completa.

## Pendientes

No queda implementación pendiente de esta regla. Los datos contractuales faltantes o contradictorios conservan su necesidad de revisión contra fuente; no se inventaron.
