# API de seguimiento para Katy

Gabriel solicita comenzar la API del CRM que un plugin pueda consumir. Audiencia se conserva. Alcance inicial: consultar proyectos y ramas de seguimiento, actualizar campos operativos de una rama y registrar una decisión/nota vinculada. No permite modificar clientes, ofertas, cuotas, ventas o metas ni borrar registros.

Reutiliza el almacenamiento privado de Audiencia, su validación, revisión y auditoría. Cada escritura exige la revisión previamente leída, preserva el resto del documento y obtiene el autor de la autenticación del servidor, nunca del cuerpo del cliente.

API versionada independiente de la pantalla: GET /projects; GET /nodes con proyecto opcional; GET /nodes/:id; PATCH /nodes/:id; POST /nodes/:id/notes. Las notas quedan como decisiones del seguimiento. Lectura requiere tracking:read; escritura tracking:write. Errores 400/401/403/404/409 explícitos y Cache-Control no-store.

El router exige un autorizador inyectado que establezca identidad y permisos en cada petición. No utiliza el token personal de Gabriel como identidad de Katy. El adaptador de autenticación y el transporte MCP del plugin son piezas separadas; no se declara conexión productiva de Katy por construir estas rutas. No se monta ni publica una API con autenticación simulada.

Pruebas HTTP con almacenamiento real aislado: denegación sin credencial, scopes, filtros, preservación, conflicto, autor e historial. Sin lecturas/escrituras de datos privados reales ni cambios de schema.

Documentación oficial consultada: https://developers.openai.com/plugins/build/mcp-server y https://developers.openai.com/plugins/build/plugins. El plugin usa MCP; la API REST por sí sola no acredita instalación ni conexión. Autenticación de usuario del plugin requiere completar el flujo compatible con su cliente.
