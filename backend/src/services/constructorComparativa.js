// Arma automáticamente la base de una comparativa de Constructor para un
// cliente real: líneas actuales clasificadas, trade-in vigente (si tiene
// Móvil) y beneficios de convergencia vigentes (si es convergente).
// No decide la oferta — solo reúne, con las reglas ya aprendidas a la mala
// (ver skill comparar-contra-catalogo-vigente en agentes-newcrm), los datos
// que antes se juntaban a mano leyendo PDFs y consultas sueltas.
import { pool } from '../db.js';
import { effectiveContractPayments } from './contractPayments.js';

const ACTIVE_SUB_STATUS_SQL = `COALESCE(LOWER(s.status::text),'activo') NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')`;

// Misma regla que clientsReal.js (SERVICE_KIND_SQL): line_kind manda si existe,
// si no se deriva de product_type. SOC, precio y account_type no participan.
const LINE_KIND_SQL = `LOWER(COALESCE(
  NULLIF(s.line_kind::text,''),
  CASE UPPER(NULLIF(s.product_type::text,''))
    WHEN 'G' THEN 'movil'
    WHEN 'O' THEN 'fijo'
    WHEN 'T' THEN 'fijo'
    WHEN 'V' THEN 'fijo'
    WHEN 'K' THEN 'cloud'
  END,
  ''
))`;

function fmtISODate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.slice(0, 10);
}

