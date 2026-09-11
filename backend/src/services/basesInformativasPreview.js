const PREVIEW_DEFINITIONS = Object.freeze([
  {
    categoria: 'fijo',
    pagina: 'fijos',
    included: [
      ['fijo_telefonia', 40, 'Telefonia fija'],
      ['fijo_internet_2play', 25, 'Internet fijo y 2Play'],
      ['fijo_valores_agregados_vendibles', 15, 'Valores agregados vendibles'],
      ['fijo_equipos_accesorios_internet', 1, 'Equipos y accesorios de Internet'],
    ],
  },
  {
    categoria: 'claro_tv',
    pagina: 'claro_tv',
    included: [
      ['claro_tv_planes', 6, 'Claro TV planes'],
      ['claro_tv_servicios_complementos', 3, 'Claro TV servicios complementos'],
    ],
  },
  {
    categoria: 'movil',
    pagina: 'moviles',
    included: [
      ['planes_individuales', 11, 'Planes individuales Business/PYMES', 'movil_planes_individuales'],
      ['planes_multilinea_opciones', 36, 'Planes multilinea Business RED', 'movil_multilinea_business_red'],
      ['planes_multilinea_byop_ban', 1, 'Business Red Plus BYOP-BAN', 'movil_multilinea_byop_ban'],
    ],
  },
  {
    categoria: 'inalambrico',
    pagina: 'inalambrico',
    included: [
      ['internet_on_the_go', null, "MiFi's Internet On The Go"],
      ['claro_oficina', null, 'Modems Claro Oficina'],
      ['iot_telemetria', null, 'IoT / Telemetria'],
      ['equipos_precios_inalambrico', null, 'Equipos y precios Inalambrico / IoT'],
    ],
  },
]);

const ARRAY_CATEGORIES = Object.freeze([
  'claro_tv_equipos',
  'internet_equipos_ofertas',
  'referencia_interna',
  'contenido_temporal_excluido',
  'segmento_no_incluido',
  'terminos_contrato',
  'revision_manual',
]);

const REQUIRED_ROW_FIELDS = Object.freeze(['pagina', 'categoria', 'codigo', 'descripcion']);

function rowsFor(parsed, category) {
  const rows = parsed?.modulos?.[category]?.filas;
  return Array.isArray(rows) ? rows : [];
}

