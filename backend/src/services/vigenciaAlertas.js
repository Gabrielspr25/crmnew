import { dateOnly } from './vigenciaTexto.js';

const DAY_MS = 86400000;
export const DIAS_ALERTA_VENCIMIENTO = 30;

function utcDay(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(fromIso, toIso) {
  return Math.round((utcDay(toIso) - utcDay(fromIso)) / DAY_MS);
}

function mensaje(estado, dias) {
  if (estado === 'sin_fecha_fin') return 'Sin fecha de fin registrada';
  if (estado === 'vencida') return `Vencido hace ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'Vence hoy';
  return `Vence en ${dias} dia${dias === 1 ? '' : 's'}`;
}

export function estadoVigencia({ fechaFin, today, diasAlerta = DIAS_ALERTA_VENCIMIENTO }) {
  const fin = dateOnly(fechaFin);
  if (!fin) return { estado: 'sin_fecha_fin', dias_restantes: null };
  const dias = daysBetween(today, fin);
  if (dias < 0) return { estado: 'vencida', dias_restantes: dias };
  if (dias <= diasAlerta) return { estado: 'por_vencer', dias_restantes: dias };
  return { estado: 'vigente', dias_restantes: dias };
}

function latestPerFamilia(fuentes) {
  const byFamilia = new Map();
  for (const fuente of fuentes) {
    const familia = String(fuente?.familia || '').trim();
    if (!familia) continue;
    const current = byFamilia.get(familia);
    const createdAt = String(fuente.creado_en || '');
    if (!current || createdAt > String(current.creado_en || '')) byFamilia.set(familia, fuente);
  }
  return [...byFamilia.values()];
}

// Toma el documento mas reciente de cada familia y avisa cuando su fecha de fin ya paso o esta por llegar,
// para que el admin busque el boletin nuevo y lo suba. Subir el documento siguiente limpia la alerta sola.
export function buildVigenciaAlertas({ fuentes = [], today = new Date().toISOString().slice(0, 10), diasAlerta = DIAS_ALERTA_VENCIMIENTO } = {}) {
  const hoy = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const items = latestPerFamilia(fuentes).map((fuente) => {
    const { estado, dias_restantes } = estadoVigencia({ fechaFin: fuente.vigencia_hasta, today: hoy, diasAlerta });
    return {
      familia: fuente.familia,
      fuente_id: fuente.id || null,
      archivo: fuente.nombre_original || null,
      fecha_inicio: dateOnly(fuente.vigencia_desde),
      fecha_fin: dateOnly(fuente.vigencia_hasta),
      cargado_en: fuente.creado_en ? String(fuente.creado_en).slice(0, 10) : null,
      estado,
      dias_restantes,
      mensaje: mensaje(estado, dias_restantes),
      accion: estado === 'vencida' ? 'subir_documento_nuevo' : (estado === 'por_vencer' ? 'buscar_documento_nuevo' : null),
    };
  });
  const alertas = items
    .filter((item) => item.estado === 'vencida' || item.estado === 'por_vencer')
    .sort((a, b) => a.dias_restantes - b.dias_restantes || String(a.familia).localeCompare(String(b.familia)));
  const sinFechaFin = items.filter((item) => item.estado === 'sin_fecha_fin').sort((a, b) => String(a.familia).localeCompare(String(b.familia)));
  const vigentes = items.filter((item) => item.estado === 'vigente').sort((a, b) => a.dias_restantes - b.dias_restantes);
  return {
    hoy,
    dias_alerta: diasAlerta,
    alertas,
    sin_fecha_fin: sinFechaFin,
    vigentes,
    resumen: {
      familias: items.length,
      vencidas: alertas.filter((item) => item.estado === 'vencida').length,
      por_vencer: alertas.filter((item) => item.estado === 'por_vencer').length,
      sin_fecha_fin: sinFechaFin.length,
      vigentes: vigentes.length,
    },
  };
}
