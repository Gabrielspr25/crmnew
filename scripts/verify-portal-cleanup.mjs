const base = 'http://127.0.0.1:4001';

async function getJson(path) {
  const response = await fetch(`${base}${path}`);
  return response.json();
}

const health = await getJson('/api/health');
const fijos = await getJson('/api/planes-modulos/fijos');
const tv = await getJson('/api/planes-modulos/claro_tv');
const moviles = await getJson('/api/planes-modulos/moviles');

const mobileKeys = (moviles.modulos || []).map((module) => module.seccion_key);
const legacy = mobileKeys.filter((key) => /^business_red_(plus|extreme|supreme|sin_fronteras)$/.test(key));

console.log(JSON.stringify({
  health,
  fijos: {
    ok: fijos.ok,
    modulos: (fijos.modulos || []).length,
    publicacion: Boolean(fijos.publicacion),
    primero: fijos.modulos?.[0]?.titulo || null,
  },
  claro_tv: {
    ok: tv.ok,
    error: tv.error || null,
    modulos: (tv.modulos || []).length,
    publicacion: Boolean(tv.publicacion),
    primero: tv.modulos?.[0]?.titulo || null,
  },
  moviles: {
    ok: moviles.ok,
    modulos: mobileKeys.length,
    legacy,
    keys: mobileKeys,
  },
}, null, 2));
