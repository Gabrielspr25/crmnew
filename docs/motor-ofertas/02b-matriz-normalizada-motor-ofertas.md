# Fase 2 - Matriz normalizada para motor de ofertas

Generado: 2026-07-04 17:52:12

## Opinion tecnica

Esto no reemplaza la auditoria: la usa como evidencia. La Fase 1 contesto **que existe**. Esta Fase 2 empieza a contestar **como decide el sistema**.

La decision correcta es agregar una capa nueva de datos normalizados. El constructor actual se conserva, pero deja de ser la fuente de verdad. La fuente de verdad debe ser esta matriz y, luego, tablas equivalentes en base de datos.

## Archivo generado

- `C:\Users\Gabriel\Documentos\Programas\newcrm\docs\motor-ofertas\02b-matriz-normalizada-motor-ofertas.xlsx`

## Hojas creadas

- `productos`: familias comerciales base.
- `planes_base`: planes regulares y paquetes conocidos.
- `promociones`: beneficios/ofertas como entidades independientes.
- `condiciones`: preguntas evaluables por el motor.
- `reglas`: une promocion + condiciones + accion.
- `acciones`: que ejecuta el sistema cuando una regla aplica.
- `codigos_comerciales`: SOC, alpha, price, promo, SIF, SAP, proceso.
- `vigencias`: desde/hasta y estado operativo.
- `compatibilidad`: que se combina o se excluye.
- `prioridades`: que gana cuando dos promociones aplican.
- `excepciones`: casos especiales sin contaminar el motor.
- `conflictos`: decisiones humanas pendientes.
- `fuentes`: archivos/evidencia base.

## Reglas ya modeladas como motor

- `PROMO_3_MESES_GRATIS_MOVIL_60_PLUS`: cliente convergente + financiamiento + plan movil $60+ o primeras 2 lineas Business Red elegibles; credito en meses 2, 4 y 6.
- `PROMO_DOBLE_PROXIMA_VELOCIDAD`: convergente + 2Play/3Play + movil activo + tecnologia fija; aplica tabla de velocidad.
- `PROMO_1000_MEGAS_6_MESES`: convergente + 2Play/3Play + contrato 24 meses; 1000M temporal y luego baja segun tabla.
- `PROMO_BONO_STREAMING_10`: convergente + plan desde $35; credito $10 por BAN por 12 meses.
- `PROMO_BONO_PORTABILIDAD_FIJO`: convergente + portabilidad + contrato 24; $150 total / $6.25 por 24 meses.
- `PROMO_CLAROTV_3PLAY_DESCUENTOS`: descuento TV segun plan/velocidad/contrato 24m; pendiente normalizar tabla completa.
- `PROMO_3PLAY_CONVERGENTE`: paquete mixto fijo + internet + movil + equipos; conflicto $143.74 vs $154.99 pendiente.

## Lo importante

Esta matriz ya no esta organizada por PDF. Esta organizada por objetos que el motor puede evaluar:

`cliente -> condiciones -> reglas -> acciones -> precio/beneficio final`

## Pendiente antes de programar

1. Completar cada promocion con todas las filas de origen.
2. Resolver conflictos marcados.
3. Normalizar tablas de velocidad y ClaroTV.
4. Expandir equipos desde el Excel con IDs por equipo/oferta.
5. Validar la matriz con ejemplos reales de clientes.

No se debe conectar a UI hasta que esta matriz este validada.
