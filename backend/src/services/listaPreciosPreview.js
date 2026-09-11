function countBy(items, getKey) {
  return (items || []).reduce((counts, item) => {
    const key = getKey(item) || 'no_determinado';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function ruleTypeForEquipment(item) {
  return item.categoria === 'accesorio' ? 'precio_accesorio' : 'precio_equipo';
}

function commercialKeyForEquipment(item) {
  return [
    String(item.item_code || '').trim().toUpperCase(),
    String(item.categoria || '').trim(),
  ].filter(Boolean).join('|');
}

export function buildListaPreciosPreview({ items = [], sheetNames = [] }) {
  const reglasNormalizadas = items.map((item) => ({
    tipo_regla: ruleTypeForEquipment(item),
    familia: item.categoria || null,
    item_code: item.item_code || null,
    modelo: item.modelo || null,
    llave_comercial: commercialKeyForEquipment(item),
    valor: {
      precio_regular: item.precio_regular ?? null,
      mensualidades: item.mensualidades || [],
      pospago_precios: item.pospago_precios || [],
    },
    accion: 'mantener_o_actualizar_precio_base',
    estado_confianza: 'confirmado',
    estado_publicacion: 'borrador',
  }));

  return {
    total: items.length,
    hojas: sheetNames,
    resumen_categorias: countBy(items, (item) => item.categoria),
    reglas_normalizadas: reglasNormalizadas,
    resumen_reglas: {
      total: reglasNormalizadas.length,
      por_tipo: countBy(reglasNormalizadas, (regla) => regla.tipo_regla),
      por_confianza: countBy(reglasNormalizadas, (regla) => regla.estado_confianza),
    },
    muestra: items.slice(0, 10).map((item) => ({
      item_code: item.item_code,
      modelo: item.modelo,
      marca: item.marca,
      categoria: item.categoria,
      precio_regular: item.precio_regular,
    })),
  };
}
