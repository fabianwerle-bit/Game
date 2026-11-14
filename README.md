# Letzte Ausfahrt

Kleines Indie-Horror-Open-World-Spiel fürs Handy (Android-APK), Egoperspektive.
Eine kleine Insel, ein alter Camper-Bus. Am Anfang ist noch alles gut – aber von Tag zu Tag
wird es schlimmer: mehr Nebel, mehr Regen, weniger Licht.

## Spielen

- **Links wischen/halten:** laufen bzw. lenken · **rechts wischen:** umsehen
- **Aktion:** Dinge nehmen, in den Bus ein-/aussteigen · **Licht:** Taschenlampe / Scheinwerfer
- **Essen:** Vorrat essen · **Schlafen:** im Bus, ab 17 Uhr → nächster Tag
- Am PC (Browser): WASD, Maus, `E` Aktion, `F` Licht, `Q` Essen, `R` Schlafen

Ziel der ersten Version: überleben. Essen und Benzinkanister findest du an der Tankstelle,
in der Hütte im Wald, am Leuchtturm, am Steg, im Camp und in Kisten am Straßenrand.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `web/` | Das Spiel (three.js / WebGL, Vite). `web/src/` = Code, `web/public/assets/` = Texturen & Modelle |
| `android/` | Dünne Android-Hülle (WebView, Vollbild, Querformat), packt `web/dist` als Assets ein |
| `tools/fetch_assets.py` | Lädt die Assets neu von Poly Haven |
| `build_apk.sh` | Baut alles → `release/LetzteAusfahrt.apk` |

Die Insel ist **kein Raster**: Küstenlinie und Höhen entstehen aus Rauschen (`web/src/world.js`),
die Ringstraße ist ein Spline, Orte werden frei darauf gesetzt.

Im Browser testen: `cd web && npm install && npx vite`

## Eskalation (web/src/weather.js)

| Tag | Wetter |
|---|---|
| 1 | Sonne, klare Sicht, Vögel, Lagerfeuer brennt |
| 2 | grau, nachmittags Niesel |
| 3 | Dauerregen, Feuer aus, Neonlicht der Tankstelle flackert |
| 4 | dichter Nebel, Hütte dunkel – etwas steht zwischen den Bäumen |
| 5+ | Sturm, Gewitter, kaum noch Tageslicht |

## Assets / Lizenz

Alle Texturen, 3D-Scans und der Himmel stammen von [Poly Haven](https://polyhaven.com) (CC0).
Die Tannen sind aus dem Poly-Haven-Scan `fir_sapling` gebacken. Ton wird komplett im Spiel synthetisiert.
