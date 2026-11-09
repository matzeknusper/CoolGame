// German + English texts.
const de = {
  title1: 'WUSEL', title2: 'WARS', tagline: 'Vermehre deine Wusels. Stürme die Festung.',
  play: 'Spielen', level: 'Level', levels: 'Level', upgrades: 'Upgrades', settings: 'Einstellungen', back: 'Zurück',
  continue: 'Weiter', retry: 'Nochmal', home: 'Menü', resume: 'Weiterspielen', restart: 'Neu starten', pause: 'Pause',
  next: 'Nächstes Level', win: 'Geschafft!', lose: 'Überrannt!', bossWin: 'Boss besiegt!',
  collected: 'Gesammelt', bonus: 'Level-Bonus', total: 'Gesamt', newBest: 'Neuer Rekord!',
  shield: 'Schild', crowd: 'Wusels', boss: 'BOSS', stage: 'Abschnitt', endless: 'Endlos',
  world: 'Welt', locked: 'Besiege den Boss der vorherigen Welt', bossLevel: 'Boss',
  worlds: ['Blütenwiese', 'Dünenmeer', 'Frostgipfel', 'Glutschlund', 'Neonhafen', 'Sternenriff'],
  bosses: ['Ober-Grummel', 'Sandwalze', 'Eisklotz', 'Glutbrocken', 'Neon-Tyrann', 'Sternenschlinger'],
  up: {
    rate: ['Feuerrate', 'Mehr Wusels pro Sekunde'],
    multi: ['Doppelschuss', 'Chance auf einen Bonus-Wusel'],
    mega: ['Mega-Wusel', 'Stärker und schneller bereit'],
    shield: ['Schild', 'Hält mehr Treffer aus'],
    coins: ['Münzmagnet', 'Mehr Münzen pro Level'],
  },
  max: 'MAX', lvl: 'Stufe', skins: 'Farben', needStars: 'Sterne nötig', selected: 'Aktiv', select: 'Wählen',
  skin: { mint: 'Minze', sun: 'Sonne', berry: 'Himbeere', ocean: 'Ozean', lime: 'Limette', ghost: 'Geist' },
  sfx: 'Soundeffekte', music: 'Musik', vib: 'Vibration', quality: 'Grafik', lang: 'Sprache', auto: 'Auto-Feuer',
  q: { auto: 'Auto', low: 'Niedrig', medium: 'Mittel', high: 'Hoch' },
  reset: 'Fortschritt löschen', resetAsk: 'Wirklich alles löschen?', yes: 'Ja, löschen', no: 'Abbrechen',
  hintDrag: 'Halten zum Feuern – ziehen zum Zielen',
  intro: {
    basics: ['So geht\'s', 'Schicke Wusels durch die Tore – jedes Tor vervielfacht sie!'],
    add: ['Bonus-Tor', 'Gelbe „+“-Tore schenken dir Extra-Wusels, bis ihr Vorrat leer ist.'],
    move: ['Wandernde Tore', 'Manche Tore bewegen sich – bleib dran!'],
    crate: ['Kisten', 'Zerschlage Kisten für Extra-Münzen.'],
    sub: ['Sperren', 'Rote „−“-Sperren fressen Wusels. Durchbrich sie – dahinter wartet oft etwas Gutes.'],
    cage: ['Käfige', 'Befreie gefangene Wusels – sie kämpfen sofort mit!'],
    brute: ['Brocken', 'Dicke Grummels halten viel aus. Feuer konzentrieren!'],
    pickup: ['Power-ups', 'Triff die Symbole: Schnellfeuer, Frost, Bombe, Mega oder Herz.'],
    div: ['Teiler', 'Orange „÷“-Tore halbieren deine Truppe. Ausweichen!'],
    boss: ['Bosskampf', 'Besiege den Boss, bevor er dich erreicht. Achtung beim roten Kreis!'],
    saw: ['Sägen', 'Sägeblätter zerlegen alles – auch Grummels.'],
    runner: ['Flitzer', 'Schnelle Grummels schlagen Haken. Schild im Auge behalten!'],
    tnt: ['Knallkugel', 'Triff sie, wenn viele Grummels in der Nähe sind.'],
    spin: ['Drehbalken', 'Warte auf die Lücke oder nimm die andere Seite.'],
    hole: ['Abgründe', 'Kein Boden, keine Wusels. Wähle die Bahn mit Brücke.'],
    panzer: ['Panzer-Grummels', 'Mit Helm halten sie mehrere Treffer aus.'],
    turret: ['Mörser', 'Der rote Kreis zeigt den Einschlag – Feuer kurz pausieren oder ausweichen.'],
    bomber: ['Knaller', 'Explodieren beim Platzen. Früh abfangen!'],
  },
  tips: [
    'Tipp: Mehrere Tore hintereinander multiplizieren sich.',
    'Tipp: Der Mega-Wusel räumt Sperren und Brocken ab.',
    'Tipp: Grummels zielen auf dich – ein Schwenk zur Mitte hält die Linie.',
    'Tipp: Upgrades machen jedes Level leichter.',
    'Tipp: Drei Sterne gibt es für einen fast unversehrten Schild.',
  ],
  pick: ['Schnellfeuer!', 'Frost!', 'Bombe!', 'Mega bereit!', 'Schild +2'],
  megaReady: 'MEGA bereit!', stageClear: 'Festung gefallen!', bossIn: 'kommt!', tapStart: 'Tippen zum Starten',
};

