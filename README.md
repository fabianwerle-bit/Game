# Letzte Ausfahrt

Kleines Indie-Horror-Open-World-Spiel fürs Handy (Android-APK), Egoperspektive.
Eine kleine Insel, ein alter Camper-Bus. Am Anfang ist noch alles gut – aber von Tag zu Tag
wird es schlimmer. Und nachts kommt jemand die Straße herunter.

## Spielen

- **Links wischen/halten:** laufen bzw. lenken · **rechts wischen:** umsehen
- **Aktion:** nehmen, lesen, Türen, ein-/aussteigen · **Feuer:** schießen (wenn die Pistole gezogen ist)
- **Inventarleiste unten:** antippen = benutzen (Licht an/aus, essen, Pistole ziehen, Zettel lesen)
- **Im Bus hinten:** Bett (schlafen ab 22 Uhr), Küche (Konserve aufwärmen), Zettel, Fahrersitz, Tür – einfach hinsehen und Aktion drücken
- Am PC (Browser): WASD, Maus, `E` Aktion, `F` Licht, `Q` Essen, `G` Pistole, Leertaste Feuer, `B` nach hinten, `J` Notizen

## Inhalt (v0.2)

- Insel ohne Raster: Hafen (Start), Dorf mit Laden, Gasthaus, Kapelle und Wohnhäusern, Tankstelle,
  Jagdhütte, Leuchtturm, verlassenes Camp – alle Gebäude begehbar
- Ringstraße, Querstraße über die Insel, Dorf-, Hafen- und Waldwege
- Camper-Bus mit begehbarem Wohnbereich
- Hunger, Sprit, Vorräte, Pistole + Munition
- Zettel-Geschichte mit Zielen, jeden Morgen ein neuer Zettel an der Windschutzscheibe, Ende mit Wendung
- Ab der zweiten Nacht: der Mann im abgedeckten Auto. Er folgt den Straßen, steigt aus und kommt zu Fuß.
  Ein Treffer vertreibt ihn für eine Nacht.
- Jumpscares, Horrorfilter (Korn, Vignette, Farbsäume, Entsättigung – wird von Tag zu Tag stärker)

## Aufbau

| Ordner | Inhalt |
|---|---|
| `web/` | Das Spiel (three.js / WebGL, Vite). `web/src/` = Code, `web/public/assets/` = Texturen & Modelle |
| `android/` | Dünne Android-Hülle (WebView, Vollbild, Querformat), packt `web/dist` als Assets ein |
| `tools/fetch_assets.py` | Lädt die Assets neu von Poly Haven |
| `build_apk.sh` | Baut alles → `release/LetzteAusfahrt.apk` |

Wichtige Dateien in `web/src/`: `world.js` (Insel, Straßen, Wegenetz), `buildings.js` (Orte, Häuser, Gegenstände),
`bus.js`, `stalker.js` (Verfolger), `story.js` (alle Texte), `weather.js` (Eskalation pro Tag), `fx.js` (Filter, Gras),
`main.js` (Spiellogik).

Im Browser testen: `cd web && npm install && npx vite`

## Assets / Lizenz

Alle Texturen, 3D-Scans (Möbel, Pistole, Requisiten, abgedecktes Auto) und der Himmel stammen von
[Poly Haven](https://polyhaven.com) (CC0). Tannen, Farn und Gras sind aus Poly-Haven-Scans gebacken.
Häuser und der Bus sind selbst modelliert und mit Fototexturen belegt (lizenzfreie Scans davon gibt es nicht).
Ton wird komplett im Spiel synthetisiert.
