/* js/main.js — Start: Hash-Router verdrahten, boot() – muss als letztes Skript geladen werden */
/* Hintergrund-Faultier: Falls das Handy noch die alte index.html (mit der
   Strich-SVG) aus dem Offline-Speicher zeigt, das Bild hier selbst einsetzen
   — sonst passen alte Seite und neues CSS nicht zusammen. */
(() => {
  const bg = document.querySelector('.sloth-bg');
  if (bg && !bg.querySelector('img')) bg.innerHTML = '<img src="' + ASSET_BASE + 'sloth/sloth-bg.png" alt="">';
})();

/* ---------- Start ---------- */
window.addEventListener('hashchange', () => {
  state.route = location.hash ? location.hash.replace('#', '') : defaultRoute();
  render();
});
boot();
