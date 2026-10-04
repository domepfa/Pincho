/* js/audio.js — Töne (beep, gong, Bluetooth-Ausgleich), Vibration, Wake Lock – genutzt von allen Timern */
function beep(freq, duration) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!beep.ctx) beep.ctx = new Ctx();
    // Browser legen die Audio-Ausgabe nach ein paar Sekunden Stille aus
    // Stromspargründen schlafen (state 'suspended') — ohne explizites
    // resume() bleibt sie stumm bzw. wacht spürbar verzögert auf (genau
    // das "Ton kommt zu spät"-Gefühl nach einer längeren stillen Phase,
    // z. B. während eines langen Hangs). Kostet im Normalfall (Context
    // läuft schon) nichts, siehe auch audioKeepWarm().
    if (beep.ctx.state === 'suspended') beep.ctx.resume();
    const osc = beep.ctx.createOscillator();
    const gain = beep.ctx.createGain();
    // Dreieckwelle statt der scharfen Rechteckwelle: klingt wie die
    // elektronischen Pieptöne eines Ski-Startsignals (Skiabfahrt) — klar
    // und mit etwas Charakter, aber runder/angenehmer als der kantige
    // "Retro"-Ton zuvor und immer noch deutlicher als der ursprüngliche,
    // sehr weiche reine Sinuston.
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(gain); gain.connect(beep.ctx.destination);
    gain.gain.setValueAtTime(0.18, beep.ctx.currentTime);
    osc.start();
    osc.stop(beep.ctx.currentTime + duration / 1000);
  } catch (e) { /* Audio nicht verfügbar, kein Problem */ }
}

/* Ein Piepton wird zwar synchron zum Sekunden-Tick ausgelöst, kommt beim
   Hören aber trotzdem noch minimal nach der sichtbaren Änderung an (Geräte-
   /Browser-Audiolatenz lässt sich softwareseitig nicht "in die
   Vergangenheit" vorziehen). Stattdessen wird hier der gegenteilige Hebel
   genutzt: das BILD (Zahl/Ring/Übergang) wird um denselben Betrag NACH dem
   Ton gezeigt, statt gleichzeitig — im Ergebnis wirkt der Ton dann relativ
   zum Bild "vorgezogen". Bei Bedarf einfach diese eine Zahl anpassen. */
const FB_AUDIO_LEAD_BASE_MS = 70;
/* Ton-Ausgleich für Bluetooth: Kopfhörer/Lautsprecher spielen jeden Ton
   150–300 ms später ab. Die Anzeige wartet dann entsprechend länger, damit
   Zahl und Ton wieder zusammenfallen (die Zeiten selbst bleiben exakt).
   'auto' (Standard) nimmt die vom Browser gemeldete Ausgabe-Verzögerung
   (Chrome/Android: outputLatency), sonst fester Wert aus dem Konto. */
const AUDIO_COMP_KEY = STORAGE_PREFIX + 'audio_comp';
function audioCompPref() { try { return localStorage.getItem(AUDIO_COMP_KEY) || 'auto'; } catch (e) { return 'auto'; } }
function audioMeasuredLatencyMs() {
  const ctx = beep.ctx;
  if (!ctx) return null;
  const lat = (Number(ctx.outputLatency) || 0) + (Number(ctx.baseLatency) || 0);
  return lat > 0 ? Math.round(lat * 1000) : null;
}
function fbAudioLeadMs() {
  const pref = audioCompPref();
  if (pref !== 'auto') return FB_AUDIO_LEAD_BASE_MS + (Number(pref) || 0);
  // Handylautsprecher meldet ~10–50 ms (deckt der Grundvorlauf ab); darüber die Differenz ausgleichen, höchstens 500 ms
  const lat = audioMeasuredLatencyMs() || 0;
  return FB_AUDIO_LEAD_BASE_MS + Math.min(500, Math.max(0, lat - 50));
}

/* Hält die Audio-Ausgabe während eines laufenden Ablaufs durchgehend wach
   (für Menschen unhörbar: 20Hz, praktisch Lautstärke 0), damit sie zwischen
   zwei echten Pieptönen (z. B. über eine ganze Hang-Phase hinweg) nicht in
   den Stromspar-Ruhezustand fällt — sonst wacht sie beim nächsten echten
   Piepton (beepTick/beepStart/beepEnd) spürbar verzögert auf. Wird bei
   jedem Sekunden-Tick im Fingerboard-Ablauf mitaufgerufen (siehe tickBlock/
   tickPreCountdown), kostet dabei praktisch nichts. */
