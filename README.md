# Wusel Wars

Ein 3D-Schwarm-Actionspiel für Handy und Browser: Du steuerst einen Werfer, schickst kleine
„Wusels" durch Multiplikator-Tore und stürmst mit der wachsenden Horde die Festung der Grummels.

- **Web-App / PWA** – läuft in jedem modernen Browser, lässt sich auf dem Homescreen installieren und funktioniert offline.
- **Android-APK** – dieselbe App in einer schlanken nativen Hülle (WebView), ohne Internet-Berechtigung.
- **Keine Asset-Dateien** – alle Modelle, Texturen, Soundeffekte und die Musik werden zur Laufzeit erzeugt. Das ganze Spiel ist eine einzige HTML-Datei (~670 kB).

## Spielen

| Aktion | Touch | Tastatur |
| --- | --- | --- |
| Feuern | Finger halten | Leertaste |
| Zielen | Ziehen | ← → / A D |
| Pause | Pause-Knopf / Zurück-Taste | Esc / P |

Tore: **×N** vervielfacht jeden Wusel, **+N** verschenkt N Bonus-Wusels, **−N** ist eine Sperre, die N Wusels kostet,
**÷N** dezimiert die Truppe. Ist die Mega-Leiste voll, ist der nächste Schuss ein Mega-Wusel.
Gegner, die deine Linie erreichen, kosten Schild – bei 0 ist das Level verloren.

Abschüsse füllen die **Rausch-Leiste**: Ist sie voll, feuerst du einige Sekunden lang doppelt so schnell.
Knaller (Gegner mit Lunte) und Knallkugeln reißen ihre Umgebung mit – in der Horde gibt das Kettenreaktionen.
Ein Mega-Wusel explodiert, wenn er fällt.

## Spielmodi

- **Eroberung** – der Feldzug: Tore nutzen, Gegner abwehren und die Festung am Ende der Bahn stürmen. 6 Welten × 10 Level, jedes 10. ein Bosskampf.
- **Ansturm** – Horden-Modus: Eine riesige Grummel-Horde steht schon beim Start als Wand auf dem Feld und marschiert in
  dichten Reihen über die ganze Bahnbreite auf dich zu. Wusels und Grummels heben sich 1:1 auf – nur mit vervielfachtem
  Strom reibst du die Horde auf, bevor ihre Front deine Tore überrollt. 6 Welten × 5 Level, jedes 5. mit Hordenfürst.

Beide Modi teilen sich Münzen, Upgrades und Sterne; danach geht es jeweils endlos weiter.

## Inhalt

- Zwei Modi mit zusammen 90 Leveln, danach Endlos-Modus
- Neue Mechaniken werden nach und nach eingeführt: wandernde Tore, Sperren, Kisten, Käfige, Knallkugeln,
  Sägen, Drehbalken, Abgründe, Mörser, Power-ups sowie 5 Gegnertypen und Bosse
- Mehrstufige Level, 3-Sterne-Wertung, 5 Upgrades, freischaltbare Farben
- Deutsch und Englisch, Vibration, drei Grafikstufen mit automatischer Auflösungsanpassung

## Entwickeln

```bash
npm install
npm run build        # baut dist/ (PWA) und kopiert das Spiel in das Android-Projekt
npm run dev          # Build + lokaler Server auf http://localhost:8080
npm test             # ein Bot spielt alle Level beider Modi durch (Balance-Check)
npm run calibrate    # misst die Hordenstärke je Ansturm-Level neu ein (schreibt src/hordeTable.js)
```

Nützliche URL-Parameter: `?debug` (FPS-Anzeige), `?level=25` (direkt in ein Level), `?horde=8` (direkt in ein Ansturm-Level), `?bot` (Bot spielt),
`?q=low|medium|high` (Grafikstufe erzwingen).

### Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/sim.js` | Spiellogik ohne Rendering (läuft auch in Node) |
| `src/levels.js`, `src/hordeTable.js` | deterministischer Level-Generator und Balancing (Hordenstärken sind per Bot eingemessen) |
| `src/render.js`, `src/models.js`, `src/textures.js`, `src/fx.js` | three.js-Darstellung, prozedurale Modelle und Texturen, Partikel |
| `src/audio.js` | synthetisierte Soundeffekte und Musik (WebAudio) |
| `src/ui.js`, `src/styles.css` | Menüs und HUD |
| `tools/` | Balance-Bot, Statistik, Screenshot- und Icon-Werkzeuge |
| `android/` | Android-Projekt (Gradle), das die Web-App als APK verpackt |

## APK bauen

Die APK wird bei jedem Push von GitHub Actions gebaut (`.github/workflows/build.yml`). Der jeweils neueste Build
liegt als **WuselWars.apk** im Release [`latest`](../../releases/tag/latest), zusätzlich hängt er als Artefakt
an jedem Workflow-Lauf. Lokal (mit installiertem Android SDK):

```bash
npm run build
cd android && ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

Signiert wird mit einem öffentlichen Test-Schlüssel (`android/app/wuselwars-test.keystore`), damit sich
neue Builds über alte installieren lassen. Für eine Veröffentlichung im Store bitte durch einen eigenen,
privaten Schlüssel ersetzen.

## Lizenzen

Rendering mit [three.js](https://threejs.org) (MIT). Schriften: Lilita One und Nunito (SIL Open Font License).