function stableRow(row, sectionKey = null) {
  const normalized = {
    pagina: row.pagina,
    categoria: row.categoria,
    seccion_key: sectionKey || row.seccion_key || row.categoria,
    seccion: row.encabezado_origen || row.seccion || row.categoria,
    codigo: String(row.codigo || '').trim(),
    alfa_code: row.alfa_code ?? null,
    descripcion: String(row.descripcion || '').trim(),
    descripcion_original: row.descripcion_original || row.texto_original || row.descripcion || '',
    precio: row.precio ?? row.precio_regular ?? null,
    precio_regular: row.precio_regular ?? row.precio ?? null,
    precio_regular_descripcion: row.precio_regular_descripcion ?? null,
    tecnologia: row.tecnologia ?? null,
    minuto_adicional: row.minuto_adicional ?? null,
    instalacion: row.instalacion ?? null,
    activacion: row.activacion ?? null,
    penalidad: row.penalidad ?? null,
    descuento: row.descuento ?? null,
    familia: row.familia ?? null,
    cantidad_lineas: row.cantidad_lineas ?? null,
    cantidad_lineas_permitida: row.cantidad_lineas_permitida ?? null,
    capacidad_maxima_lineas: row.capacidad_maxima_lineas ?? null,
    capacidad_minima_lineas: row.capacidad_minima_lineas ?? null,
    modelo_cobro: row.modelo_cobro ?? null,
    requisitos_permanentes: row.requisitos_permanentes ?? [],
    caracteristicas_permanentes: row.caracteristicas_permanentes ?? [],
    segmento_no_incluido: row.segmento_no_incluido ?? null,
    promedio_10_lineas: row.promedio_10_lineas ?? null,
    promedio_no_precio_regular: row.promedio_no_precio_regular ?? null,
    encabezado_origen: row.encabezado_origen || null,
    texto_original: row.texto_original || row.descripcion_original || row.descripcion || '',
    llave_auditoria: [
      row.pagina ?? '',
      row.encabezado_origen || row.seccion || row.categoria || '',
      row.codigo || '',
      row.descripcion_original || row.texto_original || row.descripcion || '',
    ].join('|'),
  };
  normalized.trazas_auditoria = [auditTrace(normalized)];
  return normalized;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function financingForEquipment(row) {
  const financing = {};
  for (const months of [12, 24, 30, 36]) {
    const value = numberOrNull(row?.[`fin_${months}`]);
    if (value != null) financing[String(months)] = value;
  }
  return financing;
}

function cleForEquipment(row) {
  const cle = {};
  for (const months of [12, 24, 30, 36]) {
    const value = numberOrNull(row?.[`cle_${months}`]);
    if (value != null) cle[String(months)] = value;
  }
  return cle;
}

function manufacturerFromModel(model) {
  const first = String(model || '').trim().split(/\s+/)[0] || null;
  return first ? first.replace(/[^A-Za-z0-9]/g, '') || first : null;
}

function productTypeForWirelessSection(sectionKey) {
  if (sectionKey === 'internet_on_the_go') return 'mifi';
  if (sectionKey === 'claro_oficina') return 'modem';
  return 'iot';
}

function wirelessEquipmentRows(parsed) {
  const sections = Array.isArray(parsed?.secciones) ? parsed.secciones : [];
  return sections.flatMap((section) => {
    const sectionKey = String(section?.key || '').trim();
    const equipos = Array.isArray(section?.equipos) ? section.equipos : [];
    return equipos.map((equipment) => {
      const precioRegular = numberOrNull(equipment.precio_regular);
      const row = {
        pagina: equipment.pagina ?? null,
        categoria: 'inalambrico_equipo',
        seccion_key: sectionKey,
        seccion: section.titulo || sectionKey,
        codigo: String(equipment.item_code || equipment.codigo || '').trim(),
        material_sap: equipment.material_sap ?? null,
        descripcion: String(equipment.modelo || equipment.descripcion || '').trim(),
        descripcion_original: equipment.modelo || equipment.descripcion || '',
        modelo: equipment.modelo || equipment.descripcion || null,
        fabricante: equipment.fabricante || manufacturerFromModel(equipment.modelo || equipment.descripcion),
        producto: sectionKey,
        tipo_producto: productTypeForWirelessSection(sectionKey),
        tipo_registro: 'equipo',
        precio: precioRegular,
        precio_regular: precioRegular,
        financiamiento: financingForEquipment(equipment),
        cle: cleForEquipment(equipment),
        encabezado_origen: section.titulo || sectionKey,
        texto_original: equipment.texto_original || equipment.modelo || equipment.descripcion || '',
        llave_auditoria: [
          sectionKey,
          equipment.item_code || equipment.codigo || '',
          equipment.material_sap || '',
          equipment.modelo || equipment.descripcion || '',
        ].join('|'),
      };
      row.trazas_auditoria = [auditTrace(row)];
      return row;
    });
  });
}

function canonicalWirelessEquipmentRows(rows) {
  const byIdentity = new Map();
  for (const row of rows || []) {
    const identity = [
      String(row.codigo || '').trim(),
      String(row.material_sap || '').trim(),
      String(row.descripcion || '').trim().toLowerCase(),
    ].join('|');
    const existing = byIdentity.get(identity);
    if (!existing) {
      byIdentity.set(identity, {
        ...row,
        seccion_key: 'equipos_precios_inalambrico',
        productos_detectados: [row.producto].filter(Boolean),
      });
      continue;
    }
    if (row.producto && !existing.productos_detectados.includes(row.producto)) {
      existing.productos_detectados.push(row.producto);
    }
    existing.trazas_auditoria = [...(existing.trazas_auditoria || []), ...(row.trazas_auditoria || [auditTrace(row)])];
  }
  return [...byIdentity.values()].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
}

function auditTrace(row) {
  return {
    pagina: row.pagina,
    seccion_key: row.seccion_key,
    encabezado_origen: row.encabezado_origen,
    codigo: row.codigo,
    descripcion: row.descripcion,
    precio: row.precio,
    tecnologia: row.tecnologia,
    minuto_adicional: row.minuto_adicional,
    instalacion: row.instalacion,
    activacion: row.activacion,
    penalidad: row.penalidad,
    descuento: row.descuento,
    alfa_code: row.alfa_code,
    texto_original: row.texto_original,
    llave_auditoria: row.llave_auditoria,
  };
}

function applyApprovedVariant(row) {
  if (row.categoria === 'fijo_internet_2play' && row.codigo === 'A878') {
    const isBundle = /\(2L\)\s+BUNDLE/i.test(row.descripcion);
    return {
      ...row,
      identidad_variante: isBundle ? 'bundle_2l' : 'base',
      variante_descripcion: isBundle ? 'Bundle 2 lineas' : 'Plan base',
    };
  }
  return row;
}

function unionTechnology(rows) {
  const ordered = [];
  for (const row of rows) {
    for (const part of String(row.tecnologia || '').split('/').map((item) => item.trim()).filter(Boolean)) {
      if (!ordered.includes(part)) ordered.push(part);
    }
  }
  return ordered.join('/');
}

function consolidatePlanMundial(rows) {
  const target = rows.filter((row) => row.categoria === 'fijo_valores_agregados_vendibles' && row.codigo === '1186');
  if (target.length < 2) return rows;
  const otherRows = rows.filter((row) => !(row.categoria === 'fijo_valores_agregados_vendibles' && row.codigo === '1186'));
  const preferred = target.find((row) => row.tecnologia === 'COBRE/VRAD/GPON') || target[0];
  const consolidated = {
    ...preferred,
    tecnologia: unionTechnology(target),
    trazas_auditoria: target.flatMap((row) => row.trazas_auditoria || [auditTrace(row)]),
    consolidado_desde_ocurrencias: target.length,
  };
  return [...otherRows, consolidated].sort((a, b) => {
    const aIndex = Number(a.trazas_auditoria?.[0]?.pagina ?? a.pagina ?? 0);
    const bIndex = Number(b.trazas_auditoria?.[0]?.pagina ?? b.pagina ?? 0);
    if (aIndex !== bIndex) return aIndex - bIndex;
    return String(a.codigo).localeCompare(String(b.codigo));
  });
}

function transformSectionRows(sectionKey, rows) {
  const withVariants = rows.map(applyApprovedVariant);
  if (sectionKey === 'fijo_valores_agregados_vendibles') return consolidatePlanMundial(withVariants);
  return withVariants;
}

function moduleFor({ page, sectionKey, title, rows, order }) {
  return {
    pagina: page,
    seccion_key: sectionKey,
    titulo: title,
    subtitulo: `${rows.length} registros`,
    descripcion: 'Modulo generado desde fuente comercial oficial validada.',
    orden: order,
    activo: true,
    tipo: 'tabla',
    vigencia_desde: sourceDateOnly(rows?.[0]?.vigencia_desde ?? null),
    vigencia_hasta: sourceDateOnly(rows?.[0]?.vigencia_hasta ?? null),
    contenido: {
      filas: rows,
      total_filas: rows.length,
    },
  };
}

function sourceDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function withSourceValidity(row, fuente) {
  return {
    ...row,
    vigencia_desde: sourceDateOnly(fuente?.vigencia_desde),
    vigencia_hasta: sourceDateOnly(fuente?.vigencia_hasta),
  };
}

function wirelessModuleFor({ sectionKey, title, rows, order, parsed, fuente }) {
  return {
    pagina: 'inalambrico',
    seccion_key: sectionKey,
    titulo: title,
    subtitulo: `${rows.length} registros`,
    descripcion: 'Modulo generado desde fuente comercial oficial validada.',
    orden: order,
    activo: true,
    tipo: 'tabla',
    vigencia_desde: sourceDateOnly(fuente?.vigencia_desde),
    vigencia_hasta: sourceDateOnly(fuente?.vigencia_hasta),
    contenido: {
      filas: rows,
      total_filas: rows.length,
      financiamiento_of: parsed?.financiamiento_of || [],
      financiamiento_gu: parsed?.financiamiento_gu || [],
      ofertas_especiales: parsed?.ofertas_especiales || [],
      ofertas_especiales_normalizadas: parsed?.ofertas_especiales_normalizadas || [],
      secciones_detectadas: parsed?.secciones_detectadas || [],
    },
  };
}

function ruleTypeForRow(row) {
  if (row.categoria === 'inalambrico_equipo' && row.tipo_registro === 'equipo') return 'precio_regular_equipo';
  if (row.categoria === 'inalambrico_promocion') return 'promocion_equipo';
  if (row.categoria === 'fijo_equipos_accesorios_internet') return 'accesorio';
  if (String(row.categoria || '').includes('valores_agregados')) return 'beneficio';
  return 'estructura_base';
}

function ruleActionForType(tipoRegla) {
  if (tipoRegla === 'estructura_base') return 'mantener_o_actualizar_base';
  if (tipoRegla === 'beneficio') return 'publicar_beneficio_base';
  if (tipoRegla === 'accesorio') return 'publicar_accesorio_base';
  if (tipoRegla === 'precio_regular_equipo') return 'publicar_precio_regular_equipo';
  return 'requiere_revision';
}

function commercialKeyForRule(row, sectionKey) {
  return [
    String(row.categoria || '').trim(),
    String(sectionKey || row.seccion_key || '').trim(),
    String(row.codigo || '').trim(),
    String(row.identidad_variante || '').trim(),
  ].filter(Boolean).join('|');
}

function normalizedRuleFromRow({ row, sectionKey, fuente }) {
  const tipoRegla = ruleTypeForRow(row);
  return {
    fuente_comercial_id: fuente.id || null,
    seccion_origen: row.encabezado_origen || row.seccion || sectionKey,
    tipo_regla: tipoRegla,
    familia: row.categoria || null,
    producto: row.descripcion || null,
    codigo: row.codigo || null,
    nombre: row.descripcion || null,
    llave_comercial: commercialKeyForRule(row, sectionKey),
    valor: {
      precio_regular: row.precio_regular ?? row.precio ?? null,
      precio: row.precio ?? row.precio_regular ?? null,
      financiamiento: row.financiamiento ?? null,
      cle: row.cle ?? null,
      material_sap: row.material_sap ?? null,
      producto: row.producto ?? null,
      tecnologia: row.tecnologia ?? null,
      minuto_adicional: row.minuto_adicional ?? null,
      instalacion: row.instalacion ?? null,
      activacion: row.activacion ?? null,
      penalidad: row.penalidad ?? null,
    },
    condiciones: {
      requisitos: row.requisitos_permanentes ?? [],
      caracteristicas: row.caracteristicas_permanentes ?? [],
      cantidad_lineas: row.cantidad_lineas ?? null,
      modelo_cobro: row.modelo_cobro ?? null,
    },
    accion: ruleActionForType(tipoRegla),
    prioridad: 10,
    vigencia_desde: sourceDateOnly(row.vigencia_desde),
    vigencia_hasta: sourceDateOnly(row.vigencia_hasta),
    estado_confianza: 'confirmado',
    estado_publicacion: 'borrador',
    estado_comercial: 'vigente',
    traza: {
      fuente_nombre: fuente.nombre_original || fuente.titulo || null,
      fuente_sha256: fuente.sha256 || null,
      seccion_origen: row.encabezado_origen || row.seccion || sectionKey,
      pagina: row.pagina ?? null,
      texto_original: row.texto_original || null,
      llave_auditoria: row.llave_auditoria || null,
    },
  };
}

function normalizedRulesForModules(modules, fuente) {
  return (modules || []).flatMap((module) => (
    (module.contenido?.filas || []).map((row) => normalizedRuleFromRow({
      row,
      sectionKey: module.seccion_key,
      fuente,
    }))
  ));
}

function countBy(items, getKey) {
  return (items || []).reduce((counts, item) => {
    const key = getKey(item) || 'no_determinado';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function rulesSummary(reglasNormalizadas) {
  return {
    total: reglasNormalizadas.length,
    por_tipo: countBy(reglasNormalizadas, (regla) => regla.tipo_regla),
    por_confianza: countBy(reglasNormalizadas, (regla) => regla.estado_confianza),
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function recordIdentity(row, sectionKey) {
  const identity = [
    String(row?.categoria || '').trim(),
    String(sectionKey || row?.seccion_key || '').trim(),
    String(row?.codigo || '').trim(),
  ];
  if (row?.identidad_variante) identity.push(String(row.identidad_variante).trim());
  return identity.join('|');
}

function commercialRecord(row, sectionKey) {
  const comparable = {};
  for (const key of Object.keys(row || {}).sort()) {
    if ([
      'pagina',
      'posicion',
      'fila',
      'seccion',
      'seccion_key',
      'encabezado_origen',
      'texto_original',
      'llave_auditoria',
      'trazas_auditoria',
      'fila_auditoria',
      'llave_normalizada',
      'descripcion_original',
    ].includes(key)) continue;
    comparable[key] = row[key];
  }
  comparable.categoria = row?.categoria || '';
  comparable.codigo = row?.codigo || '';
  comparable.seccion_key = sectionKey || row?.seccion_key || '';
  comparable.precio = row?.precio ?? row?.precio_regular ?? null;
  comparable.precio_regular = row?.precio_regular ?? row?.precio ?? null;
  comparable.caracteristicas_permanentes = row?.caracteristicas_permanentes ?? [];
  comparable.requisitos_permanentes = row?.requisitos_permanentes ?? [];
  if (row?.identidad_variante) comparable.identidad_variante = row.identidad_variante;
  return comparable;
}

function comparableFieldValue(row, field) {
  return commercialRecord(row, row?.seccion_key)[field] ?? null;
}

function sortRowsForCompare(rows, sectionKey) {
  return [...(rows || [])].sort((a, b) => recordIdentity(a, sectionKey).localeCompare(recordIdentity(b, sectionKey)));
}

function normalizeModuleForCompare(modulo) {
  const content = { ...(modulo.contenido || {}) };
  if (Array.isArray(content.filas)) {
    content.filas = sortRowsForCompare(content.filas, modulo.seccion_key).map((row) => commercialRecord(row, modulo.seccion_key));
  }
  return {
    pagina: modulo.pagina,
    seccion_key: modulo.seccion_key,
    titulo: modulo.titulo,
    subtitulo: modulo.subtitulo,
    descripcion: modulo.descripcion,
    orden: modulo.orden,
    tipo: modulo.tipo,
    contenido: content,
  };
}

function moduleComparable(modulo) {
  return canonicalJson(normalizeModuleForCompare(modulo));
}

export function diffModulosGenerados(previousModules = [], currentModules = []) {
  const previous = new Map((previousModules || []).map((module) => [module.seccion_key, module]));
  const current = new Map((currentModules || []).map((module) => [module.seccion_key, module]));
  const nuevos = [];
  const modificados = [];
  const eliminados = [];
  const sinCambios = [];

  for (const module of currentModules || []) {
    const prior = previous.get(module.seccion_key);
    if (!prior) {
      nuevos.push({ seccion_key: module.seccion_key });
    } else if (moduleComparable(prior) !== moduleComparable(module)) {
      modificados.push({ seccion_key: module.seccion_key });
    } else {
      sinCambios.push({ seccion_key: module.seccion_key });
    }
  }

  for (const module of previousModules || []) {
    if (!current.has(module.seccion_key)) eliminados.push({ seccion_key: module.seccion_key });
  }

  return {
    nuevos,
    modificados,
    eliminados,
    sin_cambios: sinCambios,
    resumen: {
      nuevos: nuevos.length,
      modificados: modificados.length,
      eliminados: eliminados.length,
      sin_cambios: sinCambios.length,
    },
  };
}

function flattenModuleRows(modules = []) {
  return (modules || []).flatMap((module) => (
    (module?.contenido?.filas || []).map((row) => ({
      identity: recordIdentity(row, module.seccion_key),
      sectionKey: module.seccion_key,
      row,
    }))
  ));
}

function mapRowsByIdentity(items) {
  return new Map(items.map((item) => [item.identity, item]));
}

function changedFields(before, after) {
  const beforeRecord = commercialRecord(before.row, before.sectionKey);
  const afterRecord = commercialRecord(after.row, after.sectionKey);
  const fields = [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])].sort();
  return fields
    .filter((field) => field !== 'precio_regular' || 'precio_regular' in before.row || 'precio_regular' in after.row)
    .filter((field) => canonicalJson(beforeRecord[field] ?? null) !== canonicalJson(afterRecord[field] ?? null))
    .map((field) => ({ campo: field, antes: beforeRecord[field] ?? null, ahora: afterRecord[field] ?? null }));
}

export function diffRegistrosGenerados(previousModules = [], currentModules = []) {
  const previousRows = flattenModuleRows(previousModules).sort((a, b) => a.identity.localeCompare(b.identity));
  const currentRows = flattenModuleRows(currentModules).sort((a, b) => a.identity.localeCompare(b.identity));
  const previous = mapRowsByIdentity(previousRows);
  const current = mapRowsByIdentity(currentRows);
  const nuevos = [];
  const modificados = [];
  const eliminados = [];
  const sinCambios = [];

  for (const item of currentRows) {
    const prior = previous.get(item.identity);
    if (!prior) {
      nuevos.push({ identidad: item.identity, registro: item.row });
      continue;
    }
    const cambios = changedFields(prior, item);
    if (cambios.length) {
      modificados.push({ identidad: item.identity, codigo: item.row.codigo, categoria: item.row.categoria, seccion_key: item.sectionKey, cambios });
    } else {
      sinCambios.push({ identidad: item.identity, codigo: item.row.codigo, categoria: item.row.categoria, seccion_key: item.sectionKey });
    }
  }

  for (const item of previousRows) {
    if (!current.has(item.identity)) eliminados.push({ identidad: item.identity, registro: item.row });
  }

  return {
    nuevos,
    modificados,
    eliminados,
    sin_cambios: sinCambios,
    resumen: {
      total_anterior: previousRows.length,
      nuevos: nuevos.length,
      modificados: modificados.length,
      eliminados: eliminados.length,
      sin_cambios: sinCambios.length,
      total_actual: currentRows.length,
    },
  };
}

function previousModulesFor(publicacionesAnteriores, category) {
  const previous = publicacionesAnteriores?.[category];
  if (Array.isArray(previous)) return previous;
  if (Array.isArray(previous?.modulos_generados)) return previous.modulos_generados;
  return [];
}

function excludedRows(parsed) {
  return ARRAY_CATEGORIES.flatMap((category) => rowsFor(parsed, category).map((row) => stableRow(row, category)));
}

function auditReferenceRows(parsed) {
  return rowsFor(parsed, 'referencia_operativa').map((row) => stableRow(row, 'referencia_operativa'));
}

function auditSources(parsed, fuente) {
  const parsedSources = Array.isArray(parsed?.fuentes) ? parsed.fuentes : [];
  const sources = parsedSources.length ? parsedSources : [fuente];
  return sources.map((source) => ({
    id: source?.id || null,
    nombre_original: source?.nombre_original || source?.titulo || null,
    sha256: source?.sha256 || null,
  }));
}

function validateCommon({ parsed, fuente, candidates, modules, expectedTotal }) {
  const errors = [];
  const warnings = [];
  const parserErrors = Array.isArray(parsed?.errores) ? parsed.errores : [];
  const revisionManual = rowsFor(parsed, 'revision_manual');

  if (parserErrors.length) errors.push({ codigo: 'errores_parser', total: parserErrors.length, detalle: parserErrors });
  if (revisionManual.length) errors.push({ codigo: 'revision_manual', total: revisionManual.length });
  if (!fuente?.fecha_actualizacion_base) errors.push({ codigo: 'fecha_actualizacion_base_requerida' });
  if (!/^[0-9a-f]{64}$/i.test(String(fuente?.sha256 || ''))) errors.push({ codigo: 'hash_fuente_invalido' });
  if (candidates.length !== expectedTotal) {
    errors.push({ codigo: 'conteo_preview_invalido', esperado: expectedTotal, encontrado: candidates.length });
  }

  const moduleKeys = modules.map((module) => module.seccion_key);
  const duplicateModules = moduleKeys.filter((key, index) => moduleKeys.indexOf(key) !== index);
  if (duplicateModules.length) {
    errors.push({ codigo: 'modulos_duplicados', secciones: [...new Set(duplicateModules)] });
  }

  const rowIdentityCounts = new Map();
  for (const module of modules) {
    for (const row of module.contenido?.filas || []) {
      const identity = recordIdentity(row, module.seccion_key);
      rowIdentityCounts.set(identity, (rowIdentityCounts.get(identity) || 0) + 1);
    }
  }
  const duplicateRowIdentities = [...rowIdentityCounts.entries()].filter(([, count]) => count > 1).map(([identity]) => identity);
  if (duplicateRowIdentities.length) {
    errors.push({ codigo: 'identidad_registro_duplicada', identidades: duplicateRowIdentities });
  }

  for (const row of candidates) {
    for (const field of REQUIRED_ROW_FIELDS) {
      if (row[field] == null || String(row[field]).trim() === '') {
        errors.push({ codigo: 'campo_obligatorio_ausente', campo: field, seccion: row.categoria, llave_auditoria: row.llave_auditoria });
      }
    }
  }

  const normalizedTotal = Number(parsed?.registros_normalizados_total ?? 0);
  const auditedTotal = Number(parsed?.auditoria_original?.total_filas ?? 0);
  const exactDuplicates = Number(parsed?.auditoria_original?.duplicados_exactos_total ?? 0);
  if (normalizedTotal + exactDuplicates !== auditedTotal) {
    errors.push({
      codigo: 'conteos_no_reconcilian',
      registros_normalizados: normalizedTotal,
      duplicados_exactos: exactDuplicates,
      filas_auditadas: auditedTotal,
    });
  }

  const temporal = rowsFor(parsed, 'contenido_temporal_excluido');
  if (temporal.length) warnings.push({ codigo: 'contenido_temporal_excluido', total: temporal.length });

  return { errors, warnings };
}

function buildPreview(definition, parsed, fuente, publicacionesAnteriores) {
  if (definition.categoria === 'inalambrico') return buildWirelessPreview(definition, parsed, fuente, publicacionesAnteriores);

  const validationErrors = [];
  const candidates = [];
  const modules = [];
  const included = [];
  let order = 10;

  for (const [sourceKey, expectedCount, title, moduleKey = sourceKey] of definition.included) {
    const rows = transformSectionRows(moduleKey, rowsFor(parsed, sourceKey).map((row) => withSourceValidity(stableRow(row, moduleKey), fuente)));
    included.push(moduleKey);
    if (rows.length !== expectedCount) {
      validationErrors.push({
        codigo: 'conteo_categoria_invalido',
        categoria: moduleKey,
        esperado: expectedCount,
        encontrado: rows.length,
      });
    }
    candidates.push(...rows);
    modules.push(moduleFor({ page: definition.pagina, sectionKey: moduleKey, title, rows, order }));
    order += 10;
  }

  const expectedTotal = definition.included.reduce((total, item) => total + item[1], 0);
  const common = validateCommon({ parsed, fuente, candidates, modules, expectedTotal });
  const errors = [...validationErrors, ...common.errors];
  const previousModules = previousModulesFor(publicacionesAnteriores, definition.categoria);
  const reglasNormalizadas = normalizedRulesForModules(modules, fuente);
  const resumenReglas = rulesSummary(reglasNormalizadas);

  return {
    categoria: definition.categoria,
    pagina: definition.pagina,
    estado_sugerido: errors.length ? 'bloqueada' : 'borrador',
    publicable: errors.length === 0,
    fuente_comercial_id: fuente.id || null,
    fuente_nombre: fuente.nombre_original || fuente.titulo || null,
    fuente_sha256: fuente.sha256,
    fecha_actualizacion_base: fuente.fecha_actualizacion_base || null,
    registros_normalizados: candidates,
    reglas_normalizadas: reglasNormalizadas,
    resumen_reglas: resumenReglas,
    candidatos_publicos: candidates,
    modulos_generados: modules,
    contenido_excluido: excludedRows(parsed),
    auditoria: {
      original: parsed?.auditoria_original || {},
      categorias_incluidas: included,
      referencia_operativa: auditReferenceRows(parsed),
      fuentes: auditSources(parsed, fuente),
      reglas_normalizadas: reglasNormalizadas,
    },
    duplicados: parsed?.auditoria_original?.duplicados_exactos || [],
    validacion: {
      errores: errors,
      advertencias: common.warnings,
    },
    diferencias: {
      modulos: diffModulosGenerados(previousModules, modules),
      registros: diffRegistrosGenerados(previousModules, modules),
    },
    resumen: {
      total_candidatos: candidates.length,
      total_modulos: modules.length,
      categorias_incluidas: included,
      contenido_excluido: excludedRows(parsed).length,
    },
  };
}

function buildWirelessPreview(definition, parsed, fuente, publicacionesAnteriores) {
  const expectedSections = ['internet_on_the_go', 'claro_oficina', 'iot_telemetria'];
  const detected = Array.isArray(parsed?.secciones_detectadas) ? parsed.secciones_detectadas : [];
  const errors = [];
  const warnings = [];
  for (const section of expectedSections) {
    if (!detected.includes(section)) errors.push({ codigo: 'seccion_inalambrica_ausente', seccion: section });
  }

  const sectionRows = wirelessEquipmentRows(parsed).map((row) => withSourceValidity(row, fuente));
  const candidates = canonicalWirelessEquipmentRows(sectionRows);
  if (!candidates.length) errors.push({ codigo: 'sin_equipos_inalambricos_publicables' });
  if (!fuente?.fecha_actualizacion_base) errors.push({ codigo: 'fecha_actualizacion_base_requerida' });
  if (!/^[0-9a-f]{64}$/i.test(String(fuente?.sha256 || ''))) errors.push({ codigo: 'hash_fuente_invalido' });

  const requiredWirelessFields = ['categoria', 'codigo', 'descripcion'];
  for (const row of candidates) {
    for (const field of requiredWirelessFields) {
      if (row[field] == null || String(row[field]).trim() === '') {
        errors.push({ codigo: 'campo_obligatorio_ausente', campo: field, seccion: row.categoria, llave_auditoria: row.llave_auditoria });
      }
    }
  }

  const rowsBySection = new Map();
  for (const row of sectionRows) {
    const current = rowsBySection.get(row.producto) || [];
    current.push(row);
    rowsBySection.set(row.producto, current);
  }

  const modules = [
    wirelessModuleFor({ sectionKey: 'internet_on_the_go', title: "MiFi's Internet On The Go", rows: rowsBySection.get('internet_on_the_go') || [], order: 10, parsed, fuente }),
    wirelessModuleFor({ sectionKey: 'claro_oficina', title: 'Modems Claro Oficina', rows: rowsBySection.get('claro_oficina') || [], order: 20, parsed, fuente }),
    wirelessModuleFor({ sectionKey: 'iot_telemetria', title: 'IoT / Telemetria', rows: rowsBySection.get('iot_telemetria') || [], order: 30, parsed, fuente }),
    wirelessModuleFor({ sectionKey: 'equipos_precios_inalambrico', title: 'Equipos y precios Inalambrico / IoT', rows: candidates, order: 40, parsed, fuente }),
  ];

  const moduleKeys = modules.map((module) => module.seccion_key);
  const duplicateModules = moduleKeys.filter((key, index) => moduleKeys.indexOf(key) !== index);
  if (duplicateModules.length) {
    errors.push({ codigo: 'modulos_duplicados', secciones: [...new Set(duplicateModules)] });
  }

  const previousModules = previousModulesFor(publicacionesAnteriores, definition.categoria);
  const reglasNormalizadas = normalizedRulesForModules([modules[3]], fuente);
  const resumenReglas = rulesSummary(reglasNormalizadas);

  return {
    categoria: definition.categoria,
    pagina: definition.pagina,
    estado_sugerido: errors.length ? 'bloqueada' : 'borrador',
    publicable: errors.length === 0,
    fuente_comercial_id: fuente.id || null,
    fuente_nombre: fuente.nombre_original || fuente.titulo || null,
    fuente_sha256: fuente.sha256,
    fecha_actualizacion_base: fuente.fecha_actualizacion_base || null,
    registros_normalizados: candidates,
    reglas_normalizadas: reglasNormalizadas,
    resumen_reglas: resumenReglas,
    candidatos_publicos: candidates,
    modulos_generados: modules,
    contenido_excluido: [],
    auditoria: {
      original: parsed?.auditoria_original || {},
      categorias_incluidas: modules.map((module) => module.seccion_key),
      fuentes: auditSources(parsed, fuente),
      reglas_normalizadas: reglasNormalizadas,
    },
    duplicados: [],
    validacion: {
      errores: errors,
      advertencias: warnings,
    },
    diferencias: {
      modulos: diffModulosGenerados(previousModules, modules),
      registros: diffRegistrosGenerados(previousModules, modules),
    },
    resumen: {
      total_candidatos: candidates.length,
      total_modulos: modules.length,
      categorias_incluidas: modules.map((module) => module.seccion_key),
      contenido_excluido: 0,
    },
  };
}

function definitionHasRows(definition, parsed) {
  if (definition.categoria === 'inalambrico') return wirelessEquipmentRows(parsed).length > 0 || (parsed?.secciones_detectadas || []).includes('internet_on_the_go');
  return definition.included.some(([sourceKey]) => rowsFor(parsed, sourceKey).length > 0);
}

export function buildBasesInformativasPreviews({ parsed, fuente, publicacionesAnteriores = {} }) {
  if (!parsed || typeof parsed !== 'object') throw new Error('parsed requerido');
  if (!fuente || typeof fuente !== 'object') throw new Error('fuente requerida');

  const previews = PREVIEW_DEFINITIONS
    .filter((definition) => definitionHasRows(definition, parsed))
    .map((definition) => (
      buildPreview(definition, parsed, fuente, publicacionesAnteriores)
    ));

  return {
    fuente: {
      id: fuente.id || null,
      nombre_original: fuente.nombre_original || fuente.titulo || null,
      sha256: fuente.sha256,
      fecha_actualizacion_base: fuente.fecha_actualizacion_base || null,
      vigencia_desde: sourceDateOnly(fuente.vigencia_desde),
      vigencia_hasta: sourceDateOnly(fuente.vigencia_hasta),
    },
    previews,
  };
}
