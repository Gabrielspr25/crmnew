// Configuracion compartida del portal de ofertas y del Constructor.
// Produccion: portal y Constructor viven en ofertas.ss-group.cloud; el CRM (la API) en crmp.ss-group.cloud.
// Local: el CRM sirve el portal bajo /constructor, asi que la API es el mismo origen.
// Debe cargarse antes que cualquier otro script de la pagina.
(function (global) {
  'use strict';

  const CRM_PRODUCCION = 'https://crmp.ss-group.cloud';
  const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
  const esLocal = (host) => LOCAL_HOSTS.includes(String(host || '').toLowerCase());
  const local = esLocal(global.location.hostname);

  // crm_origin solo se acepta en local y apuntando a localhost. En produccion se ignora: un enlace armado con
  // otro origen haria que el portal enviara el token del vendedor a un servidor ajeno.
  function origenCrm() {
    if (!local) return CRM_PRODUCCION;
    try {
      const pedido = new URLSearchParams(global.location.search).get('crm_origin');
      if (pedido) {
        const url = new URL(pedido);
        if (esLocal(url.hostname) && (url.protocol === 'http:' || url.protocol === 'https:')) return url.origin;
      }
    } catch (_error) {}
    return global.location.origin;
  }

  // El CRM abre el Constructor con la sesion en el hash (#crm_token=...). Se guarda en este dominio y se
  // quita de la barra de direcciones para que no quede en el historial ni viaje al copiar el enlace.
  function adoptarSesion() {
    try {
      const hash = new URLSearchParams(global.location.hash.slice(1));
      const token = hash.get('crm_token');
      if (!token) return;
      global.localStorage.setItem('vp_token', token);
      hash.delete('crm_token');
      const resto = hash.toString();
      global.history.replaceState(null, '', global.location.pathname + global.location.search + (resto ? `#${resto}` : ''));
    } catch (_error) {}
  }

  function instalarTemaPortal() {
    const document = global.document;
    if (!document || !document.documentElement) return;
    const storageKey = 'portal_ofertas_theme';
    const css = `
      body[data-portal-theme="dark"]{background:#070B18!important;color:#F4F7FB!important;border-color:#6D1FAD!important;border-image:none!important;}
      body[data-portal-theme="dark"] .topbar,body[data-portal-theme="dark"] .header{background:#101426!important;color:#F4F7FB!important;border-bottom:1px solid #242A3D!important;box-shadow:0 8px 24px rgba(0,0,0,.22);}
      body[data-portal-theme="dark"] .brand,body[data-portal-theme="dark"] .brand-logo,body[data-portal-theme="dark"] .brand-title{color:#F4F7FB!important;}
      body[data-portal-theme="dark"] .brand small,body[data-portal-theme="dark"] .brand-sub{color:#AAB3C5!important;}
      body[data-portal-theme="dark"] .nav{background:#101426!important;border-bottom:1px solid #242A3D!important;}
      body[data-portal-theme="dark"] .nav a{color:#AAB3C5!important;}
      body[data-portal-theme="dark"] .nav a:hover{color:#F4F7FB!important;background:#151B2E!important;}
      body[data-portal-theme="dark"] .nav a.active{color:#FFFFFF!important;background:#6D1FAD!important;border-bottom-color:#AD1FA6!important;}
      body[data-portal-theme="dark"] .section-card,body[data-portal-theme="dark"] .entry-shell,body[data-portal-theme="dark"] .step,body[data-portal-theme="dark"] .box,body[data-portal-theme="dark"] .info-card,body[data-portal-theme="dark"] .entry-card,body[data-portal-theme="dark"] .plan-card,body[data-portal-theme="dark"] .modal-backdrop .equipment-modal{background:#101426!important;border-color:#242A3D!important;box-shadow:0 10px 30px rgba(0,0,0,.28)!important;}
      body[data-portal-theme="dark"] .entry-card.primary,body[data-portal-theme="dark"] .entry-card.active,body[data-portal-theme="dark"] .step,body[data-portal-theme="dark"] .conditional-panel.show{background:#151B2E!important;}
      body[data-portal-theme="dark"] h1,body[data-portal-theme="dark"] h2,body[data-portal-theme="dark"] h3,body[data-portal-theme="dark"] h4,body[data-portal-theme="dark"] .section-title,body[data-portal-theme="dark"] .entry-head h2,body[data-portal-theme="dark"] .entry-card h3,body[data-portal-theme="dark"] .step-head h2,body[data-portal-theme="dark"] .device-name,body[data-portal-theme="dark"] .modal-selected-title h4{color:#F4F7FB!important;}
      body[data-portal-theme="dark"] p,body[data-portal-theme="dark"] .muted,body[data-portal-theme="dark"] .section-desc,body[data-portal-theme="dark"] .entry-head p,body[data-portal-theme="dark"] .entry-card p,body[data-portal-theme="dark"] .step-head p,body[data-portal-theme="dark"] .line-note,body[data-portal-theme="dark"] .state-sub{color:#AAB3C5!important;}
      body[data-portal-theme="dark"] input,body[data-portal-theme="dark"] select,body[data-portal-theme="dark"] textarea,body[data-portal-theme="dark"] .entry-query,body[data-portal-theme="dark"] .plan-select,body[data-portal-theme="dark"] .plan-input,body[data-portal-theme="dark"] .compare-input{background:#070B18!important;color:#F4F7FB!important;border-color:#242A3D!important;}
      body[data-portal-theme="dark"] .pill,body[data-portal-theme="dark"] .filter-btn,body[data-portal-theme="dark"] .chip,body[data-portal-theme="dark"] .btn,body[data-portal-theme="dark"] .brand-tab,body[data-portal-theme="dark"] .portal-return,body[data-portal-theme="dark"] .version-badge{background:#151B2E!important;color:#F4F7FB!important;border-color:#242A3D!important;}
      body[data-portal-theme="dark"] .pill{color:#D9F99D!important;border-color:rgba(95,173,31,.35)!important;}
      body[data-portal-theme="dark"] .btn.primary,body[data-portal-theme="dark"] .segment-btn.active,body[data-portal-theme="dark"] .chip.active,body[data-portal-theme="dark"] .brand-tab.active{background:#6D1FAD!important;border-color:#AD1FA6!important;color:#FFFFFF!important;}
      body[data-portal-theme="dark"] table,body[data-portal-theme="dark"] .lines-table,body[data-portal-theme="dark"] .plan-table{background:#101426!important;color:#F4F7FB!important;}
      body[data-portal-theme="dark"] th{background:#070B18!important;color:#F4F7FB!important;}
      body[data-portal-theme="dark"] td{color:#F4F7FB!important;border-color:#242A3D!important;}
      body[data-portal-theme="dark"] .ss-rule-card{background:#101426!important;border-color:#242A3D!important;}
      body[data-portal-theme="day"]{background:#F4F6FA!important;color:#172033!important;border-color:#6D1FAD!important;border-image:none!important;}
      body[data-portal-theme="day"] .topbar,body[data-portal-theme="day"] .header{background:#FFFFFF!important;color:#172033!important;border-bottom:1px solid #D8DEEA!important;box-shadow:0 8px 24px rgba(16,24,38,.08);}
      body[data-portal-theme="day"] .brand,body[data-portal-theme="day"] .brand-logo,body[data-portal-theme="day"] .brand-title{color:#172033!important;}
      body[data-portal-theme="day"] .brand small,body[data-portal-theme="day"] .brand-sub{color:#5A667A!important;}
      body[data-portal-theme="day"] .nav{background:#FFFFFF!important;border-bottom:1px solid #D8DEEA!important;}
      body[data-portal-theme="day"] .nav a{color:#4D5A70!important;}
      body[data-portal-theme="day"] .nav a:hover{color:#172033!important;background:#EEF1F7!important;}
      body[data-portal-theme="day"] .nav a.active{color:#6D1FAD!important;border-bottom-color:#6D1FAD!important;}
      body[data-portal-theme="day"] .section-card,body[data-portal-theme="day"] .entry-shell,body[data-portal-theme="day"] .step,body[data-portal-theme="day"] .box,body[data-portal-theme="day"] .info-card,body[data-portal-theme="day"] .entry-card,body[data-portal-theme="day"] .plan-card,body[data-portal-theme="day"] .modal-backdrop .equipment-modal{background:#FFFFFF!important;border-color:#D8DEEA!important;box-shadow:0 10px 28px rgba(16,24,38,.07)!important;}
      body[data-portal-theme="day"] .entry-card.primary,body[data-portal-theme="day"] .entry-card.active,body[data-portal-theme="day"] .step,body[data-portal-theme="day"] .conditional-panel.show{background:#F8FAFE!important;}
      body[data-portal-theme="day"] h1,body[data-portal-theme="day"] h2,body[data-portal-theme="day"] h3,body[data-portal-theme="day"] h4,body[data-portal-theme="day"] .section-title,body[data-portal-theme="day"] .entry-head h2,body[data-portal-theme="day"] .entry-card h3,body[data-portal-theme="day"] .step-head h2,body[data-portal-theme="day"] .device-name,body[data-portal-theme="day"] .modal-selected-title h4{color:#172033!important;}
      body[data-portal-theme="day"] p,body[data-portal-theme="day"] .muted,body[data-portal-theme="day"] .section-desc,body[data-portal-theme="day"] .entry-head p,body[data-portal-theme="day"] .entry-card p,body[data-portal-theme="day"] .step-head p,body[data-portal-theme="day"] .line-note,body[data-portal-theme="day"] .state-sub{color:#5A667A!important;}
      body[data-portal-theme="day"] input,body[data-portal-theme="day"] select,body[data-portal-theme="day"] textarea,body[data-portal-theme="day"] .entry-query,body[data-portal-theme="day"] .plan-select,body[data-portal-theme="day"] .plan-input,body[data-portal-theme="day"] .compare-input{background:#FFFFFF!important;color:#172033!important;border-color:#CBD3E1!important;}
      body[data-portal-theme="day"] .pill,body[data-portal-theme="day"] .filter-btn,body[data-portal-theme="day"] .chip,body[data-portal-theme="day"] .btn,body[data-portal-theme="day"] .brand-tab,body[data-portal-theme="day"] .portal-return,body[data-portal-theme="day"] .version-badge{background:#FFFFFF!important;color:#172033!important;border-color:#CBD3E1!important;}
      body[data-portal-theme="day"] .pill{color:#5FAD1F!important;border-color:rgba(95,173,31,.35)!important;}
      body[data-portal-theme="day"] .btn.primary,body[data-portal-theme="day"] .segment-btn.active,body[data-portal-theme="day"] .chip.active,body[data-portal-theme="day"] .brand-tab.active{background:#6D1FAD!important;border-color:#6D1FAD!important;color:#FFFFFF!important;}
      body[data-portal-theme="day"] table,body[data-portal-theme="day"] .lines-table,body[data-portal-theme="day"] .plan-table{background:#FFFFFF!important;color:#172033!important;}
      body[data-portal-theme="day"] th{background:#101426!important;color:#F4F7FB!important;}
      body[data-portal-theme="day"] td{color:#172033!important;border-color:#E2E7F0!important;}
      body[data-portal-theme="day"] .ss-rule-card{background:#FFFFFF!important;border-color:#D8DEEA!important;}
      .portal-theme-toggle{border:1px solid rgba(255,255,255,.34);background:rgba(15,23,42,.28);color:#fff;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;}
      body[data-portal-theme="day"] .portal-theme-toggle{background:#6D1FAD!important;border-color:#6D1FAD!important;color:#FFFFFF!important;}
    `;
    if (!document.getElementById('portalThemeStyle')) {
      const style = document.createElement('style');
      style.id = 'portalThemeStyle';
      style.textContent = css;
      document.head.appendChild(style);
    }
    function applyTheme(theme) {
      const selected = theme === 'day' ? 'day' : 'dark';
      document.body?.setAttribute('data-portal-theme', selected);
      try { global.localStorage.setItem(storageKey, selected); } catch (_error) {}
      const button = document.getElementById('portalThemeToggle');
      if (button) button.textContent = selected === 'day' ? 'Modo oscuro' : 'Modo dia';
    }
    function mountToggle() {
      if (!document.body || document.getElementById('portalThemeToggle')) return;
      const button = document.createElement('button');
      button.id = 'portalThemeToggle';
      button.type = 'button';
      button.className = 'portal-theme-toggle';
      button.addEventListener('click', () => applyTheme(document.body.getAttribute('data-portal-theme') === 'day' ? 'dark' : 'day'));
      const target = document.querySelector('.topbar-actions') || document.querySelector('.header') || document.querySelector('.topbar');
      if (target) target.appendChild(button);
      applyTheme((() => { try { return global.localStorage.getItem(storageKey); } catch (_error) { return null; } })());
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountToggle, { once: true });
    else mountToggle();
  }

  adoptarSesion();
  instalarTemaPortal();
  const base = origenCrm();
  global.PORTAL_API_BASE = base;
  global.portalApiUrl = (path) => (/^https?:\/\//i.test(String(path)) ? String(path) : base + path);
})(window);
