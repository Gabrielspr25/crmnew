const API_ENDPOINT = '/api/equipos-lista';

let equipos = [];
let filteredEquipos = [];

const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (number === 0) return 'GRATIS';
  return `$${number.toFixed(2)}`;
};

const normalizeText = (value) => String(value || '').trim();

const titleCase = (value) => {
  const text = normalizeText(value);
  if (!text) return 'Sin clasificar';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

const escapeHtml = (value) =>
  normalizeText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const parseList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

async function loadEquipos() {
  const stats = document.getElementById('stats');
  const container = document.getElementById('equiposContainer');

  try {
    const response = await fetch(API_ENDPOINT, { headers: { Accept: 'application/json' } });
    const payload = await response.json();

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || 'No se pudo cargar la lista de equipos.');
    }

    equipos = Array.isArray(payload.data) ? payload.data : [];
    filteredEquipos = [...equipos];
    populateFilters();
    renderEquipos();
  } catch (error) {
    container.innerHTML = `
      <div class="no-results" style="display:block">
        <h3>No se pudo cargar la lista de equipos</h3>
        <p>${escapeHtml(error.message || 'Verifica que la migración SQL esté ejecutada y que el API esté disponible.')}</p>
      </div>
    `;
    stats.textContent = 'Lista no disponible';
  }
}

function populateFilters() {
  const categoryFilter = document.getElementById('categoryFilter');
  const brandFilter = document.getElementById('brandFilter');
  const categories = [...new Set(equipos.map((item) => normalizeText(item.categoria)).filter(Boolean))].sort();
  const brands = [...new Set(equipos.map((item) => normalizeText(item.marca)).filter(Boolean))].sort();

  categoryFilter.innerHTML = '<option value="all">Todas las categorías</option>' +
    categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(titleCase(category))}</option>`).join('');

  brandFilter.innerHTML = '<option value="all">Todas las marcas</option>' +
    brands.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(titleCase(brand))}</option>`).join('');
}

function applyFilters() {
  const search = normalizeText(document.getElementById('searchInput').value).toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const brand = document.getElementById('brandFilter').value;

  filteredEquipos = equipos.filter((item) => {
    const matchesCategory = category === 'all' || normalizeText(item.categoria) === category;
    const matchesBrand = brand === 'all' || normalizeText(item.marca) === brand;
    const haystack = [
      item.item_code,
      item.sap_code,
      item.modelo,
      item.marca,
      item.categoria,
      item.subcategoria,
    ].map(normalizeText).join(' ').toLowerCase();

    return matchesCategory && matchesBrand && (!search || haystack.includes(search));
  });

  renderEquipos();
}

function renderEquipos() {
  const container = document.getElementById('equiposContainer');
  const noResults = document.getElementById('noResults');
  const stats = document.getElementById('stats');

  stats.textContent = `Mostrando ${filteredEquipos.length} de ${equipos.length} equipos`;
  noResults.style.display = filteredEquipos.length === 0 ? 'block' : 'none';

  if (filteredEquipos.length === 0) {
    container.innerHTML = '';
    return;
  }

  const groups = filteredEquipos.reduce((acc, item) => {
    const key = normalizeText(item.categoria) || 'sin-categoria';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  container.innerHTML = Object.entries(groups).map(([category, items]) => `
    <div class="category-section">
      <div class="category-header" onclick="this.parentElement.classList.toggle('collapsed')">
        <h2><span class="category-icon">📦</span> ${escapeHtml(titleCase(category))} <span class="category-count">${items.length}</span></h2>
        <span class="category-toggle">▼</span>
      </div>
      <div class="category-body">
        <table class="plan-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Equipo</th>
              <th>Marca</th>
              <th>Precio regular</th>
              <th>Mensualidades</th>
              <th>Precios pospago</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(renderEquipoRow).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');
}

function renderEquipoRow(item) {
  const mensualidades = parseList(item.mensualidades)
    .map((row) => `${escapeHtml(row.meses)}m: ${formatMoney(row.monto)}`)
    .join('<br>');
  const pospago = parseList(item.pospago_precios)
    .map((row) => `$${Number(row.plan).toFixed(2)}: ${formatMoney(row.monto)}`)
    .join('<br>');
  const fueraPortafolio = item.fuera_portafolio ? '<div class="note">Fuera de portafolio</div>' : '';

  return `
    <tr>
      <td><code>${escapeHtml(item.item_code)}</code>${item.sap_code ? `<div class="note">SAP ${escapeHtml(item.sap_code)}</div>` : ''}</td>
      <td><strong>${escapeHtml(item.modelo)}</strong>${fueraPortafolio}</td>
      <td><span class="tech-badge">${escapeHtml(titleCase(item.marca))}</span></td>
      <td class="cell-price">${formatMoney(item.precio_regular)}</td>
      <td>${mensualidades || '—'}</td>
      <td>${pospago || '—'}</td>
    </tr>
  `;
}

function initDarkMode() {
  const darkToggle = document.getElementById('darkToggle');
  const darkIcon = document.getElementById('darkIcon');
  const saved = localStorage.getItem('claro-dark-mode') === 'true';

  if (saved) {
    document.body.classList.add('dark');
    darkIcon.textContent = '☀️';
  }

  darkToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('claro-dark-mode', String(isDark));
    darkIcon.textContent = isDark ? '☀️' : '🌙';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('categoryFilter').addEventListener('change', applyFilters);
  document.getElementById('brandFilter').addEventListener('change', applyFilters);
  loadEquipos();
});
