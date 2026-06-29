const filaKey = (fila) => `${String(fila.codigo).trim()}|${String(fila.alfa_code || '-').trim()}`;

const COMPARABLE_FIELDS = [
  ['precio', (row) => row.precio],
  ['descripcion', (row) => row.descripcion],
  ['tecnologia', (row) => row.tecnologia],
  ['minuto_adicional', (row) => row.minuto_adicional],
  ['instalacion.0m', (row) => row.instalacion?.['0m']],
  ['instalacion.12m', (row) => row.instalacion?.['12m']],
  ['instalacion.24m', (row) => row.instalacion?.['24m']],
  ['activacion.0m', (row) => row.activacion?.['0m']],
  ['activacion.12m', (row) => row.activacion?.['12m']],
  ['activacion.24m', (row) => row.activacion?.['24m']],
  ['penalidad', (row) => row.penalidad],
];

const normalizeComparable = (value) => value ?? '';

export function diffFilasPlanesFijos(actuales, nuevas) {
  const mapAct = new Map(actuales.map((fila) => [filaKey(fila), fila]));
  const mapNue = new Map(nuevas.map((fila) => [filaKey(fila), fila]));

  const nuevos = [];
  const ausentes = [];
  const modificados = [];
  let sinCambio = 0;

  for (const [key, nueva] of mapNue) {
    const actual = mapAct.get(key);
    if (!actual) {
      nuevos.push(nueva);
      continue;
    }

    const cambios = [];
    for (const [campo, getValue] of COMPARABLE_FIELDS) {
      const antes = normalizeComparable(getValue(actual));
      const ahora = normalizeComparable(getValue(nueva));
      if (String(antes) !== String(ahora)) cambios.push({ campo, antes, ahora });
    }

    if (cambios.length) {
      modificados.push({
        codigo: nueva.codigo,
        alfa_code: nueva.alfa_code,
        descripcion: nueva.descripcion,
        cambios,
      });
    } else {
      sinCambio++;
    }
  }

  for (const [key, actual] of mapAct) {
    if (!mapNue.has(key)) ausentes.push(actual);
  }

  return { nuevos, ausentes, modificados, sin_cambio: sinCambio };
}
