# Modal de Asana: prioridad y agenda

Diseño autorizado por Gabriel: ampliar moderadamente el mismo checklist para
operar prioridad manual y calendario sin salir a otra ventana.

Ancho máximo 960 px y 94vw; alto máximo 82vh con desplazamiento interno. Debajo
del encabezado, controles compactos que se ajustan en móvil: prioridad vigente,
fecha, hora opcional, motivo opcional y guardar llamada. Se conserva la tabla
BAN/teléfono/equipo/estados/No renovar y notas recientes. La fecha confirmada
queda visible y no se modifica la prioridad mientras se agenda.

Fuentes: lista actual de Asana y alertas de llamadas existentes. Escrituras:
misma operación PATCH /priority y POST /log con type llamada y scheduled_call_at.
Se comparte el guardado/validación del formulario actual. No hay segunda modal,
endpoints nuevos, migraciones, reglas nuevas ni cambios contractuales.

Ampliación autorizada: `+ Nueva nota` junto a Notas recientes abre dentro del
mismo modal el campo y adjuntos existentes, le da foco y usa addAsanaLog. Tras
guardar se actualizan las notas; se conservan prioridad y borrador de llamada.

Validar render real, prioridad automática/manual, llamada futura y validación,
conservación de datos y modal, sintaxis y visualización productiva. Publicación
estática con backup, GitHub y comprobación de archivo exacto; no reinicia Katy.
