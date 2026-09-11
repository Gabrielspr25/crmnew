# Constructor v1 - validacion visual y funcional local

Fecha: 2026-08-30

Alcance validado: Constructor v1 consumiendo el Motor Comercial en modo evaluacion/simulacion local.

Limites mantenidos:
- Sin despliegue productivo.
- Sin migraciones productivas.
- Sin activar autoaplica.
- Sin reemplazar el flujo actual de propuesta definitiva.
- Sin leer PDFs, Excel ni reglas no publicadas desde el Constructor.

Base local de prueba:
- URL local: `http://localhost:4177/oferta-const.html`
- Endpoint consumido: `/api/fuentes-comerciales/planes-fijos/reglas-compuestas-publicadas/vigente`
- Version simulada publicada: `9`
- Reglas recibidas: 5 en mock visual local, con fuente y vigencia preservadas.
- Fuente mostrada: `Boletin Beneficios Convergencia Claro Full PYMES.pdf`
- Vigencia mostrada: `2026-07-23 a 2026-12-31`

Casos probados:
1. No convergente + portabilidad: sin reglas aplicadas, descartes por convergencia, producto no presente y dato no determinado.
2. Convergente + portabilidad: aplica `bono_portabilidad` y `doble_data`; descarta `bono_streaming` por incompatibilidad.
3. Renovacion convergente: aplica `descuento_porcentaje`; mantiene bloqueada la regla `beneficio_no_determinado`.
4. Linea nueva convergente: sin Benefits aplicables; todos los descartes se muestran con motivo.
5. Propuesta final de renovacion: la propuesta tradicional permanece sin sustituirse; el Motor Comercial queda como simulacion comparativa.

Evidencia visual local:
- `tmp/constructor-v1-visual/01-no-convergente-portabilidad.png`
- `tmp/constructor-v1-visual/02-convergente-portabilidad-incompatible-acumulable.png`
- `tmp/constructor-v1-visual/03-renovacion-convergente-bloqueada.png`
- `tmp/constructor-v1-visual/04-linea-nueva-convergente-sin-benefit.png`
- `tmp/constructor-v1-visual/05-propuesta-final-renovacion.png`

Errores encontrados y corregidos:
- El panel de simulacion no mostraba explicitamente equipo y mensualidad.
- El panel no mostraba estado `Bloqueada`/`Evaluable`.
- La trazabilidad visible no incluia vigencia.
- Las reglas descartadas mostraban motivo, pero no fuente/vigencia.
- Las identidades comerciales largas podian quedar apretadas dentro de tarjetas.
- El mock visual enviaba producto fijo solo con `precio_regular`; la vista espera `precio`/`precio_texto` para calcular mensualidad.

Resultado:
- El vendedor puede ver plan/precio base, equipo/mensualidad, reglas aplicadas, reglas descartadas con motivo, total base, descuento estimado, total estimado, recomendacion, alternativas y fuente/vigencia.
- `autoaplica=false` se mantiene visible y sin activacion.
- El flujo productivo anterior no fue reemplazado.

Pruebas ejecutadas:
- `node --test backend/test/constructor-motor-comercial-simulacion.test.js`
- Resultado: 6/6 aprobadas.

Riesgos pendientes:
- La evidencia visual usa mock local; antes de produccion debe repetirse contra base local equivalente cargada con las 9 reglas compuestas reales.
- El estado `Bloqueada` aparece cuando existe cualquier regla con `dato_no_determinado`, aunque haya reglas aplicables; esto respeta el bloqueo conservador aprobado.
- La propuesta final tradicional todavia no incorpora descuentos del Motor Comercial; solo se muestra comparativa en simulacion.
