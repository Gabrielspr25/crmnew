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

  adoptarSesion();
  const base = origenCrm();
  global.PORTAL_API_BASE = base;
  global.portalApiUrl = (path) => (/^https?:\/\//i.test(String(path)) ? String(path) : base + path);
})(window);
