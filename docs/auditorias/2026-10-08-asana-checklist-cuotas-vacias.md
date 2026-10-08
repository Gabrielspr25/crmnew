# Asana: cuotas vacías y checklist — entrega 2026-10-08

Superficie: CRM PYMES, Asana/Clientes y Audiencia. Ambiente: producción,
https://crmp.ss-group.cloud/. Rama GitHub: codex/asana-cuotas-vacias-checklist-20261008.

## Resultado comprobado

- Cuotas móviles efectivas vacías admiten renovación después de calcular inicio/plazo válidos. No se reescriben cuotas, contratos ni suscriptores.
- Auditoría READ ONLY de 41 seguimientos activos: cambia la elegibilidad de 41 líneas en 9 clientes. Samary pasa de 0 a 5 oportunidades; la pantalla autenticada y su checklist muestran las cinco líneas reales y equipo IPH 15 128GB.
- Samary muestra los cinco pasos existentes: Contactar cliente, Validar renovación, Preparar propuesta, Enviar propuesta y Cerrar seguimiento. Se habilitaron desde las plantillas configuradas al abrir el detalle normal, sin backfill.
- Nombre y resumen BAN/suscriptores abren un único modal compacto con BAN, teléfono, equipo y estado. No presenta la cartera no elegible como pendiente; una renovación confirmada se conserva al actualizar el contrato. Suspendida no implica No renovar.
- No renovar registra decisión e historial del seguimiento en una transacción; conserva contratos y suscriptor. Pruebas HTTP cubren sesión, propietario, rechazo de línea ajena y reversión de fallo. No se ejecutó una decisión comercial ficticia en producción.
- Notas visibles en tabla, modal y detalle: fecha/hora real, recientes primero y sin autor. Historial conserva autor. No aparecen marcas internas de prioridad.
- Audiencia muestra la regla aprobada y el complemento instalado la lee de la misma fuente. Cuenta reconectada con los mismos scopes; consulta real de proyectos devuelve revisión 16 y business_rules aprobadas el 2026-10-08.

## Publicación y validación

48 pruebas dirigidas del paquete exacto + 8 del conector: pasan. JavaScript
embebido y siete módulos parseados. Revisión independiente detectó un caso de
venta anterior al nuevo inicio contractual; corregido y cubierto con regresión.

Backup validado: /home/gabriel/backups/asana-checklist-20261008, con pg_dump
restaurable, archivos anteriores y carpeta privada de Audiencia. Publicación por
scp y reinicio PM2; no git pull, migraciones ni backfill. Salud pública y local OK.
Se preservaron los cambios locales ajenos: frontend y ruta Asana se publicaron
mediante parche focal sobre los archivos productivos.

Evidencia guardada en output/asana-20261008/: production-audit.json,
artifact-tests.txt, plugin-tests.txt, samary-checklist.png,
samary-pasos-notas.png, audiencia-reglas-publicadas.png y
katy-regla-lectura-real.json. Los tests son dirigidos; no se declara completa la
suite histórica del repositorio ni otros trabajos de Audiencia.

Pendiente de este encargo: ninguno. Próxima comprobación recomendada: uso real
de Gabriel en Asana y consulta de la regla con Katy.
