# Candidatos y alternativas comerciales por linea v1

Fecha: 2026-09-01  
Proyecto: `newcrm`  
Estado: implementacion local, sin despliegue, sin migraciones.

## Objetivo

Permitir que el Motor Comercial entregue candidatos comerciales por linea para que `Consultar al asistente` pueda presentar alternativas validas sin inventar promociones.

Flujo:

```text
Consulta
-> intencion local
-> lineas pendientes
-> Motor Comercial
-> candidatos validos
-> Consulta organiza y explica
-> vendedor decide
```

La Consulta no determina elegibilidad. Solo llama al Motor y muestra resultados.

## Capa Motor

Se agrego el endpoint autenticado:

```text
POST /api/motor-ofertas/candidatos-alternativas
```

Entrada esperada:

```json
{
  "lineas": [],
  "grupos": [],
  "filtros": {
    "equipo": "Samsung Galaxy A37",
    "fabricante": "Samsung",
    "solo_gratis": true,
    "descuento_50": false,
    "presupuesto_maximo": 500,
    "plazo": 30,
    "evento": "renovacion",
    "plan_familia": "business_red_plus"
  },
  "contexto_ban": {
    "beneficios_usados_por_oferta": {}
  }
}
```

Para escenarios mixtos se puede enviar `grupos`. Cada grupo conserva sus propias lineas y filtros, y el Motor devuelve una respuesta agregada sin mezclar reglas ni fuentes.

Ejemplo local validado:

```json
{
  "grupos": [
    {
      "lineas": "5 renovaciones Business RED Extreme",
      "filtros": {
        "equipo": "iPhone 17",
        "fabricante": "apple",
        "evento": "renovacion",
        "plan_familia": "business_red_extreme"
      }
    },
    {
      "lineas": "3 renovaciones Business RED Extreme",
      "filtros": {
        "equipo": "Franklin JEXstream CG890 5G",
        "fabricante": "franklin",
        "categoria_producto": "modem",
        "evento": "renovacion",
        "plan_familia": "business_red_extreme"
      }
    }
  ]
}
```

La ruta lee exclusivamente:

- version `vigente` de `public.ofertas_movil_versiones`;
- bloque publicado `business_red_plus`;
- equipos especiales vigentes desde `public.v_equipos_vigentes`;
- reglas ya publicadas en `datos` de la version vigente.

No lee PDFs, Excel ni archivos desde la Consulta.

## Candidatos

Cada candidato confirmado conserva:

- linea y posicion;
- equipo;
- fabricante;
- categoria;
- precio regular;
- precio promocional;
- mensualidad;
- tipo de beneficio;
- descuento;
- plazo;
- price code;
- plan/familia;
- evento;
- limite BAN cuando aplica;
- cupo promocional restante cuando aplica;
- fuente/publicacion;
- vigencia;
- regla aplicada;
- `confidence`;
- `reason`;
- `autoaplica = false`.

Tambien expone para cada candidato:

- mensualidad regular;
- mensualidad neta;
- precio regular vigente;
- plazo;
- fuente vigente.

Los candidatos con `requiere_revision`, `FUENTE_AMBIGUA`, contradiccion, fuente incompleta o dato no determinado se separan en `requiere_revision`. No aparecen mezclados con recomendaciones confirmadas.

Si un equipo solicitado no tiene precio oficial publicado en las fuentes disponibles, solamente ese equipo queda en `requiere_revision` con `reason = precio_oficial_no_publicado`.

## Cupos y limite BAN

Para ofertas con `limite_ban`, el Motor recibe `contexto_ban.beneficios_usados_por_oferta`.

Regla aplicada:

- si el cupo existe y no esta agotado, el candidato conserva el beneficio;
- si el cupo esta agotado y la fuente permite financiamiento fuera del limite, el candidato queda financiado con `reason = limite_ban_excedido`;
- si el cupo esta agotado y la fuente no permite alternativa, el candidato queda bloqueado;
- cambiar de equipo no reinicia automaticamente el limite.

