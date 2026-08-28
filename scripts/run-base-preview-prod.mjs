import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const { createPreviewBaseHandler } = await import('./src/routes/fuentesComercialesRoutes.js');

const id = process.argv[2];
if (!id) throw new Error('fuente id requerido');

const req = {
  params: { id },
  body: {},
  user: { nick: 'codex-verificacion', rol: 'admin' },
};

const res = {
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    console.log(JSON.stringify({
      status: this.statusCode,
      ok: payload?.ok,
      codigo: payload?.codigo || null,
      fecha_actualizacion_base: payload?.fecha_actualizacion_base || null,
      fecha_actualizacion_base_origen: payload?.fecha_actualizacion_base_origen || null,
      resumen: payload?.resumen || null,
      previews: payload?.previews ? Object.keys(payload.previews) : null,
    }, null, 2));
    return payload;
  },
};

await createPreviewBaseHandler()(req, res);
