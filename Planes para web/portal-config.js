// Configuracion compartida del Portal de Ofertas.
// Produccion: el Portal vive en ofertas.ss-group.cloud; el CRM (la API) en crmp.ss-group.cloud.
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

  // Si una entrada autenticada del CRM llega con sesion en el hash, se guarda en este dominio y se
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
      body[data-portal-theme="dark"] .section-card,body[data-portal-theme="dark"] .entry-shell,body[data-portal-theme="dark"] .step,body[data-portal-theme="dark"] .box,body[data-portal-theme="dark"] .info-card,body[data-portal-theme="dark"] .entry-card,body[data-portal-theme="dark"] .plan-card,body[data-portal-theme="dark"] .modal-backdrop .equipment-modal,body[data-portal-theme="dark"] .status,body[data-portal-theme="dark"] .prog,body[data-portal-theme="dark"] .tablewrap,body[data-portal-theme="dark"] .modal,body[data-portal-theme="dark"] .modal-card,body[data-portal-theme="dark"] .modal-panel,body[data-portal-theme="dark"] .modal-offer,body[data-portal-theme="dark"] .product-panel,body[data-portal-theme="dark"] .accordion-item,body[data-portal-theme="dark"] .product-row,body[data-portal-theme="dark"] .summary-card,body[data-portal-theme="dark"] .comparison-summary,body[data-portal-theme="dark"] .terms{background:#101426!important;border-color:#242A3D!important;box-shadow:0 10px 30px rgba(0,0,0,.28)!important;}
      body[data-portal-theme="dark"] .entry-card.primary,body[data-portal-theme="dark"] .entry-card.active,body[data-portal-theme="dark"] .step,body[data-portal-theme="dark"] .conditional-panel.show,body[data-portal-theme="dark"] .prog-head,body[data-portal-theme="dark"] .modal-head,body[data-portal-theme="dark"] .accordion-head{background:#151B2E!important;}
      body[data-portal-theme="dark"] h1,body[data-portal-theme="dark"] h2,body[data-portal-theme="dark"] h3,body[data-portal-theme="dark"] h4,body[data-portal-theme="dark"] .section-title,body[data-portal-theme="dark"] .entry-head h2,body[data-portal-theme="dark"] .entry-card h3,body[data-portal-theme="dark"] .step-head h2,body[data-portal-theme="dark"] .device-name,body[data-portal-theme="dark"] .modal-selected-title h4{color:#F4F7FB!important;}
      body[data-portal-theme="dark"] p,body[data-portal-theme="dark"] .muted,body[data-portal-theme="dark"] .section-desc,body[data-portal-theme="dark"] .entry-head p,body[data-portal-theme="dark"] .entry-card p,body[data-portal-theme="dark"] .step-head p,body[data-portal-theme="dark"] .line-note,body[data-portal-theme="dark"] .state-sub{color:#AAB3C5!important;}
      body[data-portal-theme="dark"] input,body[data-portal-theme="dark"] select,body[data-portal-theme="dark"] textarea,body[data-portal-theme="dark"] .entry-query,body[data-portal-theme="dark"] .plan-select,body[data-portal-theme="dark"] .plan-input,body[data-portal-theme="dark"] .compare-input{background:#070B18!important;color:#F4F7FB!important;border-color:#242A3D!important;}
      body[data-portal-theme="dark"] .pill,body[data-portal-theme="dark"] .filter-btn,body[data-portal-theme="dark"] .chip,body[data-portal-theme="dark"] .btn,body[data-portal-theme="dark"] .brand-tab,body[data-portal-theme="dark"] .portal-return,body[data-portal-theme="dark"] .version-badge{background:#151B2E!important;color:#F4F7FB!important;border-color:#242A3D!important;}
      body[data-portal-theme="dark"] .pill{color:#D9F99D!important;border-color:rgba(95,173,31,.35)!important;}
      body[data-portal-theme="dark"] .btn.primary,body[data-portal-theme="dark"] .segment-btn.active,body[data-portal-theme="dark"] .chip.active,body[data-portal-theme="dark"] .brand-tab.active{background:#6D1FAD!important;border-color:#AD1FA6!important;color:#FFFFFF!important;}
      body[data-portal-theme="dark"] table,body[data-portal-theme="dark"] .lines-table,body[data-portal-theme="dark"] .plan-table,body[data-portal-theme="dark"] .directory-table,body[data-portal-theme="dark"] .ep-table{background:#101426!important;color:#F4F7FB!important;}
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
      body[data-portal-theme="day"] .section-card,body[data-portal-theme="day"] .entry-shell,body[data-portal-theme="day"] .step,body[data-portal-theme="day"] .box,body[data-portal-theme="day"] .info-card,body[data-portal-theme="day"] .entry-card,body[data-portal-theme="day"] .plan-card,body[data-portal-theme="day"] .modal-backdrop .equipment-modal,body[data-portal-theme="day"] .status,body[data-portal-theme="day"] .prog,body[data-portal-theme="day"] .tablewrap,body[data-portal-theme="day"] .modal,body[data-portal-theme="day"] .modal-card,body[data-portal-theme="day"] .modal-panel,body[data-portal-theme="day"] .modal-offer,body[data-portal-theme="day"] .product-panel,body[data-portal-theme="day"] .accordion-item,body[data-portal-theme="day"] .product-row,body[data-portal-theme="day"] .summary-card,body[data-portal-theme="day"] .comparison-summary,body[data-portal-theme="day"] .terms,body[data-portal-theme="day"] .empty,body[data-portal-theme="day"] .error{background:#E9EEF8!important;border-color:#AAB6CC!important;box-shadow:0 16px 36px rgba(16,24,38,.14)!important;}
      body[data-portal-theme="day"] .entry-card.primary,body[data-portal-theme="day"] .step,body[data-portal-theme="day"] .conditional-panel.show,body[data-portal-theme="day"] .prog-head,body[data-portal-theme="day"] .modal-head,body[data-portal-theme="day"] .accordion-head{background:#E4E9F7!important;border-color:#9EACC6!important;}
      body[data-portal-theme="day"] .entry-card.active{background:#E4E9F7!important;border-color:#6D1FAD!important;box-shadow:0 0 0 2px rgba(109,31,173,.24),0 16px 34px rgba(16,24,38,.16)!important;}
      body[data-portal-theme="day"] .plan-item,body[data-portal-theme="day"] .oficina-item,body[data-portal-theme="day"] .iot-item,body[data-portal-theme="day"] .adicional-item,body[data-portal-theme="day"] .equipo-item,body[data-portal-theme="day"] .oferta-card,body[data-portal-theme="day"] .modal-item,body[data-portal-theme="day"] .modal-device-row{background:#E4E9F7!important;border-color:#9EACC6!important;box-shadow:0 12px 26px rgba(16,24,38,.12)!important;}
      body[data-portal-theme="day"] .plan-item:hover,body[data-portal-theme="day"] .oficina-item:hover,body[data-portal-theme="day"] .iot-item:hover,body[data-portal-theme="day"] .adicional-item:hover,body[data-portal-theme="day"] .equipo-item:hover,body[data-portal-theme="day"] .oferta-card:hover,body[data-portal-theme="day"] .modal-item:hover,body[data-portal-theme="day"] .modal-device-row:hover{background:#DDE5F5!important;border-color:#6D1FAD!important;}
      body[data-portal-theme="day"] h1,body[data-portal-theme="day"] h2,body[data-portal-theme="day"] h3,body[data-portal-theme="day"] h4,body[data-portal-theme="day"] .page-title,body[data-portal-theme="day"] .section-title,body[data-portal-theme="day"] .entry-head h2,body[data-portal-theme="day"] .entry-card h3,body[data-portal-theme="day"] .step-head h2,body[data-portal-theme="day"] .device-name,body[data-portal-theme="day"] .modal-selected-title h4,body[data-portal-theme="day"] .prog-title,body[data-portal-theme="day"] .modal-name,body[data-portal-theme="day"] .modal-offer-title,body[data-portal-theme="day"] .accordion-head b,body[data-portal-theme="day"] .product-row b,body[data-portal-theme="day"] .summary-card b{color:#172033!important;}
      body[data-portal-theme="day"] p,body[data-portal-theme="day"] .muted,body[data-portal-theme="day"] .page-sub,body[data-portal-theme="day"] .source,body[data-portal-theme="day"] .section-desc,body[data-portal-theme="day"] .entry-head p,body[data-portal-theme="day"] .entry-card p,body[data-portal-theme="day"] .step-head p,body[data-portal-theme="day"] .line-note,body[data-portal-theme="day"] .state-sub,body[data-portal-theme="day"] .prog-sub,body[data-portal-theme="day"] .modal-offer-note,body[data-portal-theme="day"] .accordion-head span,body[data-portal-theme="day"] .product-row span,body[data-portal-theme="day"] .summary-card span,body[data-portal-theme="day"] .terms li,body[data-portal-theme="day"] .s{color:#5A667A!important;}
      body[data-portal-theme="day"] input,body[data-portal-theme="day"] select,body[data-portal-theme="day"] textarea,body[data-portal-theme="day"] .entry-query,body[data-portal-theme="day"] .plan-select,body[data-portal-theme="day"] .plan-input,body[data-portal-theme="day"] .compare-input{background:#FFFFFF!important;color:#172033!important;border-color:#CBD3E1!important;}
      body[data-portal-theme="day"] code{background:#E0E7FF!important;color:#4C1D95!important;border:1px solid #C4B5FD!important;}
      body[data-portal-theme="day"] .code{background:#E0E7FF!important;color:#4C1D95!important;border:1px solid #C4B5FD!important;}
      body[data-portal-theme="day"] .price{color:#166534!important;}
      body[data-portal-theme="day"] .plan-item-codigo,body[data-portal-theme="day"] .oficina-codigo,body[data-portal-theme="day"] .iot-codigo{background:#E0E7FF!important;color:#4C1D95!important;border:1px solid #C4B5FD!important;}
      body[data-portal-theme="day"] .plan-item-datos,body[data-portal-theme="day"] .oficina-precio,body[data-portal-theme="day"] .iot-datos{color:#5B21B6!important;}
      body[data-portal-theme="day"] .plan-item-precio,body[data-portal-theme="day"] .oficina-autopay,body[data-portal-theme="day"] .iot-precio{color:#166534!important;}
      body[data-portal-theme="day"] .plan-item-nota,body[data-portal-theme="day"] .adicional-tipo,body[data-portal-theme="day"] .backup-code,body[data-portal-theme="day"] .backup-note,body[data-portal-theme="day"] .equipo-sub{color:#4D5A70!important;}
      body[data-portal-theme="day"] .backup-table-wrap,body[data-portal-theme="day"] .plan-offer-table-wrap,body[data-portal-theme="day"] .ep-table-wrap,body[data-portal-theme="day"] .table-wrap{border-color:#AAB6CC!important;background:#E9EEF8!important;}
      body[data-portal-theme="day"] .backup-table,body[data-portal-theme="day"] .plan-offer-table,body[data-portal-theme="day"] .ep-table,body[data-portal-theme="day"] .directory-table{background:#FFFFFF!important;}
      body[data-portal-theme="day"] .backup-table td,body[data-portal-theme="day"] .plan-offer-table td{color:#172033!important;border-top-color:#D8DEEA!important;}
      body[data-portal-theme="day"] .solo-table,body[data-portal-theme="day"] .convergent-table{background:#F8FAFE!important;}
      body[data-portal-theme="day"] .solo-table th,body[data-portal-theme="day"] .convergent-table th{background:#312E81!important;color:#F8FAFC!important;}
      body[data-portal-theme="day"] .solo-table tbody tr:nth-child(even),body[data-portal-theme="day"] .convergent-table tbody tr:nth-child(even){background:#EEF2FF!important;}
      body[data-portal-theme="day"] .solo-table tbody tr:hover,body[data-portal-theme="day"] .convergent-table tbody tr:hover{background:#E0E7FF!important;}
      body[data-portal-theme="day"] .backup-plan,body[data-portal-theme="day"] .equipo-main{color:#172033!important;}
      body[data-portal-theme="day"] .backup-price{color:#166534!important;}
      body[data-portal-theme="day"] .section-name,body[data-portal-theme="day"] .oficina-name,body[data-portal-theme="day"] .adicional-nombre,body[data-portal-theme="day"] .equipo-nombre,body[data-portal-theme="day"] .state-title{color:#172033!important;}
      body[data-portal-theme="day"] .manager-row b{color:#172033!important;}
      body[data-portal-theme="day"] a{color:#075985!important;}
      body[data-portal-theme="day"] .section-sub,body[data-portal-theme="day"] .section-chevron{color:#5B21B6!important;}
      body[data-portal-theme="day"] .oficina-features li,body[data-portal-theme="day"] .nota-item,body[data-portal-theme="day"] .adicionales-title,body[data-portal-theme="day"] .equipos-title,body[data-portal-theme="day"] .state-card,body[data-portal-theme="day"] .oferta-detalle,body[data-portal-theme="day"] .guia-intro{color:#4D5A70!important;}
      body[data-portal-theme="day"] .ep-section-label{color:#4D5A70!important;}
      body[data-portal-theme="day"] [style*="color:rgba(255,255,255"]{color:#4D5A70!important;}
      body[data-portal-theme="day"] .badge-blue{background:#DBEAFE!important;color:#1E3A8A!important;border-color:#93C5FD!important;}
      body[data-portal-theme="day"] .badge-green{background:#DCFCE7!important;color:#166534!important;border-color:#86EFAC!important;}
      body[data-portal-theme="day"] .badge-purple{background:#EDE9FE!important;color:#5B21B6!important;border-color:#C4B5FD!important;}
      body[data-portal-theme="day"] .badge-amber,body[data-portal-theme="day"] .badge-vigencia{background:#FEF3C7!important;color:#92400E!important;border-color:#FCD34D!important;}
      body[data-portal-theme="day"] .pill,body[data-portal-theme="day"] .filter-btn,body[data-portal-theme="day"] .chip,body[data-portal-theme="day"] .btn,body[data-portal-theme="day"] .btn-modal,body[data-portal-theme="day"] .brand-tab,body[data-portal-theme="day"] .portal-return,body[data-portal-theme="day"] .version-badge,body[data-portal-theme="day"] .count-badge,body[data-portal-theme="day"] .section-summary-pill,body[data-portal-theme="day"] .term,body[data-portal-theme="day"] .terms-pill,body[data-portal-theme="day"] .product-family-tab,body[data-portal-theme="day"] .product-tech-tab{background:#FFFFFF!important;color:#172033!important;border-color:#CBD3E1!important;}
      body[data-portal-theme="day"] .pill{color:#5FAD1F!important;border-color:rgba(95,173,31,.35)!important;}
      body[data-portal-theme="day"] .btn.primary,body[data-portal-theme="day"] .segment-btn.active,body[data-portal-theme="day"] .chip.active,body[data-portal-theme="day"] .brand-tab.active{background:#6D1FAD!important;border-color:#6D1FAD!important;color:#FFFFFF!important;}
      body[data-portal-theme="day"] table,body[data-portal-theme="day"] .lines-table,body[data-portal-theme="day"] .plan-table,body[data-portal-theme="day"] .directory-table,body[data-portal-theme="day"] .ep-table{background:#FFFFFF!important;color:#172033!important;}
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
