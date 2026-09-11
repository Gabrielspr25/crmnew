import { parseRangoVigencia } from './vigenciaTexto.js';

export const AFFINITY_DOMINIO = 'affinity_benefits';
export const AFFINITY_NORMALIZADOR_VERSION = 'affinity-benefits-compuestas-v1';

const ACCENTS = /[̀-ͯ]/g;

// El boletin Affinity separa por servicio: una seccion de oferta y una de terminos por Movil y por Fijo,
// mas paginas de procedimiento de venta que no son reglas comerciales.
const SERVICIOS = [
  { producto: 'movil', etiqueta: 'Movil', patrones: [/\bmovil\b/, /update plus/, /financiamiento/, /internet on ?the ?go/] },
  { producto: 'fijo', etiqueta: 'Fijo', patrones: [/\bfijo\b/, /2 ?play/, /3 ?play/, /gpon/, /vrad/] },
];

const PROCEDIMIENTO = /procedimiento|canal directo:|canal indirecto:|representante de ventas|proceso de venta|boletin procesos/;

function text(value) {
  return String(value ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function fold(value) {
  return text(value).normalize('NFD').replace(ACCENTS, '').toLowerCase();
}

// La extraccion de PDF pega palabras ("AFFINITYde", "desde$45.00", "NOpuede"); se separan antes de leer.
// Se conservan los saltos de linea: los terminos del boletin se leen linea por linea.
function despegar(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
    .replace(/([A-ZÁÉÍÓÚÑ]{2,})([a-záéíóúñ])/g, '$1 $2')
    .replace(/([a-zA-ZáéíóúñÁÉÍÓÚÑ])(\$)/g, '$1 $2')
    .replace(/[ \t]+/g, ' ');
}

function unaLinea(value) {
  return despegar(value).replace(/\s+/g, ' ');
}

function splitPages(rawText) {
  const source = String(rawText || '');
  if (!source.trim()) return [];
  const parts = source.split(/===== PAGE\s+(\d+)\s+=====/i);
  if (parts.length === 1) return [{ page: null, text: source }];
  const pages = [];
  for (let index = 1; index < parts.length; index += 2) {
    pages.push({ page: Number(parts[index]), text: parts[index + 1] || '' });
  }
  return pages;
}

function detectVigencia(rawText) {
  const parsed = parseRangoVigencia(unaLinea(rawText));
  return parsed ? { desde: parsed.desde, hasta: parsed.hasta } : { desde: null, hasta: null };
}

function servicioDePagina(pageText) {
  const source = fold(unaLinea(pageText));
  const scores = SERVICIOS.map((servicio) => ({
    ...servicio,
    score: servicio.patrones.reduce((total, pattern) => total + (pattern.test(source) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  return scores[0].score > 0 && scores[0].score > (scores[1]?.score || 0) ? scores[0] : null;
}

function esProcedimiento(pageText) {
  const source = fold(unaLinea(pageText));
  if (!PROCEDIMIENTO.test(source)) return false;
  return !/terminos y condiciones|% de descuento|oferta:/.test(source);
}

// Lineas numeradas ("1. ...") o con vinieta ("• ..."), que es como el boletin lista terminos y condiciones.
function itemsDeTexto(pageText) {
  const lineas = despegar(pageText).split('\n').map((line) => text(line)).filter(Boolean);
  const items = [];
  let actual = null;
  for (const linea of lineas) {
    const numerado = linea.match(/^(\d{1,2})\.\s+(.*)$/);
    const vineta = linea.match(/^[•·▪-]\s*(.*)$/);
    if (numerado) {
      if (actual) items.push(actual);
      actual = { orden: Number(numerado[1]), texto: numerado[2], numerado: true };
    } else if (vineta) {
      // Una vinieta bajo un punto numerado es su detalle (ej. el desglose de pago adelantado), no un termino nuevo.
      if (actual?.numerado) actual.texto = `${actual.texto} ${vineta[1]}`.trim();
      else {
        if (actual) items.push(actual);
        actual = { orden: items.length + 1, texto: vineta[1] };
      }
    } else if (actual) {
      actual.texto = `${actual.texto} ${linea}`.trim();
    }
  }
  if (actual) items.push(actual);
  return items.filter((item) => item.texto.length > 3);
}

function porcentajeDescuento(pageText) {
  const source = unaLinea(pageText);
  const match = source.match(/(\d{1,3})\s*%\s*de\s*descuento/i) || source.match(/descuento[^.]{0,40}?(\d{1,3})\s*%/i);
  return match ? Number(match[1]) : null;
}

function codigoAffinity(pageText) {
  const source = unaLinea(pageText);
  const explicito = source.match(/c[oó]digo[^:.\n]{0,40}:\s*([A-Z][A-Z0-9]{3,})/i);
  if (explicito) return explicito[1].toUpperCase();
  const inline = source.match(/\b(AFFINITY\s?\d{1,3})\b/i);
  return inline ? inline[1].replace(/\s+/g, '').toUpperCase() : null;
}

function codigosFacturacion(pageText) {
  const source = unaLinea(pageText);
  if (!/descuento/i.test(source)) return [];
  const codes = [...source.matchAll(/\b(\d{4}(?:TV)?)\b/gi)]
    .map((match) => match[1].toUpperCase())
    .filter((code) => /^\d{4}(TV)?$/.test(code) && !/^(19|20)\d{2}$/.test(code.replace(/TV$/, '')));
  return [...new Set(codes)];
}

// "a plazos de 20, 24, 30 o 36 meses" / "Aplica a: 0, 12 y 24 meses de contrato"
const LISTA_MESES = '((?:\\d{1,2}\\s*(?:,|y|o)?\\s*)+)';

function plazosMeses(source) {
  const lista = source.match(new RegExp(`plazos?\\s+de\\s+${LISTA_MESES}meses`, 'i'))
    || source.match(new RegExp(`(?:aplica a:?|t[eé]rminos? (?:de|en))\\s*${LISTA_MESES}meses`, 'i'));
  if (!lista) return [];
  return [...new Set((lista[1].match(/\d{1,2}/g) || []).map(Number))].sort((a, b) => a - b);
}

function planesMinimos(source) {
  const planes = {};
  const smartphone = source.match(/desde\s*\$\s*(\d+(?:\.\d+)?)[^.]{0,60}?smartphone/i);
  if (smartphone) planes.smartphone = Number(smartphone[1]);
  const iotg = source.match(/desde\s*\$\s*(\d+(?:\.\d+)?)[^.]{0,80}?internet on ?the ?go/i);
  if (iotg) planes.internet_on_the_go = Number(iotg[1]);
  const familiar = source.match(/l[ií]neas? familiares[^.]{0,80}?superior a\s*\$\s*(\d+(?:\.\d+)?)/i);
  if (familiar) planes.linea_familiar = Number(familiar[1]);
  return planes;
}

const TECNOLOGIAS_FIJO = [{ tecnologia: 'cobre_vrad' }, { tecnologia: 'gpon' }];

// El boletin nombra la velocidad minima de dos formas: "GPON en velocidades de 50 megas" y, en la regla de
// exclusion, "menos de 100M en GPON". Se recogen todas las menciones con su ubicacion y su sentido para que
// una contradiccion quede documentada con su evidencia; el motor no elige cual vale.
const TEC_TOKEN = /\b(gpon|cobre\s*\/?\s*vrad|vrad|cobre)\b/gi;

function tecnologiaCanonica(token) {
  return /gpon/i.test(token) ? 'gpon' : 'cobre_vrad';
}

// Cada velocidad se asigna a la tecnologia que la nombra: primero mirando si dice "N megas en GPON",
// y si no, tomando la tecnologia mas cercana mencionada antes del numero. Asi "menos de 10M en VRAD y
// menos de 100M en GPON" queda como 10 para VRAD y 100 para GPON.
function mencionesVelocidad(texto, origen) {
  const source = String(texto || '');
  const menciones = [];
  for (const match of source.matchAll(/(\d{1,4})\s*(?:megas|mb|m)\b/gi)) {
    const megas = Number(match[1]);
    const inicio = match.index ?? 0;
    const despues = source.slice(inicio + match[0].length, inicio + match[0].length + 30);
    const antes = source.slice(Math.max(0, inicio - 80), inicio);

    const explicita = despues.match(/^\s*(?:en|de)\s+(gpon|cobre\s*\/?\s*vrad|vrad|cobre)\b/i);
    let tecnologia = explicita ? tecnologiaCanonica(explicita[1]) : null;
    if (!tecnologia) {
      const previas = [...antes.matchAll(TEC_TOKEN)];
      if (previas.length) tecnologia = tecnologiaCanonica(previas[previas.length - 1][1]);
    }
    if (!tecnologia) continue;

    menciones.push({
      tecnologia,
      megas,
      origen,
      sentido: /menos de\s*$/i.test(antes) ? 'excluye_debajo_de' : 'aplica_desde',
      texto: text(`${antes.slice(-40)}${match[0]}${explicita ? explicita[0] : ''}`).slice(-110),
    });
  }
  return menciones;
}

function tecnologias(ofertaText, terminosText) {
  const todas = [
    ...mencionesVelocidad(ofertaText, 'oferta'),
    ...mencionesVelocidad(terminosText, 'terminos'),
  ];
  return TECNOLOGIAS_FIJO.map(({ tecnologia }) => {
    const menciones = todas
      .filter((item) => item.tecnologia === tecnologia)
      .filter((item, index, lista) => lista.findIndex((otro) => otro.megas === item.megas && otro.origen === item.origen && otro.sentido === item.sentido) === index)
      .map(({ tecnologia: _omitido, ...resto }) => resto);
    if (!menciones.length) return null;

    const distintas = [...new Set(menciones.map((item) => item.megas))].sort((a, b) => a - b);
    const item = { tecnologia, velocidad_minima_megas: distintas[0], menciones };
    if (distintas.length > 1) {
      // Se informa cuantas veces se repite cada valor: es la evidencia que necesita el area comercial.
      item.velocidades_en_conflicto = distintas.map((megas) => ({
        megas,
        menciones: menciones.filter((mencion) => mencion.megas === megas).length,
        origen: [...new Set(menciones.filter((mencion) => mencion.megas === megas).map((mencion) => mencion.origen))].join(' + '),
      }));
    }
    return item;
  }).filter(Boolean);
}

function condicionesDe({ producto, ofertaText, terminosText, resoluciones = {} }) {
  const source = unaLinea(`${ofertaText}\n${terminosText}`);
  const folded = fold(source);
  const eventos = [];
  if (/clientes? nuevos?/.test(folded)) eventos.push('cliente_nuevo');
  if (/renovacion(?:es)?/.test(folded)) eventos.push('renovacion');
  if (/portabilidad/.test(folded) && /aplica bono de portabilidad/.test(folded) === false) eventos.push('portabilidad');

  const condiciones = {
    convergencia: /solo si es un cliente convergente|requiere.*convergente/.test(folded) ? 'requerida_para_bonos' : 'no_requerida',
    contrato_meses: null,
    plan_minimo: null,
    planes_minimos: {},
    plazos_meses: plazosMeses(source),
    eventos,
    nivel_aplicacion: /nivel de subscriptor/.test(folded) ? 'subscriptor' : 'no_determinado',
    compatibilidad: /no\s*puede ser combinado|no acumula|debe decidir con cual descuento/.test(folded) ? 'incompatible' : 'no_determinado',
    limite: null,
    modalidades: [],
    excluye: [],
    servicios: [],
    tecnologias: [],
  };

  const maximo = source.match(/m[aá]ximo\s+(\d{1,3})\s+l[ií]neas?\s+por\s+cliente/i);
  if (maximo) condiciones.limite = { cantidad: Number(maximo[1]), unidad: 'lineas_por_cliente' };

  if (producto === 'movil') {
    condiciones.planes_minimos = planesMinimos(source);
    const minimos = Object.values(condiciones.planes_minimos);
    condiciones.plan_minimo = minimos.length ? Math.max(...minimos) : null;
    if (/update plus/i.test(source)) condiciones.modalidades.push('update_plus');
    if (/financiamiento/i.test(source)) condiciones.modalidades.push('financiamiento');
    const excluye = source.match(/no\s*aplica a planes?([^.]+)/i);
    if (excluye) {
      const lista = fold(excluye[1]);
      for (const [clave, patron] of [
        ['corporativos', /corporativ/],
        ['pospago', /pospago/],
        ['claro_libre', /claro libre/],
        ['prepago', /prepago/],
        ['byop', /byop/],
      ]) if (patron.test(lista)) condiciones.excluye.push(clave);
    }
  }

  if (producto === 'fijo') {
    condiciones.tecnologias = tecnologias(ofertaText, terminosText).map((item) => aplicarResolucion(item, resoluciones[item.tecnologia]));
    if (/2 ?play/i.test(source)) condiciones.servicios.push('2play');
    if (/3 ?play/i.test(source)) condiciones.servicios.push('3play');
  }

  return condiciones;
}

function reglaNormalizada({ producto, seccion, pagina, titulo, texto, tipoRegla, beneficio, source, vigencia }) {
  return {
    fuente_comercial_id: source.id || null,
    seccion_origen: seccion,
    tipo_regla: tipoRegla,
    familia: 'affinity',
    producto,
    codigo: `affinity-${producto}-${seccion}${pagina ? `-p${pagina}` : ''}`,
    nombre: titulo,
    llave_comercial: ['affinity', tipoRegla, producto, beneficio?.tipo || 'termino', String(pagina || '')].join('|'),
    valor: { beneficio: beneficio || { tipo: 'no_determinado' }, texto_detectado: titulo },
    vigencia_desde: vigencia.desde,
    vigencia_hasta: vigencia.hasta,
    estado_confianza: 'confirmado',
    estado_publicacion: 'borrador',
    estado_comercial: vigencia.hasta ? 'vigente' : 'vigente_por_reemplazo_pendiente',
    aplicacion_automatica: false,
    traza: {
      fuente: { id: source.id || null, familia: source.familia || 'affinity', nombre_original: source.nombre_original || null, sha256: source.sha256 || null },
      pagina: pagina ?? null,
      texto_original: text(texto).slice(0, 1200),
    },
  };
}

// Una contradiccion del documento la resuelve una persona, no el codigo: `resoluciones` trae la aclaracion
// ({ gpon: { megas, actor, motivo } }) y queda guardada como traza dentro de la regla publicada.
function aplicarResolucion(item, resolucion) {
  if (!resolucion) return item;
  const megas = Number(resolucion.megas ?? resolucion);
  if (!Number.isFinite(megas)) return item;
  const declaradas = item.menciones.map((mencion) => mencion.megas);
  if (!declaradas.includes(megas)) return item;
  return {
    ...item,
    velocidad_minima_megas: megas,
    velocidades_en_conflicto: undefined,
    resolucion: {
      megas,
      actor: resolucion.actor || 'admin',
      motivo: resolucion.motivo || 'aclaracion_comercial',
      fecha: resolucion.fecha || new Date().toISOString().slice(0, 10),
      descartadas: [...new Set(declaradas.filter((valor) => valor !== megas))],
      menciones_originales: item.menciones,
    },
  };
}

export function normalizeAffinityBenefitSources(sources = [], { resoluciones = {} } = {}) {
  const entry = (Array.isArray(sources) ? sources : [])[0] || {};
  const source = { ...(entry.fuente || entry.source || {}), familia: 'affinity' };
  const rawText = String(entry.text || entry.texto || '');
  const detectada = detectVigencia(rawText);
  const vigencia = {
    desde: source.vigencia_desde || detectada.desde,
    hasta: source.vigencia_hasta || detectada.hasta,
  };

  const paginas = splitPages(rawText).filter((page) => !esProcedimiento(page.text));
  const porServicio = new Map();
  for (const page of paginas) {
    const servicio = servicioDePagina(page.text);
    if (!servicio) continue;
    if (!porServicio.has(servicio.producto)) porServicio.set(servicio.producto, { servicio, oferta: null, terminos: [] });
    const grupo = porServicio.get(servicio.producto);
    if (/t[eé]rminos y condiciones/i.test(unaLinea(page.text))) grupo.terminos.push(page);
    // La pagina de oferta es la que declara el descuento; se prefiere la que ademas trae el codigo oficial
    // sobre la portada general, que menciona los dos servicios sin sus condiciones.
    if (porcentajeDescuento(page.text) == null) continue;
    const actualTieneCodigo = grupo.oferta ? Boolean(codigoAffinity(grupo.oferta.text)) : false;
    if (!grupo.oferta || (!actualTieneCodigo && codigoAffinity(page.text))) grupo.oferta = page;
  }

  const reglas = [];
  const compuestas = [];
  const relacionesAmbiguas = [];
  const advertencias = [];
  const contradiccionesDoc = [];

  for (const [producto, grupo] of porServicio) {
    const ofertaPage = grupo.oferta || grupo.terminos[0];
    if (!ofertaPage) continue;
    const ofertaText = unaLinea(ofertaPage.text);
    const terminosText = grupo.terminos.map((page) => unaLinea(page.text)).join('\n');
    const porcentaje = porcentajeDescuento(ofertaText) ?? porcentajeDescuento(terminosText);
    const codigo = codigoAffinity(ofertaText) || codigoAffinity(terminosText);
    if (porcentaje == null) continue;

    const beneficio = { tipo: 'descuento_affinity', porcentaje, codigo, aplicacion: 'renta_mensual' };
    const condiciones = condicionesDe({ producto, ofertaText, terminosText, resoluciones });
    const facturacion = grupo.terminos.flatMap((page) => codigosFacturacion(page.text));

    const beneficioRegla = reglaNormalizada({
      producto,
      seccion: 'oferta',
      pagina: ofertaPage.page,
      titulo: text(`Descuento Affinity ${porcentaje}% ${grupo.servicio.etiqueta}`),
      texto: ofertaText,
      tipoRegla: 'beneficio',
      beneficio,
      source,
      vigencia,
    });
    reglas.push(beneficioRegla);

    const terminosVinculados = [];
    for (const page of grupo.terminos) {
      for (const item of itemsDeTexto(page.text)) {
        const termino = reglaNormalizada({
          producto,
          seccion: 'terminos',
          pagina: page.page,
          titulo: item.texto.slice(0, 240),
          texto: item.texto,
          tipoRegla: 'terminos',
          beneficio: { tipo: 'termino_condicion' },
          source,
          vigencia,
        });
        reglas.push(termino);
        terminosVinculados.push({
          llave_comercial: termino.llave_comercial,
          codigo: termino.codigo,
          orden: item.orden,
          nombre: termino.nombre,
          pagina: page.page,
          estado_confianza: 'confirmado',
        });
      }
    }

    const motivosRevision = [];
    if (!codigo) motivosRevision.push('sin_codigo_de_descuento');
    if (!terminosVinculados.length) motivosRevision.push('sin_terminos_vinculados');
    for (const item of condiciones.tecnologias || []) {
      if (item.velocidades_en_conflicto) {
        motivosRevision.push('velocidad_minima_contradictoria');
        contradiccionesDoc.push({
          codigo: 'velocidad_minima_contradictoria',
          llave_comercial: `affinity|${producto}|${item.tecnologia}`,
          detalle: `El boletin declara ${item.tecnologia.toUpperCase()} con velocidades minimas distintas: ${item.velocidades_en_conflicto.map((v) => `${v.megas} megas (${v.menciones} mencion${v.menciones === 1 ? '' : 'es'}, ${v.origen})`).join(' vs ')}.`,
          menciones: item.menciones,
          estado: 'abierta',
          bloqueante: true,
        });
      } else if (item.resolucion) {
        contradiccionesDoc.push({
          codigo: 'velocidad_minima_aclarada',
          llave_comercial: `affinity|${producto}|${item.tecnologia}`,
          detalle: `${item.tecnologia.toUpperCase()} aplica desde ${item.resolucion.megas} megas por aclaracion de ${item.resolucion.actor} (${item.resolucion.fecha}); se descarto ${item.resolucion.descartadas.join(', ')} megas que el boletin tambien menciona.`,
          estado: 'resuelta',
          bloqueante: false,
        });
      }
    }
    if (motivosRevision.length) {
      relacionesAmbiguas.push({ llave_beneficio: beneficioRegla.llave_comercial, beneficio, motivo: motivosRevision[0], pagina: ofertaPage.page });
    }

    compuestas.push({
      llave_comercial: `${beneficioRegla.llave_comercial}|compuesta`,
      beneficio_regla_id: beneficioRegla.codigo,
      beneficio,
      producto,
      productos_afectados: [producto],
      codigos_facturacion: [...new Set(facturacion)],
      condiciones,
      terminos_vinculados: terminosVinculados,
      vigencia_desde: vigencia.desde,
      vigencia_hasta: vigencia.hasta,
      estado_confianza: motivosRevision.length ? 'requiere_revision' : 'confirmado',
      motivos_revision: motivosRevision,
      aplicacion_automatica: false,
      traza: {
        fuente: beneficioRegla.traza.fuente,
        beneficio: { pagina: ofertaPage.page, texto_original: beneficioRegla.traza.texto_original },
        terminos: grupo.terminos.map((page) => ({ pagina: page.page, texto_original: unaLinea(page.text).slice(0, 1200) })),
      },
    });
  }

  if (!compuestas.length) {
    advertencias.push({
      codigo: 'sin_beneficios_affinity_detectados',
      bloqueante: true,
      detalle: 'El documento no contiene un descuento Affinity reconocible por servicio. Revisa el texto extraido antes de guardar un borrador.',
    });
  }
  if (!vigencia.desde) {
    advertencias.push({
      codigo: 'vigencia_no_detectada',
      bloqueante: false,
      detalle: 'El boletin no declara vigencia legible. Carga la vigencia al subir el documento.',
    });
  }

  const contradicciones = [
    ...contradiccionesDoc,
    ...compuestas
      .filter((item) => item.estado_confianza !== 'confirmado' && !item.motivos_revision.includes('velocidad_minima_contradictoria'))
      .map((item) => ({ codigo: item.estado_confianza, llave_comercial: item.llave_comercial, estado: 'abierta', bloqueante: true })),
  ];
  const bloqueantes = contradicciones.filter((item) => item.bloqueante);

  return {
    dominio: AFFINITY_DOMINIO,
    vigencia,
    reglas_normalizadas: reglas,
    reglas_compuestas: compuestas,
    benefits: compuestas.map((item) => ({
      llave_comercial: item.llave_comercial,
      beneficio: item.beneficio,
      productos_afectados: item.productos_afectados,
      condiciones: item.condiciones,
      fuente_comercial_id: source.id || null,
      estado_confianza: item.estado_confianza,
      aplicacion_automatica: false,
    })),
    contradicciones,
    relaciones_ambiguas: relacionesAmbiguas,
    advertencias,
    beneficios_affinity: compuestas.length,
    resumen_reglas: {
      total: reglas.length,
      por_tipo: reglas.reduce((acc, regla) => ({ ...acc, [regla.tipo_regla]: (acc[regla.tipo_regla] || 0) + 1 }), {}),
      por_confianza: reglas.reduce((acc, regla) => ({ ...acc, [regla.estado_confianza]: (acc[regla.estado_confianza] || 0) + 1 }), {}),
    },
    resumen_compuestas: {
      total: compuestas.length,
      por_confianza: compuestas.reduce((acc, item) => ({ ...acc, [item.estado_confianza]: (acc[item.estado_confianza] || 0) + 1 }), {}),
      ambiguas: relacionesAmbiguas.length,
    },
    publicable: compuestas.length > 0 && bloqueantes.length === 0 && relacionesAmbiguas.length === 0,
  };
}