const en = {
  title1: 'WUSEL', title2: 'WARS', tagline: 'Multiply your Wusels. Storm the fortress.',
  play: 'Play', level: 'Level', levels: 'Levels', upgrades: 'Upgrades', settings: 'Settings', back: 'Back',
  continue: 'Continue', retry: 'Retry', home: 'Menu', resume: 'Resume', restart: 'Restart', pause: 'Paused',
  next: 'Next level', win: 'Cleared!', lose: 'Overrun!', bossWin: 'Boss defeated!',
  collected: 'Collected', bonus: 'Level bonus', total: 'Total', newBest: 'New best!',
  shield: 'Shield', crowd: 'Wusels', boss: 'BOSS', stage: 'Stage', endless: 'Endless',
  world: 'World', locked: 'Defeat the previous world\'s boss', bossLevel: 'Boss',
  worlds: ['Blossom Meadow', 'Dune Sea', 'Frost Peak', 'Ember Maw', 'Neon Harbor', 'Star Reef'],
  bosses: ['Chief Grummel', 'Sand Roller', 'Ice Block', 'Ember Chunk', 'Neon Tyrant', 'Star Devourer'],
  up: {
    rate: ['Fire rate', 'More Wusels per second'],
    multi: ['Double shot', 'Chance for a bonus Wusel'],
    mega: ['Mega Wusel', 'Stronger and ready sooner'],
    shield: ['Shield', 'Takes more hits'],
    coins: ['Coin magnet', 'More coins per level'],
  },
  max: 'MAX', lvl: 'Lv', skins: 'Colours', needStars: 'stars needed', selected: 'Active', select: 'Select',
  skin: { mint: 'Mint', sun: 'Sun', berry: 'Berry', ocean: 'Ocean', lime: 'Lime', ghost: 'Ghost' },
  sfx: 'Sound effects', music: 'Music', vib: 'Vibration', quality: 'Graphics', lang: 'Language', auto: 'Auto fire',
  q: { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High' },
  reset: 'Erase progress', resetAsk: 'Really erase everything?', yes: 'Yes, erase', no: 'Cancel',
  hintDrag: 'Hold to fire – drag to aim',
  intro: {
    basics: ['How to play', 'Send Wusels through the gates – every gate multiplies them!'],
    add: ['Bonus gate', 'Yellow "+" gates hand out extra Wusels until their stock is empty.'],
    move: ['Moving gates', 'Some gates wander – keep tracking them!'],
    crate: ['Crates', 'Smash crates for extra coins.'],
    sub: ['Barriers', 'Red "−" barriers eat Wusels. Break through – something good often waits behind.'],
    cage: ['Cages', 'Free captured Wusels – they join the fight at once!'],
    brute: ['Brutes', 'Big Grummels take a lot. Focus your fire!'],
    pickup: ['Power-ups', 'Hit the icons: rapid fire, frost, bomb, mega or heart.'],
    div: ['Dividers', 'Orange "÷" gates halve your troop. Avoid them!'],
    boss: ['Boss fight', 'Beat the boss before it reaches you. Watch the red circle!'],
    saw: ['Saws', 'Saw blades shred everything – Grummels too.'],
    runner: ['Runners', 'Fast Grummels zig-zag. Watch your shield!'],
    tnt: ['Boom ball', 'Hit it when many Grummels are near.'],
    spin: ['Spinners', 'Wait for the gap or take the other side.'],
    hole: ['Pits', 'No floor, no Wusels. Pick the lane with a bridge.'],
    panzer: ['Armoured Grummels', 'Helmets let them take several hits.'],
    turret: ['Mortars', 'The red circle marks the impact – hold fire or dodge.'],
    bomber: ['Bombers', 'They explode when popped. Intercept early!'],
  },
  tips: [
    'Tip: Gates in a row multiply each other.',
    'Tip: The Mega Wusel clears barriers and brutes.',
    'Tip: Grummels aim at you – a sweep to the middle holds the line.',
    'Tip: Upgrades make every level easier.',
    'Tip: Three stars need an almost untouched shield.',
  ],
  pick: ['Rapid fire!', 'Frost!', 'Bomb!', 'Mega ready!', 'Shield +2'],
  megaReady: 'MEGA ready!', stageClear: 'Fortress down!', bossIn: 'incoming!', tapStart: 'Tap to start',
};

const DICTS = { de, en };
let cur = de;
export let lang = 'de';

export function setLang(l) {
  lang = DICTS[l] ? l : (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
  cur = DICTS[lang];
  document.documentElement.lang = lang;
}

export function t(key) {
  const parts = key.split('.');
  let v = cur;
  for (const p of parts) v = v?.[p];
  return v ?? key;
}
