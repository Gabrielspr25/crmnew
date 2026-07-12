import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dir, '../../../frontend');
const EQUIPOS_IMG_DIR = path.join(FRONTEND_DIR, 'img', 'equipos');

const OFFICIAL_DOMAINS = {
  apple: ['apple.com'],
  samsung: ['samsung.com'],
  motorola: ['motorola.com'],
  jbl: ['jbl.com'],
  beats: ['beatsbydre.com', 'apple.com'],
  sonos: ['sonos.com'],
  netgear: ['netgear.com'],
  router: ['netgear.com', 'asus.com', 'tp-link.com'],
  modem: ['franklinwireless.com', 'inseego.com', 'netgear.com'],
};

function cleanModel(modelo = '') {
  return String(modelo)
    .replace(/\*/g, ' ')
    .replace(/\bIPH\b/gi, 'iPhone')
    .replace(/\bGXY\b/gi, 'Galaxy')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(s = '') {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'equipo';
}

function domainsFor(marca = '') {
  const key = String(marca || '').toLowerCase();
  return OFFICIAL_DOMAINS[key] || [key ? `${key}.com` : ''];
}

function isOfficialUrl(url, marca) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return false; }
  return domainsFor(marca).some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function decodeDuckUrl(href = '') {
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : u.href;
  } catch {
    return href;
  }
}

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

function absolutize(url, base) {
  try { return new URL(url, base).href; } catch { return ''; }
}

function extractOfficialLinks(html, marca) {
  const links = [];
  const re = /<a\b[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = decodeDuckUrl(m[1]);
    if (isOfficialUrl(href, marca)) links.push(href);
  }
  return uniq(links).slice(0, 6);
}

function extractImageCandidates(html, pageUrl) {
  const out = [];
  const meta = /<meta\b[^>]+(?:property|name)=["'](?:og:image|twitter:image|og:image:secure_url)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = meta.exec(html))) out.push(absolutize(m[1], pageUrl));
  const img = /<img\b[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((m = img.exec(html))) {
    const src = absolutize(m[1], pageUrl);
    if (/\.(png|jpe?g|webp)(\?|$)/i.test(src)) out.push(src);
  }
  return uniq(out).filter((u) => !/logo|icon|sprite|favicon/i.test(u)).slice(0, 8);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; ClaroCRM/1.0; +https://ofertas.ss-group.cloud)',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function searchOfficialPages({ marca, modelo }) {
  const q = `${cleanModel(modelo)} ${String(marca || '')} official product image`;
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const html = await fetchText(url);
  return extractOfficialLinks(html, marca);
}

function extFromContentType(type = '', url = '') {
  if (type.includes('webp')) return 'webp';
  if (type.includes('png')) return 'png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  const m = String(url).match(/\.(png|jpe?g|webp)(?:\?|$)/i);
  return m ? m[1].replace('jpeg', 'jpg').toLowerCase() : 'jpg';
}

async function downloadImage(url, destBase) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; ClaroCRM/1.0)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Imagen HTTP ${res.status}`);
  const type = String(res.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('image/')) throw new Error(`No es imagen: ${type || 'sin content-type'}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 5000) throw new Error('Imagen demasiado pequeña');
  const ext = extFromContentType(type, url);
  const fileName = `${destBase}.${ext}`;
  await fs.mkdir(EQUIPOS_IMG_DIR, { recursive: true });
  await fs.writeFile(path.join(EQUIPOS_IMG_DIR, fileName), bytes);
  return { image_url: `/img/equipos/${fileName}`, bytes: bytes.length };
}

export async function buscarYDescargarImagenEquipo(equipo) {
  const modelo = cleanModel(equipo?.modelo || '');
  const marca = String(equipo?.marca || '').toLowerCase();
  if (!modelo) throw new Error('Equipo sin modelo');
  const pages = await searchOfficialPages({ marca, modelo });
  if (!pages.length) throw new Error(`No encontré página oficial para ${modelo}`);

  const errors = [];
  for (const pageUrl of pages) {
    try {
      const html = await fetchText(pageUrl);
      const images = extractImageCandidates(html, pageUrl);
      for (const imageUrl of images) {
        try {
          const base = `${equipo.id || equipo.item_code || 'eq'}-${slugify(modelo)}`;
          const saved = await downloadImage(imageUrl, base);
          return {
            ok: true,
            image_url: saved.image_url,
            image_source_url: pageUrl,
            image_source_image_url: imageUrl,
            image_bytes: saved.bytes,
            official_pages_checked: pages,
          };
        } catch (e) { errors.push(`${imageUrl}: ${e.message}`); }
      }
    } catch (e) { errors.push(`${pageUrl}: ${e.message}`); }
  }
  throw new Error(`No pude descargar imagen oficial. ${errors.slice(0, 3).join(' | ')}`);
}