function dateOnly(value) {
  const iso = fmtISODate(value);
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Regla exacta aprendida con Móvil: Vencimiento sale de remaining_payments
// (0 = Vencido, sin dato = en blanco), NUNCA de contract_end_date — ese
// campo es irrelevante en Móvil y puede traer valores sin criterio real.
// Fijo sí vence por fecha (contract_end_date).
function vencimientoYPendientes(kind, sub) {
  if (kind === 'movil') {
    const remaining = sub.remaining_payments;
    if (remaining === null || remaining === undefined || remaining === '') {
      return { vencimiento: '', pendientes: '' };
    }
    const n = Number(remaining);
    return {
      vencimiento: n === 0 ? 'Vencido' : '',
      pendientes: `${n} cuota${n === 1 ? '' : 's'}`,
    };
  }
  if (kind === 'fijo') {
    const end = dateOnly(sub.contract_end_date);
    if (!end) return { vencimiento: '', pendientes: '' };
    const today = dateOnly(new Date());
    return { vencimiento: end < today ? 'Vencido' : fmtISODate(end), pendientes: '' };
  }
  return { vencimiento: '', pendientes: '' };
}

export async function buildComparativaBase(clientIdOrIds) {
  // La misma empresa suele quedar repartida en varios registros de cliente
  // en crm_pro (duplicados historicos de Tango, ej. "Cliente BAN 718495611"
  // junto al registro con el nombre real) -- mirar solo un client_id deja
  // fuera lineas reales del cliente. Se acepta uno o varios ids (el buscador
  // del CRM ya manda todos los client_ids del mismo grupo).
  const clientIds = Array.isArray(clientIdOrIds) ? clientIdOrIds : [clientIdOrIds];
  const conn = await pool.connect();
  let client;
  let subsRows;
  try {
    await conn.query('BEGIN');
    await conn.query('SET LOCAL search_path TO public');

    const clientResult = await conn.query(
      `SELECT id, name, business_name, tax_id FROM clients WHERE id = ANY($1::uuid[])
        ORDER BY (name ~* '^Cliente BAN ') ASC, created_at DESC`,
      [clientIds]
    );
    client = clientResult.rows[0];
    if (!client) {
      await conn.query('ROLLBACK');
      const err = new Error('Cliente no existe');
      err.code = 'cliente_no_encontrado';
      throw err;
    }

    subsRows = await conn.query(
      `SELECT s.id, s.phone, s.plan, s.monthly_value, s.equipment, s.product_type, s.line_kind,
              s.contract_start_date, s.contract_term, s.remaining_payments, s.contract_end_date,
              s.tango_ventaid, b.ban_number,
              ${LINE_KIND_SQL} AS kind
         FROM subscribers s JOIN bans b ON b.id = s.ban_id
        WHERE b.client_id = ANY($1::uuid[]) AND ${ACTIVE_SUB_STATUS_SQL}
        ORDER BY b.ban_number, s.phone`,
      [clientIds]
    );

    await conn.query('COMMIT');
  } catch (e) {
    try { await conn.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    conn.release();
  }

  const banOrder = new Map();
  for (const s of subsRows.rows) {
    const ban = String(s.ban_number || '').trim();
    if (ban && !banOrder.has(ban)) banOrder.set(ban, banOrder.size + 1);
  }

  const current = subsRows.rows.map((s) => {
    const kind = s.kind || 'sin_clasificar';
    const sub = effectiveContractPayments(s);
    const { vencimiento, pendientes } = vencimientoYPendientes(kind, sub);
    const ban = String(s.ban_number || '').trim();
    const cuenta = banOrder.has(ban) ? `Cuenta ${banOrder.get(ban)}` : '';
    return [ban, s.phone || '', s.plan || '', Number(s.monthly_value) || 0, vencimiento, s.equipment || '', kind, cuenta, pendientes];
  });

  const hasMovil = current.some((r) => r[6] === 'movil');
  const hasFijo = current.some((r) => r[6] === 'fijo');
  const convergente = hasMovil && hasFijo;

  let tradeIn = null;
  if (hasMovil) {
    // Trade In = equipos que Claro RECIBE del cliente. "programa" describe la
    // oferta comercial (ej. crédito $1,100), no el equipo en sí, así que no
    // se muestra aquí. Un programa "sin_tradein" (ej. gratis en renovación)
    // no exige entregar nada, así que no pertenece a esta lista.
    const tiRows = await pool.query(
      `SELECT fuente_nombre, vigencia_desde, vigencia_hasta, marca, modelo
         FROM public.motor_ofertas_trade_in
        WHERE estado='vigente' AND programa NOT ILIKE '%sin_tradein%'
        ORDER BY marca, modelo`
    );
    if (tiRows.rows.length) {
      const first = tiRows.rows[0];
      const marcasMap = new Map();
      for (const row of tiRows.rows) {
        if (!marcasMap.has(row.marca)) marcasMap.set(row.marca, []);
        marcasMap.get(row.marca).push(row.modelo);
      }
      const marcas = [...marcasMap.entries()].map(([marca, modelos]) => ({ marca, modelos }));
      const vigenciaTexto = [fmtISODate(first.vigencia_desde), fmtISODate(first.vigencia_hasta)]
        .filter(Boolean).join(' a ');
      tradeIn = { fuente: first.fuente_nombre, vigencia: vigenciaTexto, marcas };
    }
  }

  let convergencia = null;
  if (convergente) {
    const bcRows = await pool.query(
      `SELECT fuente_nombre, version_boletin, vigencia_desde, codigo, nombre, descripcion,
              requiere_accion_nueva, accion_requerida, servicio_requerido
         FROM public.motor_ofertas_beneficios_convergencia
        WHERE estado='vigente'
        ORDER BY codigo`
    );
    if (bcRows.rows.length) {
      const first = bcRows.rows[0];
      const beneficios = bcRows.rows.map((b) => {
        if (!b.requiere_accion_nueva) return `${b.nombre}: aplica automáticamente.`;
        const requisito = [b.accion_requerida, b.servicio_requerido].filter(Boolean).join(' — ');
        return `${b.nombre}: requiere acción${requisito ? ' (' + requisito + ')' : ''}.`;
      });
      const vigenciaDesde = fmtISODate(first.vigencia_desde);
      convergencia = {
        fuente: first.fuente_nombre,
        vigencia: [first.version_boletin, vigenciaDesde ? `vigente desde ${vigenciaDesde}` : null]
          .filter(Boolean).join(' · '),
        beneficios,
      };
    }
  }

  const [catalogoMovil, ofertasMovil] = await Promise.all([buildCatalogoMovil(), buildOfertasMovilVigente()]);

  return {
    cliente: client.business_name || client.name || 'Cliente',
    client_id: client.id,
    tax_id: client.tax_id || null,
    cuentas: banOrder.size,
    current,
    convergente,
    tradeIn,
    convergencia,
    catalogoMovil,
    ofertasMovil,
  };
}

// Catalogo real de Movil publicado en planes_modulos (pagina='moviles'):
// planes individuales (uno por linea) y Business Red multilinea (precio
// distinto segun la posicion de la linea dentro del grupo, 1 a 10). No se
// arma ninguna otra estructura -- si algun dia hay mas secciones activas
// para 'moviles', entran solas por estar activas.
async function buildCatalogoMovil() {
  const { rows } = await pool.query(
    `SELECT seccion_key, titulo, tipo, contenido
       FROM public.planes_modulos
      WHERE pagina='moviles' AND activo=true`
  );
  const individuales = [];
  const multilineaMap = new Map();
  for (const row of rows) {
    const filas = row.contenido?.filas || [];
    if (row.tipo === 'multilinea') {
      for (const f of filas) {
        if (!multilineaMap.has(f.familia)) multilineaMap.set(f.familia, []);
        multilineaMap.get(f.familia).push({ cantidad_lineas: f.cantidad_lineas, precio: f.precio_regular });
      }
    } else {
      for (const f of filas) {
        if (f.codigo) individuales.push({ codigo: f.codigo, descripcion: f.descripcion || f.codigo, precio: f.precio_regular });
      }
    }
  }
  const multilinea = [...multilineaMap.entries()].map(([familia, tramos]) => ({
    familia,
    tramos: tramos.sort((a, b) => a.cantidad_lineas - b.cantidad_lineas),
  }));
  return { individuales, multilinea };
}

// Equipos que se ofrecen: SOLO los de las ofertas de la version publicada
// como vigente en ofertas_movil_versiones (la misma que consume el portal y
// el motor de ofertas). Regla de vigencia continua: sigue vigente hasta que
// se publique la siguiente, aunque su fecha ya haya pasado -- en ese caso se
// avisa, no se oculta.
export async function buildOfertasMovilVigente({ db = pool } = {}) {
  const { rows } = await db.query(
    `SELECT numero, vigencia_desde, vigencia_hasta, archivo_nombre, datos, resumen
       FROM public.ofertas_movil_versiones
      WHERE estado='vigente'
      ORDER BY numero DESC
      LIMIT 1`
  );
  const version = rows[0];
  if (!version) return null;
  // El plazo viene vacio en los campos estructurados, pero la nota oficial de
  // cada oferta lo dice ("Oferta solo aplica a 30 plazos"). Se lee de ahi; si
  // la nota no lo dice, queda null (no se infiere).
  const leerNota = (nota) => {
    const texto = String(nota || '').replace(/\s+/g, ' ');
    const plazo = texto.match(/aplica\s+(?:solo\s+)?a\s+(\d{2})\s+plazos/i);
    return {
      plazoNota: plazo ? Number(plazo[1]) : null,
      soloPlanIndividual: /aplica\s+solo\s+a\s+plan\s+individual/i.test(texto),
    };
  };
  const ofertas = (Array.isArray(version.datos) ? version.datos : []).map((o) => ({
    ...leerNota(o.nota),
    id: o.id,
    titulo: o.titulo || o.id,
    tipo: o.tipo,
    planMin: o.planMin ?? null,
    planMax: o.planMax ?? null,
    planesIndividuales: Array.isArray(o.planesIndividuales) ? o.planesIndividuales : [],
    familias: Array.isArray(o.familiasMultilinea) ? o.familiasMultilinea : [],
    eventos: Array.isArray(o.eventos) ? o.eventos : [],
    beneficio: o.beneficio || null,
    credito: o.credito ?? null,
    lineaLimit: o.lineaLimit ?? null,
    tradeinNueva: Boolean(o.tradeinNueva),
    tradeinRenov: Boolean(o.tradeinRenov),
    equipos: (Array.isArray(o.equipos) ? o.equipos : [])
      .filter((e) => e && e.modelo)
      .map((e) => ({ marca: e.marca || '', modelo: e.modelo, precio: Number(e.precio) || null })),
  }));
  return {
    numero: version.numero,
    archivo: version.archivo_nombre,
    vigencia_desde: fmtISODate(version.vigencia_desde),
    vigencia_hasta: fmtISODate(version.vigencia_hasta),
    ofertas,
    business_red_plus: version.resumen?.business_red_plus || null,
  };
}
