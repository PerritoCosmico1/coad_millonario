/*
 * IRRUMPE — vista previa del borrador del panel (panel.html).
 *
 * Con `?borrador` en la dirección, la página usa el contenido que se está
 * editando en el panel (guardado en este navegador) en vez de js/config.js,
 * y lo avisa en una esquina. Sin `?borrador` no hace nada.
 */
(function () {
  'use strict';
  if (!/[?&]borrador(=|&|$)/.test(location.search)) return;
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem('irrumpe:borrador') || 'null'); } catch (e) { draft = null; }
  if (!draft || !draft.config) return;
  window.IRRUMPE_CONFIG = draft.config;
  window.IRRUMPE_CONFIG.borrador = true;

  document.addEventListener('DOMContentLoaded', () => {
    // Los links entre la página y la AR siguen mostrando el borrador.
    document.querySelectorAll('a[href]').forEach((a) => {
      const u = new URL(a.getAttribute('href'), location.href);
      if (u.origin !== location.origin || u.searchParams.has('borrador')) return;
      if (!/\/(ar\/)?(index\.html)?$/.test(u.pathname)) return;
      u.searchParams.set('borrador', '');
      a.href = u.href;
    });
    const tag = document.createElement('a');
    tag.href = new URL((location.pathname.includes('/ar/') ? '../' : '') + 'panel.html', location.href).href;
    tag.textContent = 'Borrador · sin publicar';
    tag.style.cssText = 'position:fixed;left:50%;top:max(8px,env(safe-area-inset-top));transform:translateX(-50%);z-index:1000;padding:5px 9px;background:#f11b1a;color:#fff;white-space:nowrap;'
      + 'font:10px "JetBrains Mono",monospace;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;';
    document.body.append(tag);
  });
})();
