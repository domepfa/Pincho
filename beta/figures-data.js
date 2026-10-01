/* ================================================================
   figures-data.js — reine SVG-Daten der Übungs-Strichmännchen
   (EXERCISE_FIGURES). Ausgelagert aus app.js, Inhalt unverändert.
   Wird in index.html VOR app.js geladen; gelesen wird es nur in
   Funktionen von app.js (exerciseFigureSvg, showExerciseInfoSheet).
   ================================================================= */

/* ---------- Übungs-Strichmännchen ----------
   Kleine, animierte SVG-Strichmännchen fürs Ablauf-Vollbild: zeigen auf
   einen Blick, welche Bewegung gemeint ist, ohne Foto/Video. Zwei Arten:
   - 'dynamic': zwei Posen (Start/Ende der Bewegung) überblenden in Dauer-
     schlaufe. Fixe Körperteile sind gedämpft (.fig-fixed), bewegte hell,
     der eigentliche Arbeitspunkt (z. B. die ziehende Hand) lime; eine
     gestrichelte Linie + Pfeil zeigt zusätzlich die Bewegungsrichtung.
   - 'static': eine Pose (Halteübung), sanftes Pulsieren statt Bewegung.
   Nicht jede Übung hat schon eine Animation — renderExerciseFigure()
   fällt für alle anderen auf ein Emoji zurück (siehe dort). */
