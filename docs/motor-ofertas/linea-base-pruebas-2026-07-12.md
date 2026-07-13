# Linea base de pruebas antes del motor de ofertas

Fecha: 2026-07-12

## Comando

Ejecutado desde `backend/` antes de modificar codigo del motor:

```powershell
node --test test/*.test.js
```

## Resultado

- Pruebas: 90
- Pasan: 80
- Fallan: 10
- Exit code: 1

## Fallos preexistentes

1. `Asana real can backfill workflow template steps prepared in crm_workflow_templates`
2. `Asana summary cards expose total, mobile lines, fixed lines, and fixed money`
3. `auto-deteccion reconoce TODOS los encabezados utiles del formato PS de Claro (formato oficial)`
4. `Oferta const implementa flujo progresivo de plan a propuesta`
5. `Oferta const arma comparativa editable antes del documento final`
6. `Comparativa usa precios automaticos y descuento de debito automatico`
7. `modems mifi y tablets se manejan como lineas Business RED multilinea`
8. `modems mifi y tablets aplican tambien en planes individuales por rango`
9. `ofertas Business RED de modems y tablets no requieren trade-in en renovacion`
10. `Clientes Seguimiento usa follow_up_prospects activo con BAN como fuente visual`

## Regla de esta fase

- No corregir ni modificar estos fallos.
- No mezclarlos con commits del motor de ofertas.
- Ejecutar solo pruebas dirigidas de migracion y contratos Zod.
- Fallar esta fase solo si aparece un error nuevo en esos contratos dirigidos.
- No ejecutar la migracion contra PostgreSQL.
- No hacer deploy.