Para Business RED Plus con matriz por posicion, la posicion de linea se evalua contra la matriz publicada. Linea 1 y linea 5 pueden producir resultados distintos.

## Consulta

La Consulta usa `requestCommercialCandidates()` desde `constructor-publications.js` para pedir candidatos al Motor.

Recorrido local:

1. interpreta texto con `CommercialConsultationInterpreter`;
2. arma `commercialScenario`;
3. convierte lineas del escenario al contrato del Motor;
4. pide candidatos primarios por equipo/marca solicitada;
5. detecta lineas no cubiertas por beneficio promocional;
6. pide alternativas para las lineas pendientes;
7. muestra candidatos confirmados y separa `requiere_revision`;
8. no carga nada hasta que el vendedor pulse `Cargar al Constructor`.

## Filtros soportados

- equipo especifico;
- fabricante;
- solo gratis;
- 50% descuento;
- menor costo;
- mantener marca;
- presupuesto maximo;
- lineas restantes;
- plazo;
- evento;
- plan/familia.

## Ranking

El ranking es solo presentacion. No crea reglas comerciales.

Orden usado:

1. gratis;
2. menor costo mensual;
3. mayor descuento;
4. preferencia de marca;
5. nombre de equipo.

La elegibilidad siempre viene del Motor.

## Pruebas

Archivo nuevo:

- `backend/test/motor-commercial-candidates.test.js`

Casos cubiertos:

1. A37 con promocion agotada.
2. Alternativas gratis disponibles.
3. Sin alternativas gratis.
4. Solo Samsung.
5. S26 con lineas a regular.
6. Presupuesto maximo.
7. Limite BAN.
8. Linea 1 vs linea 5.
9. Renovacion.
10. Portabilidad.
11. Equipo sin promocion.
12. Candidato `FUENTE_AMBIGUA`.
13. Candidato confirmado.
14. Varias ofertas vigentes validas.
15. Business RED Extreme con 5 iPhone 17 y 3 Franklin JEXstream CG890 5G.
16. Totales agregados del escenario mixto por grupo.
17. Equipo solicitado sin precio oficial queda pendiente solo para ese equipo.

Resultado del caso mixto validado en contrato local:

- 8 candidatos confirmados.
- 0 equipos en revision.
- Plan regular: 320.
- Plan AutoPay: 240.
- Equipos regular: 168.35.
- Descuentos/creditos: 0.
- Equipos netos: 168.35.
- Total mensual regular: 488.35.
- Total mensual AutoPay: 408.35.

Tambien se mantiene la prueba de Consulta para confirmar que usa el endpoint de candidatos del Motor y no integra proveedor externo.

## Archivos modificados

- `backend/src/services/businessRedPlusEligibility.js`
- `backend/src/routes/motorOfertasRoutes.js`
- `backend/test/motor-commercial-candidates.test.js`
- `docs/constructor/candidatos-alternativas-comerciales-v1.md`

## Restricciones cumplidas

- No deploy.
- No migraciones.
- No `autoaplica=true`.
- No se quito fallback.
- No se promovio Motor.
- No se modifico calculo definitivo.
- No se inventaron promociones.
- Consulta no determina elegibilidad.
- No se agrego proveedor IA externo.
- No se resuelve `FUENTE_AMBIGUA` por inferencia.

## Riesgos pendientes

- La ruta esta preparada para Business RED Plus y portafolio movil publicado; otros dominios deben incorporarse de forma explicita cuando existan reglas publicadas equivalentes.
- El calculo de cupo restante depende de recibir `contexto_ban.beneficios_usados_por_oferta` completo desde el flujo que invoque el Motor.
- La seleccion final de candidatos todavia requiere confirmacion del vendedor; no hay autoaplicacion.
- Falta validacion visual navegada con datos locales reales antes de cualquier despliegue.
