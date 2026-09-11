# Persistencia Agente Comercial por cliente/BAN - decision local

## Resultado de auditoria

La persistencia conversacional durable del Agente Comercial no puede cerrarse correctamente reutilizando una tabla existente sin mezclar responsabilidades.

Estado actual:

- La sesion local del Agente conserva `commercialScenario` y turnos en memoria del Constructor.
- `ventaspro_nuevo.sales` representa ventas/comisiones sincronizadas o registradas.
- `ventaspro_nuevo.comparativas` representa comparativas, no una conversacion comercial progresiva.
- `audit_log` registra eventos, no estado reconstruible de una sesion.
- No existe una tabla dedicada para sesiones del Constructor, turnos de Consulta, decisiones del Motor y version de reglas consultada.

## Que debe persistirse

- `session_id`
- `client_id`
- BAN
- usuario/vendedor
- modo de entrada: CRM, Manual o Agente
- `commercialScenario` vigente por turno
- texto de cada consulta
- intencion interpretada
- version del Motor Comercial consultada
- reglas/candidatos recibidos
- resultado presentado
- bloqueos comerciales
- `autoaplica=false`
- fecha de creacion y actualizacion

## Por que no conviene reutilizar tablas actuales

- Una venta no es una sesion de propuesta.
- Una comparativa no conserva turnos ni decision del Motor por version.
- Un audit log no debe ser la fuente operacional de una pantalla.
- Guardar JSON conversacional dentro de una entidad no relacionada haria dificil auditar, reabrir o invalidar sesiones por version.

## Esquema minimo recomendado

Requiere migracion futura aprobada:

```sql
CREATE TABLE constructor_agent_sessions (
  id uuid PRIMARY KEY,
  client_id text,
  ban text,
  user_id text,
  source_mode text NOT NULL,
  status text NOT NULL,
  current_scenario jsonb NOT NULL,
  motor_version_id text,
  autoaplica boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE constructor_agent_turns (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES constructor_agent_sessions(id),
  turn_index integer NOT NULL,
  query text NOT NULL,
  intent jsonb NOT NULL,
  scenario_snapshot jsonb NOT NULL,
  motor_result jsonb,
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## Alternativa sin migracion

Mantener sesion local del navegador o memoria temporal de runtime. Sirve para prueba local y validacion visual, pero no para historial auditable por cliente/BAN.

## Riesgos

- Sin tabla dedicada, una sesion no se puede reabrir con trazabilidad completa.
- Si se guarda dentro de comparativas o ventas, se mezcla propuesta, venta y auditoria.
- Si se guarda solo en audit log, no existe estado operacional reconstruible.

## Recomendacion

Marcar la persistencia durable por cliente/BAN como `bloqueado` hasta autorizar migracion especifica. Mantener el Agente local funcionando en memoria y seguir con validacion visual/local sin convertirlo en historial productivo.
