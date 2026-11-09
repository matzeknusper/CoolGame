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

## Inhalt

- 6 Welten mit je 10 Leveln (jedes 10. ist ein Bosskampf), danach Endlos-Modus
- Neue Mechaniken werden nach und nach eingeführt: wandernde Tore, Sperren, Kisten, Käfige, Knallkugeln,
  Sägen, Drehbalken, Abgründe, Mörser, Power-ups sowie 5 Gegnertypen und Bosse
- Mehrstufige Level, 3-Sterne-Wertung, 5 Upgrades, freischaltbare Farben
- Deutsch und Englisch, Vibration, drei Grafikstufen mit automatischer Auflösungsanpassung

## Entwickeln

```bash
npm install
npm run build        # baut dist/ (PWA) und kopiert das Spiel in das Android-Projekt
npm run dev          # Build + lokaler Server auf http://localhost:8080
npm test             # ein Bot spielt alle 60 Level durch (Balance-Check)
```

Nützliche URL-Parameter: `?debug` (FPS-Anzeige), `?level=25` (direkt in ein Level), `?bot` (Bot spielt),
`?q=low|medium|high` (Grafikstufe erzwingen).

### Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/sim.js` | Spiellogik ohne Rendering (läuft auch in Node) |
| `src/levels.js` | deterministischer Level-Generator und Balancing |
| `src/render.js`, `src/models.js`, `src/textures.js`, `src/fx.js` | three.js-Darstellung, prozedurale Modelle und Texturen, Partikel |
| `src/audio.js` | synthetisierte Soundeffekte und Musik (WebAudio) |
| `src/ui.js`, `src/styles.css` | Menüs und HUD |
| `tools/` | Balance-Bot, Statistik, Screenshot- und Icon-Werkzeuge |
| `android/` | Android-Projekt (Gradle), das die Web-App als APK verpackt |

## APK bauen

Die APK wird von GitHub Actions gebaut (`.github/workflows/build.yml`) und hängt als Artefakt
**WuselWars-apk** an jedem Workflow-Lauf. Lokal (mit installiertem Android SDK):

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
