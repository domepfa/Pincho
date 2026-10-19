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
  const next = location.hash ? location.hash.replace('#', '') : defaultRoute();
  // Training läuft: nicht wegnavigieren (Tabs, Konto, Zurück-Taste) – zurück auf Gym, kurzer Hinweis
  if (state.route === 'log' && next !== 'log' && trainingLocked()) {
    history.replaceState(null, '', '#log');
    toast('Training läuft – erst beenden (✓ Beenden unten).', 'err');
    return;
  }
  state.route = next;
  render();
});
boot();
