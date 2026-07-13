# Validacion local del MVP del motor de ofertas

Fecha: 2026-07-13

## Alcance validado

- Flujo Admin Ofertas: dos Excel, preview, aprobacion y version vigente.
- Cuatro endpoints protegidos del motor de ofertas.
- Elegibilidad movil por vigencia documental, limite BAN y familia Business RED.
- Modal de equipos de `ofertas-proui` consumiendo exclusivamente `POST /api/motor-ofertas/elegibles`.

No se hizo deploy ni se conecto a produccion.

## Base de datos aislada

- Conexion verificada como local: `postgresql://crm_user@localhost:5432/crm_pro`.
- Schema: `ventaspro_nuevo`.
- Snapshot previo: `C:\Users\Gabriel\Documentos\Programas\newcrm\.local-backups\motor-ofertas\crm_pro-before-motor-ofertas-20260713-124224.dump`.
- SHA-256 del snapshot: `135b1c83dcbf1301bf5b4c9c775218c560cba5d4f0e015113bed959be227c936`.
- Prueba de rollback: la migracion ejecutada con `ROLLBACK` dejo ausentes las cinco tablas del motor; resultado `ROLLBACK_TEST=OK`.
- Luego se aplico la migracion solamente sobre esa instancia local para las pruebas de integracion.

La cuenta local no tiene privilegio para crear otra base de datos. Por ello se uso el schema aislado existente, con snapshot previo y rollback comprobado.

## Datos de prueba

La integracion se ejecuto con archivos no comerciales marcados como fixture local:

- `tabla-financiamiento-fixture-local.xlsx`.
- `lista-precios-fixture-local.xlsx`.

Su ventana documental es 2026-07-04 a 2026-07-15. El resultado no habilita ni representa una regla comercial real: sigue pendiente la fuente oficial vigente.

## Resultado de integracion

- Preview incompleto: `422` con `preview_incompleto` y sin persistencia.
- Preview completo: manifiesto con hash por archivo y version inmutable `1.0.1`.
- Aprobacion: version vigente local activada y version anterior conservada como reemplazada.
- `POST /api/motor-ofertas/elegibles`: requiere Bearer; la linea Individual $35 devolvio Samsung Galaxy A37 128GB, plazo 24, pago mensual $14.58 y beneficio `gratis`.
- La modal aplico la seleccion a la linea y dejo seguro oculto con estado `pendiente_fuente`.

## Pruebas

- Backend dirigido: `node --test test/motor-ofertas-*.test.js` - 109 pruebas en verde.
- Portal dirigido: `npm test`.
- Base global existente: 10 fallos preexistentes registrados; no se corrigieron ni se mezclaron con este trabajo.