const EXERCISE_FIGURES = {
  face_pull: { kind: 'dynamic', caption: 'Seitenansicht · Zughand kommt zum Gesicht, Ellbogen bleibt hoch', svg: `
    <line class="fig-rig" x1="188" y1="40" x2="188" y2="140"/>
    <circle class="fig-rig-dot" cx="188" cy="90" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="60" r="5"/>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <path class="fig-motion" d="M165,72 L60,71"/>
    <polygon class="fig-arrow" points="60,71 72,65 72,77"/>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <polyline points="99,58 140,62 168,66"/>
      <polyline points="99,66 138,72 166,78"/>
      <circle class="fig-joint fig-mid" cx="140" cy="62" r="4.5"/>
      <circle class="fig-joint fig-mid" cx="138" cy="72" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="168" cy="66" r="6"/>
      <circle class="fig-joint fig-hi" cx="166" cy="78" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <polyline points="99,58 65,54 46,64"/>
      <polyline points="99,66 63,66 44,78"/>
      <circle class="fig-joint fig-mid" cx="65" cy="54" r="4.5"/>
      <circle class="fig-joint fig-mid" cx="63" cy="66" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="46" cy="64" r="6"/>
      <circle class="fig-joint fig-hi" cx="44" cy="78" r="6"/>
    </g>
  ` },
  band_pull_apart: { kind: 'dynamic', caption: 'Vorderansicht, stehend · Arme ziehen das Band nach aussen auseinander', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="66" r="5"/>
    <path class="fig-motion" d="M145,66 L53,66"/>
    <polygon class="fig-arrow" points="53,66 65,60 65,72"/>
    <polygon class="fig-arrow" points="145,66 133,60 133,72"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="66" x2="60" y2="70"/>
      <line x1="99" y1="66" x2="138" y2="70"/>
      <circle class="fig-joint fig-hi" cx="60" cy="70" r="6"/>
      <circle class="fig-joint fig-hi" cx="138" cy="70" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="66" x2="40" y2="60"/>
      <line x1="99" y1="66" x2="158" y2="60"/>
      <circle class="fig-joint fig-hi" cx="40" cy="60" r="6"/>
      <circle class="fig-joint fig-hi" cx="158" cy="60" r="6"/>
    </g>
  ` },
  scapula_pull: { kind: 'dynamic', caption: 'Vorderansicht · Arme bleiben oben gestreckt, nur die Schulterblätter senken sich', svg: `
    <line class="fig-rig" x1="100" y1="14" x2="100" y2="48"/>
    <g class="fig-pose fig-fixed">
      <line x1="70" y1="55" x2="130" y2="55"/>
      <line x1="99" y1="70" x2="99" y2="140"/>
      <line x1="99" y1="140" x2="86" y2="196"/>
      <line x1="99" y1="140" x2="114" y2="196"/>
    </g>
    <path class="fig-motion" d="M99,90 L99,68"/>
    <polygon class="fig-arrow" points="99,64 93,76 105,76"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="99" cy="66" r="15"/>
      <line x1="70" y1="55" x2="99" y2="80"/>
      <line x1="130" y1="55" x2="99" y2="80"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="99" cy="86" r="15"/>
      <line x1="70" y1="55" x2="99" y2="100"/>
      <line x1="130" y1="55" x2="99" y2="100"/>
    </g>
  ` },
  pallof: { kind: 'dynamic', caption: 'Vorderansicht, Band von der Seite gehalten · Arme drücken das Band gerade nach vorne weg', svg: `
    <line class="fig-rig" x1="12" y1="55" x2="12" y2="105"/>
    <circle class="fig-rig-dot" cx="12" cy="80" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M108,78 L150,78"/>
    <polygon class="fig-arrow" points="150,78 138,72 138,84"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <line x1="99" y1="70" x2="108" y2="82"/>
      <line x1="99" y1="78" x2="108" y2="88"/>
      <circle class="fig-joint fig-hi" cx="108" cy="85" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <line x1="99" y1="70" x2="150" y2="76"/>
      <line x1="99" y1="78" x2="150" y2="82"/>
      <circle class="fig-joint fig-hi" cx="150" cy="79" r="6"/>
    </g>
  ` },
  bird_dog: { kind: 'dynamic', caption: 'Seitenansicht, Vierfüsslerstand · gegenüberliegender Arm und Bein strecken sich waagrecht aus', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="55" cy="86" r="14"/>
      <circle cx="42" cy="86" r="3"/>
      <line x1="70" y1="90" x2="150" y2="95"/>
      <line x1="70" y1="90" x2="70" y2="150"/>
      <line x1="150" y1="95" x2="150" y2="150"/>
    </g>
    <circle class="fig-joint" cx="70" cy="90" r="5"/>
    <circle class="fig-joint" cx="150" cy="95" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.3s;">
      <line x1="70" y1="90" x2="85" y2="150"/>
      <line x1="150" y1="95" x2="135" y2="150"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.3s;">
      <line x1="70" y1="90" x2="38" y2="68"/>
      <line x1="150" y1="95" x2="187" y2="108"/>
      <circle class="fig-joint fig-hi" cx="38" cy="68" r="6"/>
      <circle class="fig-joint fig-hi" cx="187" cy="108" r="6"/>
    </g>
  ` },
  crunches: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage · Oberkörper rollt nach vorne/oben ein', svg: `
    <line class="fig-rig" x1="10" y1="160" x2="190" y2="160"/>
    <g class="fig-pose fig-fixed">
      <line x1="120" y1="150" x2="150" y2="120"/>
      <line x1="150" y1="120" x2="148" y2="160"/>
    </g>
    <circle class="fig-joint" cx="120" cy="150" r="5"/>
    <circle class="fig-joint" cx="150" cy="120" r="4.5"/>
    <path class="fig-motion" d="M58,150 Q75,112 90,100"/>
    <polygon class="fig-arrow" points="82,109 92,96 96,111"/>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <line x1="120" y1="150" x2="70" y2="150"/>
      <circle cx="58" cy="150" r="15"/>
      <circle cx="58" cy="137" r="3"/>
      <line x1="100" y1="150" x2="85" y2="163"/>
      <circle class="fig-joint fig-mid" cx="70" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <polyline points="120,150 112,128 100,112"/>
      <circle cx="90" cy="100" r="15"/>
      <circle cx="99" cy="91" r="3"/>
      <line x1="100" y1="112" x2="128" y2="116"/>
      <circle class="fig-joint fig-mid" cx="100" cy="112" r="5"/>
      <circle class="fig-joint fig-hi" cx="128" cy="116" r="6"/>
    </g>
  ` },
  russian_twist: { kind: 'dynamic', caption: 'Seitenansicht, sitzend, Füsse leicht abgehoben · Oberkörper dreht abwechselnd nach links und rechts', svg: `
    <line class="fig-rig" x1="10" y1="170" x2="190" y2="170"/>
    <g class="fig-pose fig-fixed">
      <line x1="115" y1="160" x2="150" y2="130"/>
      <line x1="150" y1="130" x2="148" y2="170"/>
      <circle cx="60" cy="118" r="14"/>
      <circle cx="73" cy="118" r="3"/>
      <line x1="72" y1="128" x2="115" y2="160"/>
    </g>
    <circle class="fig-joint" cx="115" cy="160" r="5"/>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="90" y1="140" x2="120" y2="150"/>
      <circle class="fig-joint fig-hi" cx="120" cy="150" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="90" y1="140" x2="55" y2="152"/>
      <circle class="fig-joint fig-hi" cx="55" cy="152" r="6"/>
    </g>
  ` },
  superman: { kind: 'dynamic', caption: 'Seitenansicht, Bauchlage · Arme und Beine heben sich gleichzeitig vom Boden ab', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <line x1="90" y1="140" x2="130" y2="142"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <circle class="fig-joint" cx="130" cy="142" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.3s;">
      <circle cx="76" cy="140" r="14"/>
      <circle cx="67" cy="149" r="3"/>
      <line x1="90" y1="140" x2="60" y2="146"/>
      <line x1="130" y1="142" x2="160" y2="148"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.3s;">
      <circle cx="70" cy="118" r="14"/>
      <circle cx="57" cy="116" r="3"/>
      <line x1="90" y1="140" x2="55" y2="122"/>
      <line x1="130" y1="142" x2="168" y2="126"/>
      <circle class="fig-joint fig-hi" cx="55" cy="122" r="6"/>
      <circle class="fig-joint fig-hi" cx="168" cy="126" r="6"/>
    </g>
  ` },
  swimmer: { kind: 'dynamic', caption: 'Seitenansicht, Bauchlage · Arm und gegenüberliegendes Bein heben abwechselnd', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <line x1="90" y1="140" x2="130" y2="142"/>
      <circle cx="73" cy="129" r="13"/>
      <circle cx="60" cy="129" r="3"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <circle class="fig-joint" cx="130" cy="142" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="90" y1="140" x2="58" y2="120"/>
      <line x1="130" y1="142" x2="160" y2="150"/>
      <circle class="fig-joint fig-hi" cx="58" cy="120" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="90" y1="140" x2="60" y2="148"/>
      <line x1="130" y1="142" x2="168" y2="124"/>
      <circle class="fig-joint fig-hi" cx="168" cy="124" r="6"/>
    </g>
  ` },
  glute_bridge: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage, Füsse aufgestellt · Becken hebt sich nach oben', svg: `
    <line class="fig-rig" x1="10" y1="170" x2="190" y2="170"/>
    <g class="fig-pose fig-fixed">
      <circle cx="150" cy="150" r="14"/>
      <circle cx="150" cy="137" r="3"/>
      <line x1="138" y1="160" x2="105" y2="160"/>
      <line x1="60" y1="130" x2="60" y2="170"/>
    </g>
    <circle class="fig-joint" cx="105" cy="160" r="5"/>
    <circle class="fig-joint" cx="60" cy="130" r="4.5"/>
    <path class="fig-motion" d="M105,155 L105,130"/>
    <polygon class="fig-arrow" points="105,126 99,138 111,138"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="105" y1="160" x2="60" y2="165"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="105" y1="160" x2="60" y2="130"/>
      <circle class="fig-joint fig-hi" cx="82" cy="145" r="5.5"/>
    </g>
  ` },
  push_up: { kind: 'dynamic', caption: 'Seitenansicht, Bauchlage im Stütz · Körper senkt sich als gerade Linie ab und drückt wieder hoch', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="195" y2="150"/>
    <circle class="fig-joint" cx="55" cy="150" r="5.5"/>
    <circle class="fig-joint" cx="191" cy="149" r="5.5"/>
    <path class="fig-motion" d="M61,127 L60,100"/>
    <polygon class="fig-arrow" points="60,95 53,107 67,107"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <circle cx="44" cy="88" r="14"/>
      <circle cx="40" cy="100" r="3"/>
      <line x1="60" y1="95" x2="135" y2="100"/>
      <line x1="135" y1="100" x2="190" y2="148"/>
      <line x1="60" y1="95" x2="55" y2="150"/>
      <circle class="fig-joint fig-mid" cx="60" cy="95" r="5"/>
      <circle class="fig-joint fig-mid" cx="135" cy="100" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <circle cx="46" cy="124" r="14"/>
      <circle cx="42" cy="136" r="3"/>
      <line x1="62" y1="130" x2="135" y2="133"/>
      <line x1="135" y1="133" x2="190" y2="149"/>
      <polyline points="62,130 82,148 55,150"/>
      <circle class="fig-joint fig-mid" cx="62" cy="130" r="5"/>
      <circle class="fig-joint fig-mid" cx="135" cy="133" r="5"/>
      <circle class="fig-joint fig-hi" cx="82" cy="148" r="5"/>
    </g>
  ` },
  plank: { kind: 'static', caption: 'Seitenansicht, Unterarmstütz, Bauch nach unten · Körper hält eine gerade Linie von Kopf bis Ferse', svg: `
    <line class="fig-rig" x1="10" y1="155" x2="195" y2="155"/>
    <circle class="fig-joint" cx="90" cy="148" r="5.5"/>
    <circle class="fig-joint" cx="191" cy="154" r="5.5"/>
    <g class="fig-pose">
      <circle cx="44" cy="90" r="14"/>
      <circle cx="40" cy="102" r="3"/>
      <line x1="60" y1="97" x2="135" y2="102"/>
      <line x1="135" y1="102" x2="191" y2="150"/>
      <line x1="60" y1="97" x2="58" y2="128"/>
      <line x1="58" y1="128" x2="90" y2="148"/>
    </g>
  ` },
  side_plank: { kind: 'static', caption: 'Seitenansicht, seitlicher Unterarmstütz · unterer Arm stützt, oberer Arm zeigt zur Decke, Hüfte bleibt oben', svg: `
    <line class="fig-rig" x1="10" y1="155" x2="195" y2="155"/>
    <circle class="fig-joint" cx="58" cy="150" r="5.5"/>
    <circle class="fig-joint" cx="191" cy="150" r="5.5"/>
    <g class="fig-pose">
      <circle cx="44" cy="90" r="14"/>
      <circle cx="57" cy="90" r="3"/>
      <line x1="60" y1="97" x2="135" y2="102"/>
      <line x1="135" y1="102" x2="191" y2="150"/>
      <line x1="60" y1="97" x2="58" y2="150"/>
      <line x1="70" y1="88" x2="72" y2="34"/>
    </g>
    <circle class="fig-joint fig-hi" cx="72" cy="32" r="6"/>
  ` },
  hollow_hold: { kind: 'static', caption: 'Seitenansicht, Rückenlage · unterer Rücken bleibt am Boden, Arme und Beine schweben gestreckt', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose">
      <path d="M40,150 Q100,110 160,150" fill="none"/>
      <circle cx="34" cy="140" r="13"/>
      <circle cx="42" cy="130" r="3"/>
      <line x1="46" y1="146" x2="30" y2="120"/>
      <line x1="150" y1="146" x2="168" y2="130"/>
    </g>
    <circle class="fig-joint fig-hi" cx="30" cy="118" r="5.5"/>
    <circle class="fig-joint fig-hi" cx="168" cy="128" r="5.5"/>
  ` },
  ext_rotation: { kind: 'dynamic', caption: 'Von oben, Ellbogen am Körper angewinkelt · Unterarm dreht vom Bauch weg nach aussen', svg: `
    <line class="fig-rig" x1="150" y1="70" x2="150" y2="110"/>
    <circle class="fig-rig-dot" cx="150" cy="90" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="66" x2="99" y2="90"/>
    </g>
    <circle class="fig-joint" cx="99" cy="90" r="5"/>
    <path class="fig-motion" d="M80,95 Q100,108 133,86"/>
    <polygon class="fig-arrow" points="133,86 122,84 128,95"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="90" x2="80" y2="95"/>
      <circle class="fig-joint fig-hi" cx="80" cy="95" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="90" x2="135" y2="85"/>
      <circle class="fig-joint fig-hi" cx="135" cy="85" r="6"/>
    </g>
  ` },
  wrist_ext: { kind: 'dynamic', caption: 'Seitenansicht, Unterarm aufgelegt, Hand über der Kante · Handrücken zieht nach oben', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="68" x2="140" y2="80"/>
      <line x1="140" y1="80" x2="165" y2="80"/>
    </g>
    <circle class="fig-joint" cx="165" cy="80" r="5"/>
    <path class="fig-motion" d="M178,95 L178,68"/>
    <polygon class="fig-arrow" points="178,64 172,75 184,75"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="165" y1="80" x2="180" y2="94"/>
      <circle class="fig-joint fig-hi" cx="180" cy="94" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="165" y1="80" x2="180" y2="65"/>
      <circle class="fig-joint fig-hi" cx="180" cy="65" r="5.5"/>
    </g>
  ` },
  y_t_w: { kind: 'dynamic', caption: 'Vorderansicht, leicht vorgebeugt · Arme heben abwechselnd in Y-, T- und W-Stellung', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="65" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <line x1="99" y1="65" x2="50" y2="60"/>
      <line x1="99" y1="65" x2="148" y2="60"/>
      <circle class="fig-joint fig-hi" cx="50" cy="60" r="6"/>
      <circle class="fig-joint fig-hi" cx="148" cy="60" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <line x1="99" y1="65" x2="60" y2="25"/>
      <line x1="99" y1="65" x2="138" y2="25"/>
      <circle class="fig-joint fig-hi" cx="60" cy="25" r="6"/>
      <circle class="fig-joint fig-hi" cx="138" cy="25" r="6"/>
    </g>
  ` },
  hanging_leg_raise: { kind: 'dynamic', caption: 'Vorderansicht, hängend am Griff · gestreckte Beine heben sich nach vorne/oben', svg: `
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <g class="fig-pose fig-fixed">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="42" r="14"/>
      <line x1="100" y1="58" x2="100" y2="120"/>
    </g>
    <circle class="fig-joint" cx="100" cy="120" r="5"/>
    <path class="fig-motion" d="M100,150 Q125,130 150,108"/>
    <polygon class="fig-arrow" points="150,108 138,110 144,120"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="100" y1="120" x2="90" y2="180"/>
      <line x1="100" y1="120" x2="110" y2="180"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="100" y1="120" x2="150" y2="100"/>
      <line x1="100" y1="120" x2="158" y2="112"/>
      <circle class="fig-joint fig-hi" cx="150" cy="100" r="6"/>
      <circle class="fig-joint fig-hi" cx="158" cy="112" r="6"/>
    </g>
  ` },
  toes_to_bar: { kind: 'dynamic', caption: 'Vorderansicht, hängend am Griff · Beine schwingen nach oben, Zehen Richtung Stange', svg: `
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <g class="fig-pose fig-fixed">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="42" r="14"/>
      <line x1="100" y1="58" x2="100" y2="120"/>
    </g>
    <circle class="fig-joint" cx="100" cy="120" r="5"/>
    <path class="fig-motion" d="M100,150 Q95,90 92,40"/>
    <polygon class="fig-arrow" points="90,30 84,44 96,42"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <line x1="100" y1="120" x2="90" y2="180"/>
      <line x1="100" y1="120" x2="110" y2="180"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <line x1="100" y1="120" x2="85" y2="32"/>
      <line x1="100" y1="120" x2="115" y2="32"/>
      <circle class="fig-joint fig-hi" cx="85" cy="30" r="6"/>
      <circle class="fig-joint fig-hi" cx="115" cy="30" r="6"/>
    </g>
  ` },
  front_lever_prog: { kind: 'dynamic', caption: 'Seitenansicht, hängend am Griff · Körper hebt sich aus dem Hang in die Waagrechte', svg: `
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <g class="fig-pose fig-fixed">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="42" r="14"/>
      <circle cx="100" cy="55" r="3"/>
    </g>
    <circle class="fig-joint" cx="100" cy="58" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.3s;">
      <line x1="100" y1="58" x2="100" y2="120"/>
      <line x1="100" y1="120" x2="90" y2="180"/>
      <line x1="100" y1="120" x2="110" y2="180"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.3s;">
      <line x1="100" y1="58" x2="155" y2="55"/>
      <line x1="155" y1="55" x2="192" y2="52"/>
      <circle class="fig-joint fig-hi" cx="192" cy="52" r="6"/>
    </g>
  ` },
  dips: { kind: 'dynamic', caption: 'Seitenansicht, Stütz auf Barren/Kante · Körper senkt sich mit gebeugten Armen ab und drückt hoch', svg: `
    <line class="fig-rig" x1="55" y1="70" x2="55" y2="76"/>
    <line class="fig-rig" x1="145" y1="70" x2="145" y2="76"/>
    <circle class="fig-joint" cx="70" cy="72" r="5"/>
    <circle class="fig-joint" cx="130" cy="72" r="5"/>
    <path class="fig-motion" d="M100,165 L100,115"/>
    <polygon class="fig-arrow" points="100,110 94,122 106,122"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <circle cx="100" cy="60" r="14"/>
      <circle cx="113" cy="60" r="3"/>
      <line x1="70" y1="72" x2="97" y2="80"/>
      <line x1="130" y1="72" x2="103" y2="80"/>
      <line x1="100" y1="80" x2="100" y2="140"/>
      <line x1="100" y1="140" x2="90" y2="190"/>
      <line x1="100" y1="140" x2="110" y2="190"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <circle cx="100" cy="90" r="14"/>
      <circle cx="113" cy="90" r="3"/>
      <line x1="70" y1="72" x2="97" y2="108"/>
      <line x1="130" y1="72" x2="103" y2="108"/>
      <line x1="100" y1="108" x2="100" y2="168"/>
      <line x1="100" y1="168" x2="90" y2="192"/>
      <line x1="100" y1="168" x2="110" y2="192"/>
    </g>
  ` },
  split_squat: { kind: 'dynamic', caption: 'Seitenansicht, Ausfallschritt, hinterer Fuss erhöht · Knie senkt sich gerade nach unten', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <line class="fig-rig" x1="140" y1="150" x2="175" y2="150"/>
    <circle class="fig-joint" cx="72" cy="196" r="5.5"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="86" cy="76" r="14"/>
      <circle cx="99" cy="76" r="3"/>
      <line x1="100" y1="85" x2="100" y2="128"/>
      <line x1="100" y1="128" x2="80" y2="160"/>
      <line x1="80" y1="160" x2="72" y2="196"/>
      <line x1="100" y1="128" x2="130" y2="150"/>
      <line x1="130" y1="150" x2="158" y2="150"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="80" cy="106" r="14"/>
      <circle cx="93" cy="106" r="3"/>
      <line x1="96" y1="115" x2="98" y2="150"/>
      <line x1="98" y1="150" x2="68" y2="172"/>
      <line x1="68" y1="172" x2="72" y2="196"/>
      <line x1="98" y1="150" x2="132" y2="162"/>
      <line x1="132" y1="162" x2="158" y2="150"/>
      <circle class="fig-joint fig-hi" cx="68" cy="172" r="5.5"/>
    </g>
  ` },
  calf_raise: { kind: 'dynamic', caption: 'Seitenansicht, stehend · Fersen heben sich vom Boden ab in den Zehenstand', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
    </g>
    <path class="fig-motion" d="M99,178 L99,160"/>
    <polygon class="fig-arrow" points="99,155 93,167 105,167"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="88" y2="196"/>
      <line x1="99" y1="138" x2="112" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="88" y2="184"/>
      <line x1="88" y1="184" x2="94" y2="192"/>
      <line x1="99" y1="138" x2="112" y2="184"/>
      <line x1="112" y1="184" x2="118" y2="192"/>
      <circle class="fig-joint fig-hi" cx="88" cy="184" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="112" cy="184" r="4.5"/>
    </g>
  ` },
  tibialis_raise: { kind: 'dynamic', caption: 'Seitenansicht, stehend · Ferse bleibt am Boden, Zehen/Vorfuss heben sich', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
    </g>
    <path class="fig-motion" d="M112,186 L119,168"/>
    <polygon class="fig-arrow" points="122,162 111,167 121,174"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="99" y1="138" x2="88" y2="196"/>
      <line x1="99" y1="138" x2="112" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="99" y1="138" x2="88" y2="192"/>
      <line x1="88" y1="192" x2="98" y2="180"/>
      <line x1="99" y1="138" x2="112" y2="192"/>
      <line x1="112" y1="192" x2="122" y2="180"/>
      <circle class="fig-joint fig-hi" cx="98" cy="180" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="122" cy="180" r="4.5"/>
    </g>
  ` },
  wall_sit: { kind: 'static', caption: 'Seitenansicht, Rücken an der Wand · Oberschenkel waagrecht wie auf einem unsichtbaren Stuhl', svg: `
    <line class="fig-rig" x1="170" y1="18" x2="170" y2="196"/>
    <line class="fig-rig" x1="105" y1="196" x2="170" y2="196"/>
    <circle class="fig-joint" cx="110" cy="196" r="5.5"/>
    <g class="fig-pose">
      <circle cx="165" cy="78" r="14"/>
      <circle cx="152" cy="78" r="3"/>
      <line x1="165" y1="92" x2="165" y2="150"/>
      <line x1="165" y1="150" x2="110" y2="150"/>
      <line x1="110" y1="150" x2="110" y2="196"/>
    </g>
  ` },
  cat_cow: { kind: 'dynamic', caption: 'Seitenansicht, Vierfüsslerstand · Rücken wölbt sich abwechselnd nach oben und hängt durch', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <line x1="70" y1="90" x2="70" y2="150"/>
      <line x1="150" y1="95" x2="150" y2="150"/>
    </g>
    <circle class="fig-joint" cx="70" cy="90" r="5"/>
    <circle class="fig-joint" cx="150" cy="95" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.4s;">
      <circle cx="52" cy="78" r="13"/>
      <circle cx="43" cy="87" r="3"/>
      <polyline points="70,90 110,106 150,95"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.4s;">
      <circle cx="58" cy="102" r="13"/>
      <circle cx="49" cy="93" r="3"/>
      <polyline points="70,90 110,74 150,95"/>
    </g>
  ` },
  worlds_greatest_stretch: { kind: 'dynamic', caption: 'Seitenansicht, Ausfallschritt · Oberkörper und ein Arm drehen sich nach oben zur Decke', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="100" y1="130" x2="75" y2="155"/>
      <line x1="75" y1="155" x2="70" y2="196"/>
      <line x1="100" y1="130" x2="140" y2="170"/>
      <line x1="140" y1="170" x2="158" y2="196"/>
    </g>
    <path class="fig-motion" d="M78,118 Q105,105 135,66"/>
    <polygon class="fig-arrow" points="140,60 128,62 133,72"/>
    <g class="fig-pose fig-a" style="animation-duration:2.4s;">
      <circle cx="86" cy="88" r="13"/>
      <circle cx="88" cy="75" r="3"/>
      <line x1="100" y1="98" x2="100" y2="130"/>
      <line x1="100" y1="100" x2="76" y2="120"/>
      <circle class="fig-joint fig-hi" cx="76" cy="120" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.4s;">
      <circle cx="112" cy="76" r="13"/>
      <circle cx="119" cy="65" r="3"/>
      <line x1="100" y1="98" x2="100" y2="130"/>
      <line x1="100" y1="98" x2="138" y2="62"/>
      <circle class="fig-joint fig-hi" cx="138" cy="62" r="5.5"/>
    </g>
  ` },
  hip_9090: { kind: 'dynamic', caption: 'Von oben, sitzend · beide Knie klappen im 90°-Winkel abwechselnd von einer Seite zur anderen', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="72" r="14"/>
      <line x1="99" y1="86" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="140" r="5"/>
    <path class="fig-motion" d="M140,133 Q99,165 58,133"/>
    <polygon class="fig-arrow" points="55,130 62,140 68,128"/>
    <g class="fig-pose fig-a" style="animation-duration:2.4s;">
      <polyline points="99,140 138,144 148,122"/>
      <polyline points="99,140 68,152 52,142"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.4s;">
      <polyline points="99,140 60,144 50,122"/>
      <polyline points="99,140 131,152 147,142"/>
    </g>
  ` },
  thoracic_rotation: { kind: 'dynamic', caption: 'Seitenansicht, Vierfüsslerstand · ein Arm dreht unter dem Körper durch und wieder nach oben zur Decke', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="55" cy="80" r="13"/>
      <circle cx="42" cy="80" r="3"/>
      <line x1="70" y1="90" x2="150" y2="95"/>
      <line x1="70" y1="90" x2="70" y2="150"/>
      <line x1="150" y1="95" x2="150" y2="150"/>
    </g>
    <path class="fig-motion" d="M115,125 Q90,90 55,45"/>
    <polygon class="fig-arrow" points="50,40 55,52 63,44"/>
    <g class="fig-pose fig-a" style="animation-duration:2.5s;">
      <line x1="70" y1="90" x2="118" y2="128"/>
      <circle class="fig-joint fig-hi" cx="118" cy="128" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.5s;">
      <line x1="70" y1="90" x2="48" y2="38"/>
      <circle class="fig-joint fig-hi" cx="48" cy="38" r="5.5"/>
    </g>
  ` },
  shoulder_circles_band: { kind: 'dynamic', caption: 'Seitenansicht, stehend · gestreckte Arme kreisen mit dem Band von unten nach oben', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="62" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <line x1="99" y1="62" x2="132" y2="92"/>
      <line x1="99" y1="70" x2="130" y2="98"/>
      <circle class="fig-joint fig-hi" cx="132" cy="92" r="6"/>
      <circle class="fig-joint fig-hi" cx="130" cy="98" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <line x1="99" y1="62" x2="68" y2="30"/>
      <line x1="99" y1="70" x2="66" y2="38"/>
      <circle class="fig-joint fig-hi" cx="68" cy="30" r="6"/>
      <circle class="fig-joint fig-hi" cx="66" cy="38" r="6"/>
    </g>
  ` },
  wrist_mobility: { kind: 'dynamic', caption: 'Seitenansicht, Arme vorgestreckt · Handgelenke kippen auf und ab', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="97" y1="68" x2="78" y2="95"/>
      <line x1="97" y1="72" x2="118" y2="97"/>
    </g>
    <circle class="fig-joint" cx="78" cy="95" r="4.5"/>
    <circle class="fig-joint" cx="118" cy="97" r="4.5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="78" y1="95" x2="66" y2="86"/>
      <line x1="118" y1="97" x2="130" y2="108"/>
      <circle class="fig-joint fig-hi" cx="66" cy="86" r="5"/>
      <circle class="fig-joint fig-hi" cx="130" cy="108" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="78" y1="95" x2="66" y2="106"/>
      <line x1="118" y1="97" x2="130" y2="86"/>
      <circle class="fig-joint fig-hi" cx="66" cy="106" r="5"/>
      <circle class="fig-joint fig-hi" cx="130" cy="86" r="5"/>
    </g>
  ` },
  leg_swings: { kind: 'dynamic', caption: 'Seitenansicht, an etwas festhalten · gestrecktes Bein schwingt nach vorne und hinten', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="108" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <path class="fig-motion" d="M78,178 Q100,160 128,172"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="130" y2="172"/>
      <circle class="fig-joint fig-hi" cx="130" cy="172" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="72" y2="178"/>
      <circle class="fig-joint fig-hi" cx="72" cy="178" r="5.5"/>
    </g>
  ` },
  ankle_rocks: { kind: 'dynamic', caption: 'Seitenansicht, stehend · Knie schiebt über die Zehenspitzen, Ferse bleibt am Boden', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="120" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <circle class="fig-joint" cx="83" cy="196" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="138" x2="85" y2="170"/>
      <line x1="85" y1="170" x2="83" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="138" x2="100" y2="175"/>
      <line x1="100" y1="175" x2="83" y2="196"/>
      <circle class="fig-joint fig-hi" cx="100" cy="175" r="5"/>
    </g>
  ` },
  neck_mobility: { kind: 'dynamic', caption: 'Vorderansicht · Kopf dreht langsam nach links und rechts', svg: `
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="55" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="55" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="83" cy="40" r="15"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="115" cy="40" r="15"/>
    </g>
  ` },
  doorway_pec_stretch: { kind: 'static', caption: 'Vorderansicht, Arm im Türrahmen angewinkelt · Körper dreht von der Wand weg, Brust dehnt sich', svg: `
    <line class="fig-rig" x1="155" y1="18" x2="155" y2="196"/>
    <circle class="fig-joint" cx="150" cy="65" r="5.5"/>
    <g class="fig-pose">
      <circle cx="93" cy="42" r="15"/>
      <line x1="97" y1="60" x2="105" y2="138"/>
      <line x1="105" y1="138" x2="92" y2="196"/>
      <line x1="105" y1="138" x2="118" y2="196"/>
      <line x1="97" y1="65" x2="150" y2="65"/>
    </g>
  ` },
  jump_rope: { kind: 'dynamic', caption: 'Seitenansicht, stehend · beide Füsse federn leicht ab, während das Seil unter den Füssen durchschwingt', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="120"/>
    </g>
    <circle class="fig-joint" cx="99" cy="120" r="5"/>
    <path class="fig-motion" d="M99,178 L99,160"/>
    <polygon class="fig-arrow" points="99,155 93,167 105,167"/>
    <g class="fig-pose fig-a" style="animation-duration:1s;">
      <line x1="99" y1="120" x2="86" y2="188"/>
      <line x1="99" y1="120" x2="112" y2="188"/>
      <line x1="99" y1="75" x2="82" y2="108"/>
      <line x1="99" y1="75" x2="116" y2="108"/>
      <circle class="fig-joint fig-hi" cx="82" cy="108" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="116" cy="108" r="4.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1s;">
      <line x1="99" y1="120" x2="90" y2="172"/>
      <line x1="99" y1="120" x2="108" y2="172"/>
      <line x1="99" y1="75" x2="78" y2="98"/>
      <line x1="99" y1="75" x2="120" y2="98"/>
      <circle class="fig-joint fig-hi" cx="78" cy="98" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="120" cy="98" r="4.5"/>
    </g>
  ` },
  jefferson_curl: { kind: 'dynamic', caption: 'Seitenansicht, auf einer Box stehend, leichtes Gewicht in den Händen · Wirbelsäule rollt Wirbel für Wirbel nach unten ein und wieder auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <path class="fig-motion" d="M90,70 Q65,110 58,160"/>
    <polygon class="fig-arrow" points="58,160 62,148 70,157"/>
    <g class="fig-pose fig-a" style="animation-duration:2.3s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="70" x2="94" y2="130"/>
      <circle class="fig-joint fig-hi" cx="94" cy="130" r="4.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.3s;">
      <path d="M99,138 Q75,100 62,55" fill="none"/>
      <circle cx="55" cy="48" r="14"/>
      <line x1="80" y1="90" x2="58" y2="175"/>
      <circle class="fig-joint fig-hi" cx="58" cy="175" r="4.5"/>
    </g>
  ` },
  hip_adduction_machine: { kind: 'dynamic', caption: 'Vorderansicht, sitzend an der Maschine · Beine drücken gegen den Widerstand zusammen', svg: `
    <line class="fig-rig" x1="60" y1="150" x2="140" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="60" r="14"/>
      <circle cx="112" cy="60" r="3"/>
      <line x1="99" y1="74" x2="99" y2="130"/>
    </g>
    <circle class="fig-joint" cx="99" cy="130" r="5"/>
    <path class="fig-motion" d="M70,160 L92,160"/>
    <polygon class="fig-arrow" points="92,160 84,155 84,165"/>
    <path class="fig-motion" d="M128,160 L106,160"/>
    <polygon class="fig-arrow" points="106,160 114,155 114,165"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="130" x2="65" y2="160"/>
      <line x1="99" y1="130" x2="133" y2="160"/>
      <circle class="fig-joint fig-hi" cx="65" cy="160" r="5"/>
      <circle class="fig-joint fig-hi" cx="133" cy="160" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="130" x2="88" y2="160"/>
      <line x1="99" y1="130" x2="110" y2="160"/>
      <circle class="fig-joint fig-hi" cx="88" cy="160" r="5"/>
      <circle class="fig-joint fig-hi" cx="110" cy="160" r="5"/>
    </g>
  ` },
  hip_abduction_machine: { kind: 'dynamic', caption: 'Vorderansicht, sitzend an der Maschine · Beine drücken gegen den Widerstand auseinander', svg: `
    <line class="fig-rig" x1="60" y1="150" x2="140" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="60" r="14"/>
      <circle cx="112" cy="60" r="3"/>
      <line x1="99" y1="74" x2="99" y2="130"/>
    </g>
    <circle class="fig-joint" cx="99" cy="130" r="5"/>
    <path class="fig-motion" d="M92,160 L70,160"/>
    <polygon class="fig-arrow" points="70,160 78,155 78,165"/>
    <path class="fig-motion" d="M106,160 L128,160"/>
    <polygon class="fig-arrow" points="128,160 120,155 120,165"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="130" x2="88" y2="160"/>
      <line x1="99" y1="130" x2="110" y2="160"/>
      <circle class="fig-joint fig-hi" cx="88" cy="160" r="5"/>
      <circle class="fig-joint fig-hi" cx="110" cy="160" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="130" x2="65" y2="160"/>
      <line x1="99" y1="130" x2="133" y2="160"/>
      <circle class="fig-joint fig-hi" cx="65" cy="160" r="5"/>
      <circle class="fig-joint fig-hi" cx="133" cy="160" r="5"/>
    </g>
  ` },
  standwaage: { kind: 'static', caption: 'Seitenansicht, Einbeinstand · Oberkörper und freies Bein bilden eine waagrechte Linie, Arme stabilisieren seitlich', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <g class="fig-pose">
      <circle cx="130" cy="70" r="14"/>
      <circle cx="140" cy="76" r="3"/>
      <line x1="122" y1="82" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="90" y2="196"/>
      <line x1="99" y1="150" x2="45" y2="130"/>
      <line x1="122" y1="90" x2="150" y2="60"/>
      <line x1="122" y1="90" x2="95" y2="65"/>
    </g>
    <circle class="fig-joint fig-hi" cx="45" cy="130" r="5.5"/>
  ` },
  cable_glute_kickback: { kind: 'dynamic', caption: 'Seitenansicht, stehend am Kabelzug · gestrecktes Bein drückt gegen den Widerstand nach hinten', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="10" y2="196"/>
    <circle class="fig-rig-dot" cx="10" cy="180" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="120"/>
      <line x1="99" y1="120" x2="90" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="120" r="5"/>
    <path class="fig-motion" d="M60,160 L30,178"/>
    <polygon class="fig-arrow" points="30,178 40,172 38,182"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="120" x2="70" y2="150"/>
      <line x1="70" y1="150" x2="55" y2="185"/>
      <circle class="fig-joint fig-hi" cx="55" cy="185" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="120" x2="55" y2="115"/>
      <line x1="55" y1="115" x2="18" y2="130"/>
      <circle class="fig-joint fig-hi" cx="18" cy="130" r="5.5"/>
    </g>
  ` },
  heel_touches: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage, Beine angewinkelt · Oberkörper hebt sich leicht und tippt abwechselnd zur rechten und linken Ferse', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="60" y1="150" x2="55" y2="196"/>
      <line x1="140" y1="150" x2="145" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="130" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <circle cx="60" cy="110" r="13"/>
      <circle cx="66" cy="118" r="3"/>
      <line x1="70" y1="122" x2="99" y2="130"/>
      <line x1="99" y1="130" x2="60" y2="150"/>
      <line x1="99" y1="130" x2="140" y2="150"/>
      <line x1="70" y1="120" x2="55" y2="190"/>
      <circle class="fig-joint fig-hi" cx="55" cy="190" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <circle cx="140" cy="110" r="13"/>
      <circle cx="134" cy="118" r="3"/>
      <line x1="130" y1="122" x2="99" y2="130"/>
      <line x1="99" y1="130" x2="60" y2="150"/>
      <line x1="99" y1="130" x2="140" y2="150"/>
      <line x1="130" y1="120" x2="145" y2="190"/>
      <circle class="fig-joint fig-hi" cx="145" cy="190" r="5"/>
    </g>
  ` },
  side_bend_dumbbell: { kind: 'dynamic', caption: 'Vorderansicht, stehend, Kurzhantel in einer Hand · Oberkörper neigt sich seitlich zur Gewichtsseite und richtet sich wieder auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <path class="fig-motion" d="M99,60 L118,75"/>
    <polygon class="fig-arrow" points="118,75 106,72 112,82"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="70" x2="99" y2="130"/>
      <circle class="fig-joint fig-hi" cx="99" cy="130" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <path d="M99,138 Q108,95 130,60" fill="none"/>
      <circle cx="136" cy="52" r="15"/>
      <line x1="120" y1="80" x2="140" y2="130"/>
      <circle class="fig-joint fig-hi" cx="140" cy="130" r="5"/>
    </g>
  ` },
  side_bend_cable: { kind: 'dynamic', caption: 'Seitenansicht zum Kabelzug · Oberkörper neigt sich gegen den Widerstand zur Seite und richtet sich kontrolliert wieder auf', svg: `
    <line class="fig-rig" x1="180" y1="20" x2="180" y2="60"/>
    <circle class="fig-rig-dot" cx="180" cy="40" r="6"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="65" x2="150" y2="55"/>
      <circle class="fig-joint fig-hi" cx="150" cy="55" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <path d="M99,138 Q108,95 130,60" fill="none"/>
      <circle cx="136" cy="52" r="15"/>
      <line x1="130" y1="60" x2="165" y2="42"/>
      <circle class="fig-joint fig-hi" cx="165" cy="42" r="5"/>
    </g>
  ` },
  cable_crunch: { kind: 'dynamic', caption: 'Seitenansicht, kniend vor dem Kabelzug · Oberkörper rollt mit angespanntem Bauch nach unten ein', svg: `
    <line class="fig-rig" x1="99" y1="10" x2="99" y2="35"/>
    <circle class="fig-rig-dot" cx="99" cy="25" r="6"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="140" x2="80" y2="196"/>
      <line x1="99" y1="140" x2="118" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="140" r="5"/>
    <path class="fig-motion" d="M99,70 Q99,100 99,120"/>
    <polygon class="fig-arrow" points="99,124 93,112 105,112"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="45" r="14"/>
      <line x1="97" y1="59" x2="99" y2="140"/>
      <line x1="97" y1="50" x2="99" y2="35"/>
      <circle class="fig-joint fig-hi" cx="97" cy="45" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <path d="M99,140 Q95,95 90,75" fill="none"/>
      <circle cx="86" cy="65" r="14"/>
      <line x1="86" y1="70" x2="99" y2="35"/>
      <circle class="fig-joint fig-hi" cx="86" cy="65" r="5"/>
    </g>
  ` },
  one_arm_row_dumbbell: { kind: 'dynamic', caption: 'Seitenansicht, ein Knie und eine Hand auf der Bank abgestützt · freier Arm zieht die Hantel zur Hüfte hoch', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="120" y2="150"/>
    <circle class="fig-joint" cx="60" cy="150" r="5"/>
    <circle class="fig-joint" cx="110" cy="150" r="5"/>
    <path class="fig-motion" d="M150,175 L150,140"/>
    <polygon class="fig-arrow" points="150,135 144,147 156,147"/>
    <g class="fig-pose fig-fixed">
      <circle cx="125" cy="90" r="14"/>
      <circle cx="118" cy="98" r="3"/>
      <line x1="115" y1="100" x2="112" y2="150"/>
      <line x1="130" y1="100" x2="60" y2="150"/>
      <line x1="112" y1="150" x2="130" y2="196"/>
      <line x1="112" y1="150" x2="95" y2="196"/>
    </g>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="120" y1="105" x2="150" y2="178"/>
      <circle class="fig-joint fig-hi" cx="150" cy="178" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="120" y1="105" x2="150" y2="140"/>
      <circle class="fig-joint fig-hi" cx="150" cy="140" r="5.5"/>
    </g>
  ` },
  cable_curl_low_pulley: { kind: 'dynamic', caption: 'Seitenansicht, stehend am tiefen Kabelzug · Unterarm curlt mit gestrecktem Oberarm nach oben zur Schulter', svg: `
    <line class="fig-rig" x1="130" y1="180" x2="130" y2="196"/>
    <circle class="fig-rig-dot" cx="130" cy="188" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M120,150 Q125,100 110,75"/>
    <polygon class="fig-arrow" points="106,68 105,80 116,76"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="70" x2="122" y2="130"/>
      <line x1="122" y1="130" x2="128" y2="180"/>
      <circle class="fig-joint fig-hi" cx="128" cy="180" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="70" x2="122" y2="90"/>
      <line x1="122" y1="90" x2="108" y2="68"/>
      <circle class="fig-joint fig-hi" cx="108" cy="68" r="5.5"/>
    </g>
  ` },
  glute_bridge_side_step: { kind: 'dynamic', caption: 'Seitenansicht, Hüftbrücke mit Band um die Knie · Hüfte bleibt oben, ein Knie tritt seitlich zur Seite und zurück', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="44" cy="150" r="13"/>
      <circle cx="52" cy="158" r="3"/>
      <line x1="56" y1="160" x2="120" y2="150"/>
    </g>
    <circle class="fig-joint" cx="120" cy="150" r="5"/>
    <path class="fig-motion" d="M150,165 L175,170"/>
    <polygon class="fig-arrow" points="175,170 165,164 165,175"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="120" y1="150" x2="150" y2="165"/>
      <line x1="150" y1="165" x2="150" y2="196"/>
      <circle class="fig-joint fig-hi" cx="150" cy="196" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="120" y1="150" x2="150" y2="165"/>
      <line x1="150" y1="165" x2="178" y2="185"/>
      <circle class="fig-joint fig-hi" cx="178" cy="185" r="5"/>
    </g>
  ` },
  box_step_stepper: { kind: 'dynamic', caption: 'Seitenansicht, Stepper vor sich · ein Bein steigt hinauf und streckt sich oben durch, danach Seite wechseln', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="70" y2="196"/>
    <line class="fig-rig" x1="70" y1="150" x2="140" y2="150"/>
    <circle class="fig-joint" cx="70" cy="150" r="5"/>
    <path class="fig-motion" d="M130,180 L130,155"/>
    <polygon class="fig-arrow" points="130,150 124,162 136,162"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="88" cy="86" r="14"/>
      <circle cx="80" cy="90" r="3"/>
      <line x1="92" y1="95" x2="95" y2="140"/>
      <line x1="95" y1="140" x2="80" y2="196"/>
      <line x1="95" y1="140" x2="130" y2="180"/>
      <circle class="fig-joint fig-hi" cx="130" cy="180" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="112" cy="82" r="14"/>
      <circle cx="104" cy="86" r="3"/>
      <line x1="115" y1="92" x2="112" y2="132"/>
      <line x1="112" y1="132" x2="130" y2="150"/>
      <line x1="112" y1="132" x2="90" y2="170"/>
      <circle class="fig-joint fig-hi" cx="90" cy="170" r="5.5"/>
    </g>
  ` },
  lateral_shuffle: { kind: 'dynamic', caption: 'Vorderansicht, tiefe Haltung · schnelle Seitschritte, Füsse bleiben nah am Boden, Oberkörper stabil', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M90,170 L140,175"/>
    <polygon class="fig-arrow" points="140,175 130,170 132,180"/>
    <g class="fig-pose fig-a" style="animation-duration:1s;">
      <circle cx="97" cy="95" r="14"/>
      <line x1="97" y1="109" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="80" y2="196"/>
      <line x1="99" y1="150" x2="118" y2="196"/>
      <line x1="97" y1="115" x2="70" y2="140"/>
      <line x1="97" y1="115" x2="124" y2="140"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1s;">
      <circle cx="120" cy="95" r="14"/>
      <line x1="120" y1="109" x2="122" y2="150"/>
      <line x1="122" y1="150" x2="105" y2="196"/>
      <line x1="122" y1="150" x2="145" y2="196"/>
      <line x1="120" y1="115" x2="93" y2="135"/>
      <line x1="120" y1="115" x2="150" y2="135"/>
      <circle class="fig-joint fig-hi" cx="145" cy="196" r="5"/>
    </g>
  ` },
  carioca: { kind: 'dynamic', caption: 'Seitwärts laufen mit über- und untergekreuzten Schritten · Hüfte bleibt beweglich', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,170 L130,180"/>
    <polygon class="fig-arrow" points="130,180 120,176 122,186"/>
    <g class="fig-pose fig-a" style="animation-duration:1.1s;">
      <circle cx="97" cy="95" r="14"/>
      <line x1="97" y1="109" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="70" y2="185"/>
      <line x1="99" y1="150" x2="128" y2="185"/>
      <circle class="fig-joint fig-hi" cx="70" cy="185" r="4.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.1s;">
      <circle cx="115" cy="95" r="14"/>
      <line x1="115" y1="109" x2="117" y2="150"/>
      <line x1="117" y1="150" x2="140" y2="185"/>
      <line x1="117" y1="150" x2="90" y2="180"/>
      <circle class="fig-joint fig-hi" cx="90" cy="180" r="4.5"/>
    </g>
  ` },
  quick_feet: { kind: 'dynamic', caption: 'Auf der Stelle, so schnell wie möglich die Füsse abwechselnd kurz antippen, aufrechte Haltung', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="60" r="14"/>
      <line x1="97" y1="74" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="140" r="5"/>
    <path class="fig-motion" d="M99,178 L99,165"/>
    <polygon class="fig-arrow" points="99,160 93,172 105,172"/>
    <g class="fig-pose fig-a" style="animation-duration:0.7s;">
      <line x1="99" y1="140" x2="88" y2="196"/>
      <line x1="99" y1="140" x2="106" y2="185"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:0.7s;">
      <line x1="99" y1="140" x2="92" y2="185"/>
      <line x1="99" y1="140" x2="112" y2="196"/>
    </g>
  ` },
  high_knees: { kind: 'dynamic', caption: 'Auf der Stelle oder vorwärts laufen · Knie explosiv bis auf Hüfthöhe anheben', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="60" r="14"/>
      <line x1="97" y1="74" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="140" r="5"/>
    <path class="fig-motion" d="M115,180 L115,110"/>
    <polygon class="fig-arrow" points="115,105 109,117 121,117"/>
    <g class="fig-pose fig-a" style="animation-duration:0.9s;">
      <line x1="99" y1="140" x2="85" y2="196"/>
      <line x1="99" y1="140" x2="115" y2="185"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:0.9s;">
      <line x1="99" y1="140" x2="90" y2="185"/>
      <line x1="99" y1="140" x2="115" y2="110"/>
      <line x1="115" y1="110" x2="120" y2="150"/>
      <circle class="fig-joint fig-hi" cx="115" cy="110" r="5"/>
    </g>
  ` },
  single_leg_hops: { kind: 'dynamic', caption: 'Auf einem Bein kontrolliert vorwärts oder seitlich springen, weich in den Knien abfedern', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,175 Q125,150 145,175"/>
    <polygon class="fig-arrow" points="145,175 138,168 133,178"/>
    <g class="fig-pose fig-a" style="animation-duration:1.3s;">
      <circle cx="97" cy="95" r="14"/>
      <line x1="97" y1="109" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="90" y2="196"/>
      <line x1="99" y1="150" x2="110" y2="180"/>
      <line x1="110" y1="180" x2="105" y2="196"/>
      <circle class="fig-joint fig-hi" cx="90" cy="196" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.3s;">
      <circle cx="120" cy="80" r="14"/>
      <line x1="120" y1="94" x2="122" y2="140"/>
      <line x1="122" y1="140" x2="145" y2="180"/>
      <line x1="122" y1="140" x2="105" y2="160"/>
      <line x1="105" y1="160" x2="95" y2="145"/>
      <circle class="fig-joint fig-hi" cx="145" cy="180" r="5"/>
    </g>
  ` },
  lateral_bounds: { kind: 'dynamic', caption: 'Seitlich von einem Bein aufs andere springen, weich abfedern, kurz stabilisieren, dann zurückspringen', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M70,170 Q99,140 128,170"/>
    <polygon class="fig-arrow" points="128,170 118,166 118,176"/>
    <g class="fig-pose fig-a" style="animation-duration:1.2s;">
      <circle cx="75" cy="90" r="14"/>
      <line x1="78" y1="104" x2="80" y2="145"/>
      <line x1="80" y1="145" x2="65" y2="196"/>
      <line x1="80" y1="145" x2="105" y2="175"/>
      <line x1="105" y1="175" x2="100" y2="196"/>
      <circle class="fig-joint fig-hi" cx="65" cy="196" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.2s;">
      <circle cx="123" cy="90" r="14"/>
      <line x1="120" y1="104" x2="118" y2="145"/>
      <line x1="118" y1="145" x2="133" y2="196"/>
      <line x1="118" y1="145" x2="93" y2="175"/>
      <line x1="93" y1="175" x2="98" y2="196"/>
      <circle class="fig-joint fig-hi" cx="133" cy="196" r="5"/>
    </g>
  ` },
  shuttle_sprint: { kind: 'dynamic', caption: 'Kurze Sprints zwischen Markierungen, schnelles Abstoppen und Richtungswechsel', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M60,180 L150,180"/>
    <polygon class="fig-arrow" points="150,180 140,175 140,185"/>
    <g class="fig-pose fig-a" style="animation-duration:1s;">
      <circle cx="80" cy="90" r="14"/>
      <line x1="83" y1="104" x2="90" y2="145"/>
      <line x1="90" y1="145" x2="60" y2="180"/>
      <line x1="90" y1="145" x2="120" y2="160"/>
      <line x1="120" y1="160" x2="140" y2="140"/>
      <circle class="fig-joint fig-hi" cx="60" cy="180" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1s;">
      <circle cx="120" cy="90" r="14"/>
      <line x1="117" y1="104" x2="110" y2="145"/>
      <line x1="110" y1="145" x2="150" y2="180"/>
      <line x1="110" y1="145" x2="80" y2="160"/>
      <line x1="80" y1="160" x2="60" y2="140"/>
      <circle class="fig-joint fig-hi" cx="150" cy="180" r="5"/>
    </g>
  ` },
  agility_ladder_run: { kind: 'dynamic', caption: 'Schnelle, kurze Schritte durch eine Koordinationsleiter (oder markierte Felder), verschiedene Schrittmuster möglich', svg: `
    <line class="fig-rig" x1="60" y1="196" x2="60" y2="185"/>
    <line class="fig-rig" x1="100" y1="196" x2="100" y2="185"/>
    <line class="fig-rig" x1="140" y1="196" x2="140" y2="185"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="70" r="14"/>
      <line x1="97" y1="84" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="140" r="5"/>
    <path class="fig-motion" d="M99,178 L120,165"/>
    <polygon class="fig-arrow" points="120,165 110,164 113,174"/>
    <g class="fig-pose fig-a" style="animation-duration:0.8s;">
      <line x1="99" y1="140" x2="90" y2="196"/>
      <line x1="99" y1="140" x2="108" y2="170"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:0.8s;">
      <line x1="99" y1="140" x2="95" y2="170"/>
      <line x1="99" y1="140" x2="120" y2="196"/>
    </g>
  ` },
  couch_stretch: { kind: 'static', caption: 'Seitenansicht, hinteres Knie am Boden · Fussrücken an Wand/Couch abgestützt, Becken schiebt sich nach vorne unten', svg: `
    <line class="fig-rig" x1="150" y1="60" x2="150" y2="196"/>
    <circle class="fig-joint" cx="150" cy="170" r="5.5"/>
    <g class="fig-pose">
      <circle cx="70" cy="90" r="14"/>
      <circle cx="78" cy="96" r="3"/>
      <line x1="70" y1="104" x2="90" y2="150"/>
      <line x1="90" y1="150" x2="80" y2="196"/>
      <line x1="90" y1="150" x2="130" y2="180"/>
      <line x1="130" y1="180" x2="150" y2="170"/>
    </g>
  ` },
  figure_four_stretch: { kind: 'static', caption: 'Seitenansicht, Rückenlage · ein Knöchel liegt auf dem gegenüberliegenden Knie, das freie Bein zieht sich zur Brust', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <g class="fig-pose">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="30" cy="130" r="3"/>
      <line x1="46" y1="146" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="130" y2="120"/>
      <line x1="130" y1="120" x2="150" y2="145"/>
      <line x1="99" y1="150" x2="115" y2="105"/>
      <line x1="46" y1="146" x2="130" y2="110"/>
    </g>
  ` },
  frog_stretch: { kind: 'static', caption: 'Vierfüsslerstand, Knie weit auseinander nach aussen · Gesäss senkt sich langsam Richtung Fersen ab', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <g class="fig-pose">
      <circle cx="99" cy="115" r="14"/>
      <line x1="99" y1="129" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="60" y2="180"/>
      <line x1="60" y1="180" x2="60" y2="196"/>
      <line x1="99" y1="150" x2="138" y2="180"/>
      <line x1="138" y1="180" x2="138" y2="196"/>
      <line x1="99" y1="129" x2="75" y2="150"/>
      <line x1="99" y1="129" x2="123" y2="150"/>
    </g>
  ` },
  deep_squat_hold: { kind: 'static', caption: 'Seitenansicht, Füsse schulterbreit · so tief wie möglich in die Hocke, Fersen bleiben am Boden, Position ruhig halten', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5.5"/>
    <g class="fig-pose">
      <circle cx="107" cy="95" r="15"/>
      <line x1="103" y1="110" x2="99" y2="155"/>
      <line x1="99" y1="155" x2="70" y2="180"/>
      <line x1="70" y1="180" x2="76" y2="196"/>
      <line x1="99" y1="155" x2="128" y2="180"/>
      <line x1="128" y1="180" x2="122" y2="196"/>
      <line x1="103" y1="115" x2="80" y2="140"/>
      <line x1="103" y1="115" x2="126" y2="140"/>
    </g>
  ` },
  spiderman_lunge_rotation: { kind: 'dynamic', caption: 'Seitenansicht, grosser Ausfallschritt · innere Hand stützt neben dem vorderen Fuss, Oberkörper dreht sich zur Decke auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,80 Q130,90 150,70"/>
    <polygon class="fig-arrow" points="150,70 138,70 142,80"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="150" x2="60" y2="175"/>
      <line x1="60" y1="175" x2="55" y2="196"/>
      <line x1="99" y1="150" x2="130" y2="185"/>
      <line x1="130" y1="185" x2="150" y2="196"/>
      <line x1="99" y1="150" x2="60" y2="185"/>
    </g>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <circle cx="80" cy="100" r="14"/>
      <line x1="88" y1="110" x2="99" y2="150"/>
      <line x1="90" y1="105" x2="115" y2="80"/>
      <circle class="fig-joint fig-hi" cx="115" cy="80" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <circle cx="105" cy="80" r="14"/>
      <line x1="108" y1="94" x2="99" y2="150"/>
      <line x1="112" y1="85" x2="150" y2="65"/>
      <circle class="fig-joint fig-hi" cx="150" cy="65" r="5"/>
    </g>
  ` },
  standing_hip_circles: { kind: 'dynamic', caption: 'Vorderansicht, hüftbreiter Stand · grosse, kontrollierte Kreise mit der Hüfte in beide Richtungen', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="130"/>
    </g>
    <circle class="fig-joint" cx="99" cy="130" r="5"/>
    <path class="fig-motion" d="M119,150 A20,12 0 1 1 118.9,150"/>
    <polygon class="fig-arrow" points="119,150 110,146 112,157"/>
    <g class="fig-pose fig-a" style="animation-duration:2.4s;">
      <line x1="99" y1="130" x2="80" y2="185"/>
      <line x1="99" y1="130" x2="118" y2="185"/>
      <circle class="fig-joint fig-hi" cx="119" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.4s;">
      <line x1="99" y1="130" x2="90" y2="188"/>
      <line x1="99" y1="130" x2="128" y2="178"/>
      <circle class="fig-joint fig-hi" cx="129" cy="145" r="5"/>
    </g>
  ` },
  lateral_lunge_mobility: { kind: 'dynamic', caption: 'Vorderansicht, grosser Schritt zur Seite · Gewicht verlagert sich auf das gebeugte Bein, das andere bleibt gestreckt', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,175 L145,180"/>
    <polygon class="fig-arrow" points="145,180 135,176 137,186"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="138" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <circle cx="112" cy="55" r="15"/>
      <line x1="108" y1="72" x2="105" y2="138"/>
      <line x1="105" y1="138" x2="60" y2="196"/>
      <line x1="105" y1="138" x2="150" y2="175"/>
      <line x1="150" y1="175" x2="150" y2="196"/>
      <circle class="fig-joint fig-hi" cx="105" cy="138" r="5.5"/>
    </g>
  ` },
  standing_quad_stretch: { kind: 'static', caption: 'Seitenansicht, Einbeinstand · ein Fuss wird zum Gesäss gezogen, Knie zeigt nach unten, Becken kippt leicht nach vorne', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <g class="fig-pose">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="90" y2="196"/>
      <line x1="99" y1="138" x2="120" y2="165"/>
      <line x1="120" y1="165" x2="105" y2="185"/>
      <line x1="99" y1="80" x2="110" y2="170"/>
    </g>
    <circle class="fig-joint fig-hi" cx="105" cy="185" r="5.5"/>
  ` },
  calf_stretch_wall: { kind: 'static', caption: 'Hände an der Wand, ein Bein weit nach hinten gestreckt · Ferse bleibt am Boden, Becken schiebt sich nach vorne', svg: `
    <line class="fig-rig" x1="10" y1="20" x2="10" y2="196"/>
    <circle class="fig-joint" cx="45" cy="70" r="5"/>
    <g class="fig-pose">
      <circle cx="70" cy="60" r="14"/>
      <circle cx="80" cy="65" r="3"/>
      <line x1="55" y1="68" x2="15" y2="65"/>
      <line x1="75" y1="72" x2="90" y2="150"/>
      <line x1="90" y1="150" x2="80" y2="196"/>
      <line x1="90" y1="150" x2="150" y2="175"/>
      <line x1="150" y1="175" x2="170" y2="196"/>
    </g>
  ` },
  adductor_rock: { kind: 'dynamic', caption: 'Kniend, ein Bein seitlich gestreckt aufgestellt · Gewicht wiegt sich kontrolliert von einer Seite zur anderen', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M70,140 L130,140"/>
    <polygon class="fig-arrow" points="70,140 80,135 80,145"/>
    <polygon class="fig-arrow" points="130,140 120,135 120,145"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="75" cy="105" r="14"/>
      <line x1="80" y1="118" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="140" y2="150"/>
      <line x1="99" y1="150" x2="70" y2="180"/>
      <line x1="70" y1="180" x2="70" y2="196"/>
      <circle class="fig-joint fig-hi" cx="140" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="123" cy="105" r="14"/>
      <line x1="118" y1="118" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="60" y2="150"/>
      <line x1="99" y1="150" x2="128" y2="180"/>
      <line x1="128" y1="180" x2="128" y2="196"/>
      <circle class="fig-joint fig-hi" cx="60" cy="150" r="5"/>
    </g>
  ` },
  back_extension: { kind: 'dynamic', caption: 'Seitenansicht, an der Rückenstrecker-Bank · Oberkörper senkt sich aus der Hüfte ab und richtet sich kontrolliert wieder auf', svg: `
    <line class="fig-rig" x1="70" y1="150" x2="130" y2="150"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="150" x2="90" y2="196"/>
      <line x1="99" y1="150" x2="108" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M60,150 L60,100"/>
    <polygon class="fig-arrow" points="60,95 54,107 66,107"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="45" cy="165" r="14"/>
      <line x1="52" y1="172" x2="99" y2="150"/>
      <circle class="fig-joint fig-hi" cx="45" cy="165" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="55" cy="105" r="14"/>
      <line x1="60" y1="117" x2="99" y2="150"/>
      <circle class="fig-joint fig-hi" cx="55" cy="105" r="5.5"/>
    </g>
  ` },
  ab_wheel_rollout: { kind: 'dynamic', caption: 'Seitenansicht, kniend · Rad rollt mit angespanntem Bauch kontrolliert nach vorne und wieder zurück', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="150" x2="90" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,60 Q60,90 40,140"/>
    <polygon class="fig-arrow" points="40,140 46,128 54,136"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <circle cx="97" cy="118" r="14"/>
      <line x1="97" y1="132" x2="99" y2="150"/>
      <line x1="97" y1="125" x2="70" y2="160"/>
      <circle class="fig-joint fig-hi" cx="70" cy="160" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <circle cx="55" cy="55" r="14"/>
      <path d="M99,150 Q75,110 62,68" fill="none"/>
      <line x1="62" y1="68" x2="30" y2="150"/>
      <circle class="fig-joint fig-hi" cx="30" cy="150" r="5.5"/>
    </g>
  ` },
  cable_woodchop: { kind: 'dynamic', caption: 'Seitenansicht zum Kabelzug · Griff zieht diagonal von oben aussen nach unten über den Körper', svg: `
    <line class="fig-rig" x1="188" y1="20" x2="188" y2="45"/>
    <circle class="fig-rig-dot" cx="188" cy="32" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M150,50 Q110,110 50,160"/>
    <polygon class="fig-arrow" points="50,160 58,150 62,160"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="70" x2="155" y2="45"/>
      <circle class="fig-joint fig-hi" cx="155" cy="45" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="70" x2="45" y2="165"/>
      <circle class="fig-joint fig-hi" cx="45" cy="165" r="5.5"/>
    </g>
  ` },
  dead_bug: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage, Arme und Beine angewinkelt · gegenüberliegender Arm und Bein strecken sich abwechselnd aus', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="30" cy="130" r="3"/>
      <line x1="46" y1="146" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="60" y2="145"/>
      <line x1="99" y1="150" x2="130" y2="185"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M130,120 L165,105"/>
    <polygon class="fig-arrow" points="165,105 155,104 158,114"/>
    <path class="fig-motion" d="M95,185 L75,190"/>
    <polygon class="fig-arrow" points="75,190 84,186 84,194"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="150" x2="115" y2="115"/>
      <line x1="99" y1="150" x2="90" y2="185"/>
      <circle class="fig-joint fig-hi" cx="115" cy="115" r="5"/>
      <circle class="fig-joint fig-hi" cx="90" cy="185" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="150" x2="168" y2="102"/>
      <line x1="99" y1="150" x2="70" y2="192"/>
      <circle class="fig-joint fig-hi" cx="168" cy="102" r="5"/>
      <circle class="fig-joint fig-hi" cx="70" cy="192" r="5"/>
    </g>
  ` },
  mountain_climbers: { kind: 'dynamic', caption: 'Seitenansicht, Liegestütz-Position · Knie ziehen abwechselnd zügig Richtung Brust', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="195" y2="150"/>
    <circle class="fig-joint" cx="55" cy="150" r="5.5"/>
    <circle class="fig-joint" cx="191" cy="149" r="5.5"/>
    <g class="fig-pose fig-fixed">
      <circle cx="44" cy="88" r="14"/>
      <circle cx="40" cy="100" r="3"/>
      <line x1="60" y1="95" x2="135" y2="100"/>
      <line x1="135" y1="100" x2="190" y2="148"/>
      <line x1="60" y1="95" x2="55" y2="150"/>
    </g>
    <path class="fig-motion" d="M150,180 Q130,140 105,110"/>
    <polygon class="fig-arrow" points="105,110 112,120 100,122"/>
    <g class="fig-pose fig-a" style="animation-duration:1.4s;">
      <line x1="135" y1="100" x2="150" y2="185"/>
      <circle class="fig-joint fig-hi" cx="150" cy="185" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.4s;">
      <line x1="135" y1="100" x2="100" y2="115"/>
      <circle class="fig-joint fig-hi" cx="100" cy="115" r="5"/>
    </g>
  ` },
  sit_up: { kind: 'dynamic', caption: 'Rückenlage, Füsse fixiert · Oberkörper rollt mit angespanntem Bauch komplett zum Sitz auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="150" x2="130" y2="180"/>
      <line x1="130" y1="180" x2="160" y2="180"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M50,140 Q60,90 90,60"/>
    <polygon class="fig-arrow" points="90,60 78,60 82,70"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="35" cy="140" r="14"/>
      <circle cx="30" cy="130" r="3"/>
      <line x1="46" y1="146" x2="99" y2="150"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="82" cy="55" r="14"/>
      <circle cx="93" cy="52" r="3"/>
      <line x1="88" y1="68" x2="99" y2="150"/>
    </g>
  ` },
  squat: { kind: 'dynamic', caption: 'Seitenansicht, Füsse schulterbreit · Hüfte senkt sich nach hinten unten ab, Knie folgen der Fussrichtung', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M99,175 L99,130"/>
    <polygon class="fig-arrow" points="99,125 93,137 105,137"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="138" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="107" cy="85" r="15"/>
      <line x1="103" y1="100" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="75" y2="175"/>
      <line x1="75" y1="175" x2="80" y2="196"/>
      <line x1="99" y1="150" x2="123" y2="175"/>
      <line x1="123" y1="175" x2="118" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="150" r="5.5"/>
    </g>
  ` },
  deadlift: { kind: 'dynamic', caption: 'Seitenansicht, Stange nah am Schienbein · Oberkörper richtet sich aus Hüfte und Beinen kontrolliert auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M75,170 L90,90"/>
    <polygon class="fig-arrow" points="90,90 82,96 88,104"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <circle cx="120" cy="70" r="14"/>
      <circle cx="112" cy="78" r="3"/>
      <line x1="112" y1="82" x2="90" y2="150"/>
      <line x1="90" y1="150" x2="85" y2="196"/>
      <line x1="90" y1="150" x2="110" y2="196"/>
      <line x1="105" y1="90" x2="75" y2="172"/>
      <circle class="fig-joint fig-hi" cx="75" cy="172" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="90" y2="196"/>
      <line x1="99" y1="138" x2="108" y2="196"/>
      <line x1="99" y1="70" x2="90" y2="130"/>
      <circle class="fig-joint fig-hi" cx="90" cy="130" r="5.5"/>
    </g>
  ` },
  rdl: { kind: 'dynamic', caption: 'Seitenansicht, Beine leicht gebeugt · Hüfte schiebt sich nach hinten, Stange gleitet nah am Bein ab und wieder hoch', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M78,165 L92,100"/>
    <polygon class="fig-arrow" points="92,100 84,105 90,113"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <circle cx="115" cy="75" r="14"/>
      <circle cx="108" cy="82" r="3"/>
      <line x1="108" y1="86" x2="95" y2="150"/>
      <line x1="95" y1="150" x2="88" y2="196"/>
      <line x1="95" y1="150" x2="108" y2="196"/>
      <line x1="103" y1="95" x2="78" y2="168"/>
      <circle class="fig-joint fig-hi" cx="78" cy="168" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="90" y2="196"/>
      <line x1="99" y1="138" x2="108" y2="196"/>
      <line x1="99" y1="70" x2="92" y2="130"/>
      <circle class="fig-joint fig-hi" cx="92" cy="130" r="5.5"/>
    </g>
  ` },
  zercher_squat_rotation: { kind: 'dynamic', caption: 'Seitenansicht, Kniebeuge mit Gewicht in den Armbeugen · unten in der Position rotiert der Oberkörper kontrolliert zur Seite', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M70,110 Q99,120 128,110"/>
    <polygon class="fig-arrow" points="128,110 118,108 120,118"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="150" x2="75" y2="175"/>
      <line x1="75" y1="175" x2="80" y2="196"/>
      <line x1="99" y1="150" x2="123" y2="175"/>
      <line x1="123" y1="175" x2="118" y2="196"/>
    </g>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <circle cx="107" cy="90" r="14"/>
      <line x1="99" y1="103" x2="99" y2="150"/>
      <line x1="80" y1="110" x2="118" y2="110"/>
      <circle class="fig-joint fig-hi" cx="80" cy="110" r="5"/>
      <circle class="fig-joint fig-hi" cx="118" cy="110" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <circle cx="90" cy="90" r="14"/>
      <line x1="99" y1="103" x2="99" y2="150"/>
      <line x1="65" y1="105" x2="105" y2="115"/>
      <circle class="fig-joint fig-hi" cx="65" cy="105" r="5"/>
      <circle class="fig-joint fig-hi" cx="105" cy="115" r="5"/>
    </g>
  ` },
  leg_extension: { kind: 'dynamic', caption: 'Seitenansicht, sitzend an der Maschine · Unterschenkel strecken sich gegen den Widerstand nach vorne', svg: `
    <line class="fig-rig" x1="60" y1="150" x2="60" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="70" cy="60" r="14"/>
      <line x1="70" y1="74" x2="70" y2="140"/>
      <line x1="70" y1="140" x2="99" y2="150"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,190 Q130,170 150,140"/>
    <polygon class="fig-arrow" points="150,140 138,142 142,152"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="150" x2="95" y2="196"/>
      <circle class="fig-joint fig-hi" cx="95" cy="196" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="150" x2="150" y2="138"/>
      <circle class="fig-joint fig-hi" cx="150" cy="138" r="5"/>
    </g>
  ` },
  leg_curl_lying: { kind: 'dynamic', caption: 'Seitenansicht, Bauchlage an der Maschine · Fersen ziehen gegen den Widerstand Richtung Gesäss', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="130" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="30" cy="140" r="13"/>
      <circle cx="34" cy="130" r="3"/>
      <line x1="42" y1="146" x2="120" y2="150"/>
    </g>
    <circle class="fig-joint" cx="120" cy="150" r="5"/>
    <path class="fig-motion" d="M155,175 L145,120"/>
    <polygon class="fig-arrow" points="145,115 140,126 150,127"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="120" y1="150" x2="158" y2="178"/>
      <circle class="fig-joint fig-hi" cx="158" cy="178" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="120" y1="150" x2="150" y2="105"/>
      <circle class="fig-joint fig-hi" cx="150" cy="105" r="5.5"/>
    </g>
  ` },
  hip_abduction_cable: { kind: 'dynamic', caption: 'Seitenansicht, seitlich zum Kabelzug stehend · Bein spreizt gegen den Widerstand seitlich ab', svg: `
    <line class="fig-rig" x1="190" y1="150" x2="190" y2="196"/>
    <circle class="fig-rig-dot" cx="190" cy="175" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="120"/>
      <line x1="99" y1="120" x2="95" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="120" r="5"/>
    <path class="fig-motion" d="M110,160 L150,175"/>
    <polygon class="fig-arrow" points="150,175 140,170 140,180"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="120" x2="108" y2="196"/>
      <circle class="fig-joint fig-hi" cx="108" cy="196" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="120" x2="160" y2="180"/>
      <circle class="fig-joint fig-hi" cx="160" cy="180" r="5.5"/>
    </g>
  ` },
  calf_raise_machine: { kind: 'dynamic', caption: 'Seitenansicht, an der Maschine, Schultern unter den Polstern · Fersen drücken sich nach oben in den Zehenstand', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <line class="fig-rig" x1="80" y1="20" x2="120" y2="20"/>
    <circle class="fig-joint" cx="99" cy="34" r="5"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
    </g>
    <path class="fig-motion" d="M99,178 L99,160"/>
    <polygon class="fig-arrow" points="99,155 93,167 105,167"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="88" y2="196"/>
      <line x1="99" y1="138" x2="112" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="88" y2="184"/>
      <line x1="88" y1="184" x2="94" y2="192"/>
      <line x1="99" y1="138" x2="112" y2="184"/>
      <line x1="112" y1="184" x2="118" y2="192"/>
      <circle class="fig-joint fig-hi" cx="88" cy="184" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="112" cy="184" r="4.5"/>
    </g>
  ` },
  calf_raise_seated: { kind: 'dynamic', caption: 'Seitenansicht, sitzend, Polster auf den Oberschenkeln · Fersen heben sich gegen den Widerstand an', svg: `
    <line class="fig-rig" x1="60" y1="150" x2="140" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="70" r="14"/>
      <line x1="99" y1="84" x2="99" y2="130"/>
      <line x1="99" y1="130" x2="130" y2="150"/>
      <rect x="118" y="140" width="20" height="10" rx="2"/>
    </g>
    <circle class="fig-joint" cx="130" cy="150" r="5"/>
    <path class="fig-motion" d="M130,190 L130,172"/>
    <polygon class="fig-arrow" points="130,167 124,179 136,179"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="130" y1="150" x2="130" y2="196"/>
      <circle class="fig-joint fig-hi" cx="130" cy="196" r="4.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="130" y1="150" x2="130" y2="184"/>
      <line x1="130" y1="184" x2="140" y2="192"/>
      <circle class="fig-joint fig-hi" cx="140" cy="192" r="4.5"/>
    </g>
  ` },
  deadlift_sumo: { kind: 'dynamic', caption: 'Vorderansicht, breiter Stand, Hände innerhalb der Beine · Oberkörper richtet sich aus Hüfte und Beinen auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M85,165 L92,95"/>
    <polygon class="fig-arrow" points="92,95 84,100 90,108"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <circle cx="115" cy="72" r="14"/>
      <circle cx="107" cy="80" r="3"/>
      <line x1="108" y1="84" x2="95" y2="148"/>
      <line x1="95" y1="148" x2="75" y2="196"/>
      <line x1="95" y1="148" x2="120" y2="196"/>
      <line x1="103" y1="92" x2="85" y2="170"/>
      <circle class="fig-joint fig-hi" cx="85" cy="170" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="78" y2="196"/>
      <line x1="99" y1="138" x2="120" y2="196"/>
      <line x1="99" y1="70" x2="92" y2="130"/>
      <circle class="fig-joint fig-hi" cx="92" cy="130" r="5.5"/>
    </g>
  ` },
  hip_thrust: { kind: 'dynamic', caption: 'Seitenansicht, oberer Rücken auf der Bank · Hüfte drückt mit Gewicht auf dem Becken nach oben, Gesäss oben anspannen', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="55" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="30" cy="140" r="13"/>
      <circle cx="26" cy="130" r="3"/>
      <line x1="40" y1="148" x2="55" y2="150"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,180 L99,150"/>
    <polygon class="fig-arrow" points="99,145 93,157 105,157"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="55" y1="150" x2="99" y2="185"/>
      <line x1="99" y1="185" x2="130" y2="150"/>
      <line x1="130" y1="150" x2="130" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="185" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="55" y1="150" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="130" y2="160"/>
      <line x1="130" y1="160" x2="130" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="150" r="5.5"/>
    </g>
  ` },
  leg_press: { kind: 'dynamic', caption: 'Seitenansicht, an der Beinpresse · Beine beugen sich bis ca. 90° und strecken die Platte kontrolliert wieder nach oben', svg: `
    <line class="fig-rig" x1="150" y1="60" x2="150" y2="180"/>
    <g class="fig-pose fig-fixed">
      <circle cx="60" cy="110" r="14"/>
      <line x1="60" y1="124" x2="70" y2="150"/>
      <line x1="70" y1="150" x2="99" y2="150"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M120,150 L150,110"/>
    <polygon class="fig-arrow" points="150,110 140,113 145,122"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="150" x2="99" y2="185"/>
      <line x1="99" y1="185" x2="130" y2="185"/>
      <circle class="fig-joint fig-hi" cx="130" cy="185" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="150" x2="115" y2="130"/>
      <line x1="115" y1="130" x2="150" y2="110"/>
      <circle class="fig-joint fig-hi" cx="150" cy="110" r="5"/>
    </g>
  ` },
  lunge_dumbbell: { kind: 'dynamic', caption: 'Seitenansicht, grosser Schritt nach vorne · hinteres Knie senkt sich Richtung Boden, dann zurück in den Stand drücken', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M99,175 Q130,180 150,175"/>
    <polygon class="fig-arrow" points="150,175 140,170 142,180"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <circle class="fig-joint fig-hi" cx="114" cy="196" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="102" cy="60" r="15"/>
      <line x1="100" y1="78" x2="100" y2="130"/>
      <line x1="100" y1="130" x2="150" y2="150"/>
      <line x1="150" y1="150" x2="150" y2="196"/>
      <line x1="100" y1="130" x2="70" y2="160"/>
      <line x1="70" y1="160" x2="80" y2="196"/>
      <circle class="fig-joint fig-hi" cx="150" cy="196" r="5"/>
    </g>
  ` },
  goblet_squat: { kind: 'dynamic', caption: 'Seitenansicht, Gewicht vor der Brust gehalten · Kniebeuge bis Oberschenkel mindestens parallel zum Boden', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M99,175 L99,130"/>
    <polygon class="fig-arrow" points="99,125 93,137 105,137"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="65" x2="99" y2="90"/>
      <circle class="fig-joint fig-hi" cx="99" cy="138" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="107" cy="85" r="15"/>
      <line x1="103" y1="100" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="75" y2="175"/>
      <line x1="75" y1="175" x2="80" y2="196"/>
      <line x1="99" y1="150" x2="123" y2="175"/>
      <line x1="123" y1="175" x2="118" y2="196"/>
      <line x1="103" y1="108" x2="103" y2="130"/>
      <circle class="fig-joint fig-hi" cx="99" cy="150" r="5.5"/>
    </g>
  ` },
  sumo_squat: { kind: 'dynamic', caption: 'Vorderansicht, breiter Stand, Fussspitzen nach aussen · Hüfte senkt sich gerade nach unten, Knie in Fussrichtung', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M99,175 L99,130"/>
    <polygon class="fig-arrow" points="99,125 93,137 105,137"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="75" y2="196"/>
      <line x1="99" y1="138" x2="123" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="138" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="97" cy="72" r="15"/>
      <line x1="97" y1="90" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="60" y2="175"/>
      <line x1="60" y1="175" x2="68" y2="196"/>
      <line x1="99" y1="150" x2="138" y2="175"/>
      <line x1="138" y1="175" x2="130" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="150" r="5.5"/>
    </g>
  ` },
  step_up: { kind: 'dynamic', caption: 'Seitenansicht, erhöhte Fläche vor sich · ein Bein steigt hinauf, oben durchstrecken, kontrolliert zurück nach unten', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="70" y2="196"/>
    <line class="fig-rig" x1="70" y1="160" x2="140" y2="160"/>
    <circle class="fig-joint" cx="70" cy="160" r="5"/>
    <path class="fig-motion" d="M130,190 L130,165"/>
    <polygon class="fig-arrow" points="130,160 124,172 136,172"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="88" cy="90" r="14"/>
      <line x1="90" y1="104" x2="95" y2="145"/>
      <line x1="95" y1="145" x2="80" y2="196"/>
      <line x1="95" y1="145" x2="130" y2="190"/>
      <circle class="fig-joint fig-hi" cx="130" cy="190" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="112" cy="88" r="14"/>
      <line x1="112" y1="102" x2="112" y2="140"/>
      <line x1="112" y1="140" x2="130" y2="160"/>
      <line x1="112" y1="140" x2="90" y2="175"/>
      <circle class="fig-joint fig-hi" cx="90" cy="175" r="5.5"/>
    </g>
  ` },
  nordic_hamstring_curl: { kind: 'dynamic', caption: 'Seitenansicht, kniend, Füsse fixiert · Oberkörper senkt sich so weit wie möglich kontrolliert nach vorne ab, mit den Beinen abbremsen', svg: `
    <line class="fig-rig" x1="80" y1="196" x2="120" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M99,90 Q60,120 45,165"/>
    <polygon class="fig-arrow" points="45,165 50,153 58,163"/>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <circle cx="97" cy="120" r="15"/>
      <line x1="97" y1="135" x2="99" y2="170"/>
      <line x1="99" y1="170" x2="99" y2="196"/>
      <circle class="fig-joint fig-hi" cx="97" cy="120" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <path d="M99,170 Q70,130 42,70" fill="none"/>
      <circle cx="36" cy="60" r="14"/>
      <line x1="99" y1="170" x2="99" y2="196"/>
      <circle class="fig-joint fig-hi" cx="36" cy="60" r="5.5"/>
    </g>
  ` },
  pullup: { kind: 'dynamic', caption: 'Vorderansicht, Obergriff an der Stange · Körper zieht sich hoch, bis das Kinn über die Stange kommt', svg: `
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <circle class="fig-joint" cx="100" cy="58" r="5"/>
    <path class="fig-motion" d="M100,150 L100,90"/>
    <polygon class="fig-arrow" points="100,85 94,97 106,97"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="80" r="14"/>
      <circle cx="112" cy="80" r="3"/>
      <line x1="100" y1="94" x2="100" y2="150"/>
      <line x1="100" y1="150" x2="90" y2="196"/>
      <line x1="100" y1="150" x2="110" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="78" y1="20" x2="90" y2="40"/>
      <line x1="122" y1="20" x2="110" y2="40"/>
      <circle cx="100" cy="34" r="14"/>
      <circle cx="112" cy="30" r="3"/>
      <line x1="100" y1="48" x2="100" y2="110"/>
      <line x1="100" y1="110" x2="90" y2="170"/>
      <line x1="100" y1="110" x2="110" y2="170"/>
      <circle class="fig-joint fig-hi" cx="100" cy="34" r="6"/>
    </g>
  ` },
  pullup_weighted: { kind: 'dynamic', caption: 'Vorderansicht, Obergriff an der Stange, Zusatzgewicht am Gurt · Körper zieht sich hoch, bis das Kinn über die Stange kommt', svg: `
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <circle class="fig-joint" cx="100" cy="58" r="5"/>
    <path class="fig-motion" d="M100,150 L100,90"/>
    <polygon class="fig-arrow" points="100,85 94,97 106,97"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="80" r="14"/>
      <circle cx="112" cy="80" r="3"/>
      <line x1="100" y1="94" x2="100" y2="150"/>
      <line x1="100" y1="150" x2="90" y2="196"/>
      <line x1="100" y1="150" x2="110" y2="196"/>
      <rect x="93" y="152" width="14" height="12" rx="2"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="78" y1="20" x2="90" y2="40"/>
      <line x1="122" y1="20" x2="110" y2="40"/>
      <circle cx="100" cy="34" r="14"/>
      <circle cx="112" cy="30" r="3"/>
      <line x1="100" y1="48" x2="100" y2="110"/>
      <line x1="100" y1="110" x2="90" y2="170"/>
      <line x1="100" y1="110" x2="110" y2="170"/>
      <rect x="93" y="112" width="14" height="12" rx="2"/>
      <circle class="fig-joint fig-hi" cx="100" cy="34" r="6"/>
    </g>
  ` },
  pullup_close_grip: { kind: 'dynamic', caption: 'Vorderansicht, enger Untergriff an der Stange · Körper zieht sich hoch, bis das Kinn über die Stange kommt', svg: `
    <line class="fig-rig" x1="70" y1="20" x2="130" y2="20"/>
    <circle class="fig-joint" cx="100" cy="58" r="5"/>
    <path class="fig-motion" d="M100,150 L100,90"/>
    <polygon class="fig-arrow" points="100,85 94,97 106,97"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="88" y1="20" x2="96" y2="58"/>
      <line x1="112" y1="20" x2="104" y2="58"/>
      <circle cx="100" cy="80" r="14"/>
      <circle cx="112" cy="80" r="3"/>
      <line x1="100" y1="94" x2="100" y2="150"/>
      <line x1="100" y1="150" x2="90" y2="196"/>
      <line x1="100" y1="150" x2="110" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="88" y1="20" x2="94" y2="40"/>
      <line x1="112" y1="20" x2="106" y2="40"/>
      <circle cx="100" cy="34" r="14"/>
      <circle cx="112" cy="30" r="3"/>
      <line x1="100" y1="48" x2="100" y2="110"/>
      <line x1="100" y1="110" x2="90" y2="170"/>
      <line x1="100" y1="110" x2="110" y2="170"/>
      <circle class="fig-joint fig-hi" cx="100" cy="34" r="6"/>
    </g>
  ` },
  lat_pulldown: { kind: 'dynamic', caption: 'Vorderansicht, sitzend am Latzug · Stange kommt von oben gestreckt bis zur oberen Brust herunter', svg: `
    <line class="fig-rig" x1="99" y1="8" x2="99" y2="40"/>
    <circle class="fig-rig-dot" cx="99" cy="20" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
      <line x1="99" y1="140" x2="85" y2="196"/>
      <line x1="99" y1="140" x2="115" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="78" r="5"/>
    <path class="fig-motion" d="M60,45 Q99,70 138,45"/>
    <polygon class="fig-arrow" points="60,45 68,42 66,52"/>
    <polygon class="fig-arrow" points="138,45 130,42 132,52"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="65" y2="42"/>
      <line x1="99" y1="78" x2="133" y2="42"/>
      <circle class="fig-joint fig-hi" cx="65" cy="42" r="5"/>
      <circle class="fig-joint fig-hi" cx="133" cy="42" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="70" y2="100"/>
      <line x1="99" y1="78" x2="128" y2="100"/>
      <circle class="fig-joint fig-hi" cx="70" cy="100" r="5"/>
      <circle class="fig-joint fig-hi" cx="128" cy="100" r="5"/>
    </g>
  ` },
  lat_pulldown_wide: { kind: 'dynamic', caption: 'Vorderansicht, sitzend, sehr breiter Obergriff · Stange kommt von weit aussen oben zur oberen Brust herunter', svg: `
    <line class="fig-rig" x1="99" y1="8" x2="99" y2="40"/>
    <circle class="fig-rig-dot" cx="99" cy="20" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
      <line x1="99" y1="140" x2="85" y2="196"/>
      <line x1="99" y1="140" x2="115" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="78" r="5"/>
    <path class="fig-motion" d="M50,42 Q99,70 148,42"/>
    <polygon class="fig-arrow" points="50,42 58,40 57,50"/>
    <polygon class="fig-arrow" points="148,42 140,40 141,50"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="55" y2="40"/>
      <line x1="99" y1="78" x2="143" y2="40"/>
      <circle class="fig-joint fig-hi" cx="55" cy="40" r="5"/>
      <circle class="fig-joint fig-hi" cx="143" cy="40" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="70" y2="100"/>
      <line x1="99" y1="78" x2="128" y2="100"/>
      <circle class="fig-joint fig-hi" cx="70" cy="100" r="5"/>
      <circle class="fig-joint fig-hi" cx="128" cy="100" r="5"/>
    </g>
  ` },
  lat_pulldown_single: { kind: 'dynamic', caption: 'Vorderansicht, sitzend, einarmig · Griff kommt gestreckt von oben zur Hüfte herunter, Oberkörper bleibt stabil', svg: `
    <line class="fig-rig" x1="130" y1="8" x2="130" y2="40"/>
    <circle class="fig-rig-dot" cx="130" cy="20" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
      <line x1="99" y1="140" x2="85" y2="196"/>
      <line x1="99" y1="140" x2="115" y2="196"/>
      <line x1="99" y1="90" x2="80" y2="120"/>
    </g>
    <circle class="fig-joint" cx="99" cy="78" r="5"/>
    <path class="fig-motion" d="M155,45 Q135,70 118,95"/>
    <polygon class="fig-arrow" points="118,95 120,84 128,90"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="155" y2="42"/>
      <circle class="fig-joint fig-hi" cx="155" cy="42" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="118" y2="98"/>
      <circle class="fig-joint fig-hi" cx="118" cy="98" r="5"/>
    </g>
  ` },
  straight_arm_pulldown: { kind: 'dynamic', caption: 'Seitenansicht, stehend am Kabelzug · gestreckte Arme drücken von Schulterhöhe kontrolliert zu den Oberschenkeln', svg: `
    <line class="fig-rig" x1="99" y1="8" x2="99" y2="35"/>
    <circle class="fig-rig-dot" cx="99" cy="20" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="50" r="14"/>
      <line x1="97" y1="64" x2="99" y2="140"/>
      <line x1="99" y1="140" x2="86" y2="196"/>
      <line x1="99" y1="140" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M99,45 Q99,90 99,120"/>
    <polygon class="fig-arrow" points="99,124 93,112 105,112"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="70" x2="90" y2="35"/>
      <circle class="fig-joint fig-hi" cx="90" cy="35" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="70" x2="100" y2="130"/>
      <circle class="fig-joint fig-hi" cx="100" cy="130" r="5"/>
    </g>
  ` },
  row_cable: { kind: 'dynamic', caption: 'Seitenansicht, aufrecht sitzend am Kabelzug · Griff kommt gestreckt bis zum Bauch heran, Ellbogen nah am Körper', svg: `
    <line class="fig-rig" x1="180" y1="90" x2="180" y2="110"/>
    <circle class="fig-rig-dot" cx="180" cy="100" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="60" r="14"/>
      <line x1="99" y1="74" x2="99" y2="130"/>
      <line x1="99" y1="130" x2="85" y2="150"/>
      <line x1="85" y1="150" x2="85" y2="196"/>
      <line x1="99" y1="130" x2="115" y2="150"/>
      <line x1="115" y1="150" x2="115" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="90" r="5"/>
    <path class="fig-motion" d="M160,100 L110,100"/>
    <polygon class="fig-arrow" points="110,100 120,94 120,106"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="90" x2="165" y2="100"/>
      <circle class="fig-joint fig-hi" cx="165" cy="100" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="90" x2="115" y2="105"/>
      <circle class="fig-joint fig-hi" cx="115" cy="105" r="5"/>
    </g>
  ` },
  row_barbell: { kind: 'dynamic', caption: 'Seitenansicht, Oberkörper vorgebeugt · Stange zieht gestreckt von unten zum Bauch heran', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="140" cy="80" r="14"/>
      <circle cx="150" cy="86" r="3"/>
      <line x1="130" y1="90" x2="100" y2="150"/>
      <line x1="100" y1="150" x2="90" y2="196"/>
      <line x1="100" y1="150" x2="120" y2="196"/>
    </g>
    <circle class="fig-joint" cx="120" cy="100" r="5"/>
    <path class="fig-motion" d="M60,170 L60,120"/>
    <polygon class="fig-arrow" points="60,115 54,127 66,127"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="120" y1="100" x2="60" y2="175"/>
      <circle class="fig-joint fig-hi" cx="60" cy="175" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="120" y1="100" x2="95" y2="140"/>
      <circle class="fig-joint fig-hi" cx="95" cy="140" r="5.5"/>
    </g>
  ` },
  t_bar_row: { kind: 'dynamic', caption: 'Seitenansicht, Oberkörper vorgebeugt, T-Bar-Griff · Griff zieht von unten zum Bauch heran, Rücken bleibt gerade', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="140" cy="80" r="14"/>
      <circle cx="150" cy="86" r="3"/>
      <line x1="130" y1="90" x2="100" y2="150"/>
      <line x1="100" y1="150" x2="90" y2="196"/>
      <line x1="100" y1="150" x2="120" y2="196"/>
    </g>
    <circle class="fig-joint" cx="120" cy="100" r="5"/>
    <path class="fig-motion" d="M75,165 L95,135"/>
    <polygon class="fig-arrow" points="95,135 84,136 90,146"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="120" y1="100" x2="70" y2="170"/>
      <circle class="fig-joint fig-hi" cx="70" cy="170" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="120" y1="100" x2="98" y2="138"/>
      <circle class="fig-joint fig-hi" cx="98" cy="138" r="5.5"/>
    </g>
  ` },
  bench_press: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage auf der Bank · Stange senkt sich zur Brust ab und wird gerade nach oben gedrückt', svg: `
    <line class="fig-rig" x1="20" y1="150" x2="150" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="38" cy="130" r="3"/>
      <line x1="46" y1="146" x2="140" y2="150"/>
      <line x1="140" y1="150" x2="160" y2="130"/>
      <line x1="140" y1="150" x2="150" y2="175"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <path class="fig-motion" d="M90,110 L90,60"/>
    <polygon class="fig-arrow" points="90,55 84,67 96,67"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="90" y2="110"/>
      <circle class="fig-joint fig-hi" cx="90" cy="110" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="90" y2="60"/>
      <circle class="fig-joint fig-hi" cx="90" cy="60" r="5.5"/>
    </g>
  ` },
  incline_bench_press: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage auf der Schrägbank (ca. 30°) · Stange senkt sich zur oberen Brust ab und wird nach oben gedrückt', svg: `
    <line class="fig-rig" x1="30" y1="185" x2="150" y2="95"/>
    <g class="fig-pose fig-fixed">
      <circle cx="40" cy="165" r="13"/>
      <circle cx="46" cy="155" r="3"/>
      <line x1="50" y1="160" x2="140" y2="110"/>
      <line x1="140" y1="110" x2="160" y2="125"/>
      <line x1="140" y1="110" x2="150" y2="90"/>
    </g>
    <circle class="fig-joint" cx="95" cy="135" r="5"/>
    <path class="fig-motion" d="M95,105 L95,55"/>
    <polygon class="fig-arrow" points="95,50 89,62 101,62"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="95" y1="135" x2="95" y2="105"/>
      <circle class="fig-joint fig-hi" cx="95" cy="105" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="95" y1="135" x2="95" y2="55"/>
      <circle class="fig-joint fig-hi" cx="95" cy="55" r="5.5"/>
    </g>
  ` },
  decline_bench_press: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage auf der Negativbank (Kopf tiefer) · Stange senkt sich zur unteren Brust ab und wird nach oben gedrückt', svg: `
    <line class="fig-rig" x1="150" y1="185" x2="30" y2="95"/>
    <g class="fig-pose fig-fixed">
      <circle cx="140" cy="165" r="13"/>
      <circle cx="146" cy="155" r="3"/>
      <line x1="150" y1="160" x2="60" y2="110"/>
      <line x1="60" y1="110" x2="40" y2="125"/>
      <line x1="60" y1="110" x2="50" y2="90"/>
    </g>
    <circle class="fig-joint" cx="105" cy="135" r="5"/>
    <path class="fig-motion" d="M105,105 L105,55"/>
    <polygon class="fig-arrow" points="105,50 99,62 111,62"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="105" y1="135" x2="105" y2="105"/>
      <circle class="fig-joint fig-hi" cx="105" cy="105" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="105" y1="135" x2="105" y2="55"/>
      <circle class="fig-joint fig-hi" cx="105" cy="55" r="5.5"/>
    </g>
  ` },
  dumbbell_bench_press: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage auf der Bank · Kurzhanteln senken sich zur Brust ab und werden gerade nach oben gedrückt', svg: `
    <line class="fig-rig" x1="20" y1="150" x2="150" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="38" cy="130" r="3"/>
      <line x1="46" y1="146" x2="140" y2="150"/>
      <line x1="140" y1="150" x2="160" y2="130"/>
      <line x1="140" y1="150" x2="150" y2="175"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <path class="fig-motion" d="M80,110 L80,60"/>
    <polygon class="fig-arrow" points="80,55 74,67 86,67"/>
    <path class="fig-motion" d="M100,110 L100,60"/>
    <polygon class="fig-arrow" points="100,55 94,67 106,67"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="80" y2="110"/>
      <line x1="90" y1="140" x2="100" y2="110"/>
      <circle class="fig-joint fig-hi" cx="80" cy="110" r="5"/>
      <circle class="fig-joint fig-hi" cx="100" cy="110" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="80" y2="60"/>
      <line x1="90" y1="140" x2="100" y2="60"/>
      <circle class="fig-joint fig-hi" cx="80" cy="60" r="5"/>
      <circle class="fig-joint fig-hi" cx="100" cy="60" r="5"/>
    </g>
  ` },
  ohp: { kind: 'dynamic', caption: 'Vorderansicht, stehend oder sitzend · Stange bzw. Hanteln drücken von Schulterhöhe gerade nach oben', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M99,95 L99,45"/>
    <polygon class="fig-arrow" points="99,40 93,52 105,52"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="70" x2="90" y2="95"/>
      <line x1="99" y1="70" x2="108" y2="95"/>
      <circle class="fig-joint fig-hi" cx="90" cy="95" r="5"/>
      <circle class="fig-joint fig-hi" cx="108" cy="95" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="70" x2="85" y2="30"/>
      <line x1="99" y1="70" x2="113" y2="30"/>
      <circle class="fig-joint fig-hi" cx="85" cy="30" r="5"/>
      <circle class="fig-joint fig-hi" cx="113" cy="30" r="5"/>
    </g>
  ` },
  butterfly: { kind: 'dynamic', caption: 'Vorderansicht, sitzend an der Maschine · Arme führen von aussen kommend vor der Brust zusammen', svg: `
    <line class="fig-rig" x1="99" y1="196" x2="99" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="85" r="5"/>
    <path class="fig-motion" d="M60,80 L99,95"/>
    <polygon class="fig-arrow" points="99,95 90,90 90,100"/>
    <path class="fig-motion" d="M138,80 L99,95"/>
    <polygon class="fig-arrow" points="99,95 108,90 108,100"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="85" x2="55" y2="75"/>
      <line x1="99" y1="85" x2="143" y2="75"/>
      <circle class="fig-joint fig-hi" cx="55" cy="75" r="5"/>
      <circle class="fig-joint fig-hi" cx="143" cy="75" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="85" x2="90" y2="95"/>
      <line x1="99" y1="85" x2="108" y2="95"/>
      <circle class="fig-joint fig-hi" cx="90" cy="95" r="5"/>
      <circle class="fig-joint fig-hi" cx="108" cy="95" r="5"/>
    </g>
  ` },
  triceps_extension: { kind: 'dynamic', caption: 'Seitenansicht, stehend am Kabelzug, Ellbogen am Körper fixiert · Unterarm streckt sich von oben nach unten', svg: `
    <line class="fig-rig" x1="99" y1="8" x2="99" y2="35"/>
    <circle class="fig-rig-dot" cx="99" cy="20" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="45" r="15"/>
      <line x1="97" y1="63" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="70" x2="105" y2="105"/>
    </g>
    <circle class="fig-joint" cx="105" cy="105" r="5"/>
    <path class="fig-motion" d="M105,60 L105,95"/>
    <polygon class="fig-arrow" points="105,100 99,88 111,88"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="105" y1="105" x2="112" y2="65"/>
      <circle class="fig-joint fig-hi" cx="112" cy="65" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="105" y1="105" x2="112" y2="145"/>
      <circle class="fig-joint fig-hi" cx="112" cy="145" r="5"/>
    </g>
  ` },
  dumbbell_flyes: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage auf der Bank · Arme leicht gebeugt seitlich absenken, dann in einem Bogen über der Brust zusammenführen', svg: `
    <line class="fig-rig" x1="20" y1="150" x2="150" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="38" cy="130" r="3"/>
      <line x1="46" y1="146" x2="140" y2="150"/>
      <line x1="140" y1="150" x2="160" y2="130"/>
      <line x1="140" y1="150" x2="150" y2="175"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <path class="fig-motion" d="M50,120 Q70,90 88,75"/>
    <polygon class="fig-arrow" points="88,75 76,74 80,84"/>
    <path class="fig-motion" d="M130,120 Q110,90 92,75"/>
    <polygon class="fig-arrow" points="92,75 104,74 100,84"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="90" y1="140" x2="45" y2="115"/>
      <line x1="90" y1="140" x2="135" y2="115"/>
      <circle class="fig-joint fig-hi" cx="45" cy="115" r="5"/>
      <circle class="fig-joint fig-hi" cx="135" cy="115" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="90" y1="140" x2="85" y2="70"/>
      <line x1="90" y1="140" x2="95" y2="70"/>
      <circle class="fig-joint fig-hi" cx="85" cy="70" r="5"/>
      <circle class="fig-joint fig-hi" cx="95" cy="70" r="5"/>
    </g>
  ` },
  cable_crossover: { kind: 'dynamic', caption: 'Vorderansicht, Kabel von oben aussen kommend · Arme führen die Griffe vor dem Körper nach unten zusammen', svg: `
    <line class="fig-rig" x1="10" y1="20" x2="10" y2="60"/>
    <circle class="fig-rig-dot" cx="10" cy="40" r="6"/>
    <line class="fig-rig" x1="188" y1="20" x2="188" y2="60"/>
    <circle class="fig-rig-dot" cx="188" cy="40" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="70" x2="30" y2="45"/>
      <line x1="99" y1="70" x2="168" y2="45"/>
      <circle class="fig-joint fig-hi" cx="30" cy="45" r="5"/>
      <circle class="fig-joint fig-hi" cx="168" cy="45" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="70" x2="85" y2="105"/>
      <line x1="99" y1="70" x2="113" y2="105"/>
      <circle class="fig-joint fig-hi" cx="85" cy="105" r="5"/>
      <circle class="fig-joint fig-hi" cx="113" cy="105" r="5"/>
    </g>
  ` },
  dumbbell_pullover: { kind: 'dynamic', caption: 'Seitenansicht, quer zur Bank liegend · gestreckte Arme senken die Hantel hinter den Kopf ab und ziehen sie zur Brust zurück', svg: `
    <line class="fig-rig" x1="70" y1="150" x2="130" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="130" r="14"/>
      <line x1="99" y1="144" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="80" y2="150"/>
      <line x1="80" y1="150" x2="70" y2="170"/>
      <line x1="99" y1="150" x2="120" y2="150"/>
      <line x1="120" y1="150" x2="130" y2="170"/>
    </g>
    <circle class="fig-joint" cx="99" cy="105" r="5"/>
    <path class="fig-motion" d="M99,180 L99,110"/>
    <polygon class="fig-arrow" points="99,105 93,117 105,117"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="105" x2="99" y2="185"/>
      <circle class="fig-joint fig-hi" cx="99" cy="185" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="105" x2="99" y2="60"/>
      <circle class="fig-joint fig-hi" cx="99" cy="60" r="5.5"/>
    </g>
  ` },
  pullover_machine: { kind: 'dynamic', caption: 'Seitenansicht, sitzend an der Maschine · Arme ziehen von oben nach unten vor dem Körper, Ellbogen leicht gebeugt', svg: `
    <line class="fig-rig" x1="99" y1="196" x2="99" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="80" r="5"/>
    <path class="fig-motion" d="M99,50 L99,110"/>
    <polygon class="fig-arrow" points="99,115 93,103 105,103"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="80" x2="99" y2="35"/>
      <circle class="fig-joint fig-hi" cx="99" cy="35" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="80" x2="99" y2="125"/>
      <circle class="fig-joint fig-hi" cx="99" cy="125" r="5"/>
    </g>
  ` },
  bicep_curl_dumbbell: { kind: 'dynamic', caption: 'Seitenansicht, Oberarm fixiert am Körper · Hantel curlt zur Schulter hoch und senkt sich kontrolliert wieder ab', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="66" x2="103" y2="105"/>
    </g>
    <circle class="fig-joint" cx="103" cy="105" r="5"/>
    <path class="fig-motion" d="M115,150 Q125,120 112,90"/>
    <polygon class="fig-arrow" points="108,85 108,96 118,92"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="103" y1="105" x2="118" y2="150"/>
      <circle class="fig-joint fig-hi" cx="118" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="103" y1="105" x2="112" y2="70"/>
      <circle class="fig-joint fig-hi" cx="112" cy="70" r="5"/>
    </g>
  ` },
  bicep_curl_barbell: { kind: 'dynamic', caption: 'Vorderansicht, schulterbreiter Griff · Stange curlt gestreckt am Körper entlang nach oben und senkt sich kontrolliert ab', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="66" x2="80" y2="105"/>
      <line x1="99" y1="66" x2="118" y2="105"/>
    </g>
    <circle class="fig-joint" cx="80" cy="105" r="5"/>
    <circle class="fig-joint" cx="118" cy="105" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="80" y1="105" x2="75" y2="150"/>
      <line x1="118" y1="105" x2="123" y2="150"/>
      <circle class="fig-joint fig-hi" cx="75" cy="150" r="5"/>
      <circle class="fig-joint fig-hi" cx="123" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="80" y1="105" x2="88" y2="65"/>
      <line x1="118" y1="105" x2="110" y2="65"/>
      <circle class="fig-joint fig-hi" cx="88" cy="65" r="5"/>
      <circle class="fig-joint fig-hi" cx="110" cy="65" r="5"/>
    </g>
  ` },
  hammer_curl: { kind: 'dynamic', caption: 'Seitenansicht, neutraler Griff (Handflächen zueinander), Oberarm fixiert · Hantel curlt zur Schulter hoch und senkt sich kontrolliert ab', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="66" x2="95" y2="105"/>
    </g>
    <circle class="fig-joint" cx="95" cy="105" r="5"/>
    <path class="fig-motion" d="M85,150 Q75,120 88,90"/>
    <polygon class="fig-arrow" points="92,85 92,96 82,92"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="95" y1="105" x2="80" y2="150"/>
      <circle class="fig-joint fig-hi" cx="80" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="95" y1="105" x2="86" y2="70"/>
      <circle class="fig-joint fig-hi" cx="86" cy="70" r="5"/>
    </g>
  ` },
  cable_curl: { kind: 'dynamic', caption: 'Seitenansicht, stehend am Kabelzug, Ellbogen fixiert · Griff curlt gestreckt von unten zur Schulter hoch', svg: `
    <line class="fig-rig" x1="99" y1="180" x2="99" y2="196"/>
    <circle class="fig-rig-dot" cx="99" cy="188" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M99,160 L99,100"/>
    <polygon class="fig-arrow" points="99,95 93,107 105,107"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="99" y1="70" x2="99" y2="165"/>
      <circle class="fig-joint fig-hi" cx="99" cy="165" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="99" y1="70" x2="99" y2="95"/>
      <circle class="fig-joint fig-hi" cx="99" cy="95" r="5"/>
    </g>
  ` },
  close_grip_bench_press: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage, enger Griff · Stange senkt sich zur unteren Brust ab, Ellbogen bleiben nah am Körper', svg: `
    <line class="fig-rig" x1="20" y1="150" x2="150" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="38" cy="130" r="3"/>
      <line x1="46" y1="146" x2="140" y2="150"/>
      <line x1="140" y1="150" x2="160" y2="130"/>
      <line x1="140" y1="150" x2="150" y2="175"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <path class="fig-motion" d="M90,110 L90,60"/>
    <polygon class="fig-arrow" points="90,55 84,67 96,67"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="85" y2="112"/>
      <line x1="90" y1="140" x2="95" y2="112"/>
      <circle class="fig-joint fig-hi" cx="85" cy="112" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="95" cy="112" r="4.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="85" y2="60"/>
      <line x1="90" y1="140" x2="95" y2="60"/>
      <circle class="fig-joint fig-hi" cx="85" cy="60" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="95" cy="60" r="4.5"/>
    </g>
  ` },
  skull_crusher: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage, Oberarm senkrecht fixiert · Unterarm senkt die Stange Richtung Stirn ab und streckt sie wieder nach oben', svg: `
    <line class="fig-rig" x1="20" y1="150" x2="150" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="38" cy="130" r="3"/>
      <line x1="46" y1="146" x2="140" y2="150"/>
      <line x1="140" y1="150" x2="160" y2="130"/>
      <line x1="140" y1="150" x2="150" y2="175"/>
      <line x1="90" y1="140" x2="90" y2="95"/>
    </g>
    <circle class="fig-joint" cx="90" cy="95" r="5"/>
    <path class="fig-motion" d="M75,120 L88,90"/>
    <polygon class="fig-arrow" points="88,90 78,90 84,100"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="90" y1="95" x2="70" y2="125"/>
      <circle class="fig-joint fig-hi" cx="70" cy="125" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="90" y1="95" x2="90" y2="55"/>
      <circle class="fig-joint fig-hi" cx="90" cy="55" r="5"/>
    </g>
  ` },
  lateral_raise: { kind: 'dynamic', caption: 'Vorderansicht, stehend · Arme leicht gebeugt seitlich bis Schulterhöhe anheben, kontrolliert absenken', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="65" r="5"/>
    <path class="fig-motion" d="M108,130 Q100,90 68,68"/>
    <polygon class="fig-arrow" points="62,65 72,64 70,75"/>
    <path class="fig-motion" d="M90,130 Q98,90 130,68"/>
    <polygon class="fig-arrow" points="136,65 126,64 128,75"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="105" y2="130"/>
      <line x1="99" y1="65" x2="93" y2="130"/>
      <circle class="fig-joint fig-hi" cx="105" cy="130" r="5"/>
      <circle class="fig-joint fig-hi" cx="93" cy="130" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="60" y2="60"/>
      <line x1="99" y1="65" x2="138" y2="60"/>
      <circle class="fig-joint fig-hi" cx="60" cy="60" r="5"/>
      <circle class="fig-joint fig-hi" cx="138" cy="60" r="5"/>
    </g>
  ` },
  front_raise: { kind: 'dynamic', caption: 'Seitenansicht, stehend · Hantel(n) mit leicht gebeugten Armen nach vorne bis Schulterhöhe anheben, kontrolliert absenken', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="65" r="5"/>
    <path class="fig-motion" d="M99,130 Q99,90 99,70"/>
    <polygon class="fig-arrow" points="99,65 93,77 105,77"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="102" y2="130"/>
      <circle class="fig-joint fig-hi" cx="102" cy="130" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="145" y2="60"/>
      <circle class="fig-joint fig-hi" cx="145" cy="60" r="5"/>
    </g>
  ` },
  wrist_curl: { kind: 'dynamic', caption: 'Seitenansicht, Unterarm aufgelegt, Handfläche nach oben · Handgelenk beugt und streckt sich', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="68" x2="140" y2="100"/>
      <line x1="140" y1="100" x2="165" y2="100"/>
    </g>
    <circle class="fig-joint" cx="165" cy="100" r="5"/>
    <path class="fig-motion" d="M178,118 L178,88"/>
    <polygon class="fig-arrow" points="178,84 172,95 184,95"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="165" y1="100" x2="180" y2="115"/>
      <circle class="fig-joint fig-hi" cx="180" cy="115" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="165" y1="100" x2="180" y2="85"/>
      <circle class="fig-joint fig-hi" cx="180" cy="85" r="5"/>
    </g>
  ` },
  reverse_butterfly: { kind: 'dynamic', caption: 'Vorderansicht, sitzend an der Maschine · Arme öffnen sich nach hinten, Schulterblätter ziehen zusammen', svg: `
    <line class="fig-rig" x1="99" y1="150" x2="99" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="85" r="5"/>
    <path class="fig-motion" d="M99,95 L60,80"/>
    <polygon class="fig-arrow" points="60,80 68,78 66,88"/>
    <path class="fig-motion" d="M99,95 L138,80"/>
    <polygon class="fig-arrow" points="138,80 130,78 132,88"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="85" x2="90" y2="95"/>
      <line x1="99" y1="85" x2="108" y2="95"/>
      <circle class="fig-joint fig-hi" cx="90" cy="95" r="5"/>
      <circle class="fig-joint fig-hi" cx="108" cy="95" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="85" x2="55" y2="75"/>
      <line x1="99" y1="85" x2="143" y2="75"/>
      <circle class="fig-joint fig-hi" cx="55" cy="75" r="5"/>
      <circle class="fig-joint fig-hi" cx="143" cy="75" r="5"/>
    </g>
  ` },
  lateral_raise_cable: { kind: 'dynamic', caption: 'Vorderansicht, stehend am tiefen Kabelzug · Arm hebt seitlich mit leicht gebeugtem Ellbogen bis Schulterhöhe', svg: `
    <line class="fig-rig" x1="120" y1="185" x2="120" y2="196"/>
    <circle class="fig-rig-dot" cx="120" cy="190" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="65" r="5"/>
    <path class="fig-motion" d="M110,140 Q100,90 60,68"/>
    <polygon class="fig-arrow" points="55,66 65,64 62,75"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="112" y2="130"/>
      <line x1="112" y1="130" x2="118" y2="185"/>
      <circle class="fig-joint fig-hi" cx="118" cy="185" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="55" y2="60"/>
      <circle class="fig-joint fig-hi" cx="55" cy="60" r="5.5"/>
    </g>
  ` },
};