function audioKeepWarm() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!beep.ctx) beep.ctx = new Ctx();
    if (beep.ctx.state === 'suspended') beep.ctx.resume();
    const osc = beep.ctx.createOscillator();
    const gain = beep.ctx.createGain();
    osc.frequency.value = 20;
    gain.gain.setValueAtTime(0.00001, beep.ctx.currentTime);
    osc.connect(gain); gain.connect(beep.ctx.destination);
    osc.start();
    osc.stop(beep.ctx.currentTime + 0.05);
  } catch (e) { /* Audio nicht verfügbar, kein Problem */ }
}

/* Zwei akustische Signale statt eines einzelnen Tons pro Ereignis:
   - beepTick(): ein kurzer Piep pro Sekunde — sowohl beim Vorbereitungs-
     Countdown (letzte 3 von 5 Sekunden) als auch am Ende einer Pause
     (letzte 3 Sekunden), damit man auch ohne hinzuschauen merkt, dass es
     gleich weitergeht.
   - beepStart()/beepEnd(): der Wechsel Hang↔Pause. "Start" ist der
     wichtigste Moment (jetzt sofort losgreifen/loslegen) und bekam bisher
     denselben Ton wie "Ende" — im Trainingslärm/ohne hinzuschauen kaum
     auseinanderzuhalten. Start ist jetzt ein höherer, aufsteigender
     Doppelton (klar als "Los!" erkennbar), Ende bleibt der bisherige
     einzelne, tiefere Ton (bewusst "ruhiger" für die Pause). */
function beepTick() {
  beep(1400, 90);
}
/* Kurze Vibration zum Ton (Android; iOS kennt navigator.vibrate nicht). */
function fbBuzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignorieren */ }
}
function beepStart() {
  fbBuzz([60, 40, 60]);
  beep(1568, 110);
  setTimeout(() => beep(1976, 170), 130);
}
function beepEnd() {
  fbBuzz(200);
  beep(1046, 380);
}

/* Gong-Schlag für die Gym-Pausenuhr: statt eines Pieptons mehrere
   Sinus-Teiltöne mit leicht unharmonischen Verhältnissen (typisch für
   Gong/Klangschale), kurzer Anschlag und langes, weiches Ausklingen.
   gongStrikes(n) schlägt n-mal hintereinander, damit man die Pausenlänge
   auch ohne hinzuschauen am Gehör abzählen kann. */
function gong(when) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!beep.ctx) beep.ctx = new Ctx();
    const ctx = beep.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = when ?? ctx.currentTime;
    const base = 220;
    const partials = [[1, 0.22, 2.6], [2.02, 0.09, 1.8], [2.74, 0.06, 1.3], [4.1, 0.03, 0.8]];
    partials.forEach(([ratio, vol, decay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    });
  } catch (e) { /* Audio nicht verfügbar, kein Problem */ }
}
function gongStrikes(n) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!beep.ctx) beep.ctx = new Ctx();
    const start = beep.ctx.currentTime;
    for (let i = 0; i < n; i++) gong(start + i * 0.9);
  } catch (e) { /* Audio nicht verfügbar, kein Problem */ }
}

async function requestWakeLock() {
  if (fb.wakeLock) return; // schon aktiv — nicht doppelt anfordern (würde den Handle auf das alte Lock verlieren)
  try {
    if ('wakeLock' in navigator) {
      fb.wakeLock = await navigator.wakeLock.request('screen');
      // Der Browser gibt das Lock automatisch frei, sobald der Tab in den
      // Hintergrund geht (Screen aus, App-Wechsel, ...) — OHNE dass wir das
      // sonst mitbekommen. fb.wakeLock zeigte danach fälschlich weiter auf
      // ein bereits totes Lock, wodurch der obige Frühausstieg jede weitere
      // Anfrage stillschweigend blockierte und der Screen nie wieder
      // wachgehalten wurde. Sentinel hier zurücksetzen, sobald es freigegeben
      // wird, damit ein späterer requestWakeLock()-Aufruf (siehe
      // visibilitychange unten) tatsächlich neu anfordert.
      fb.wakeLock.addEventListener('release', () => { fb.wakeLock = null; });
    }
  } catch (e) { /* ignorieren */ }
}
function releaseWakeLock() {
  if (fb.wakeLock) { fb.wakeLock.release().catch(() => {}); fb.wakeLock = null; }
}
/* Kommt der Tab aus dem Hintergrund zurück (Screen wieder an, App wieder
   im Vordergrund), während eigentlich noch ein Ablauf/eine Session läuft,
   das Lock aber (siehe oben) automatisch verfallen ist — sofort neu
   anfordern, statt erst beim nächsten Satzwechsel. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const sessionActive = fb.running || fb.preCount != null || !!fsWorkTimer.intervalId || !!fsRestTimer.intervalId;
  if (sessionActive) requestWakeLock();
});
