# Letzte Ausfahrt

Kleines Indie-Horror-Open-World-Spiel fürs Handy (Android-APK), Egoperspektive.
Eine kleine Insel, ein alter Camper-Bus. Am Anfang ist noch alles gut – aber von Tag zu Tag
wird es schlimmer. Und nachts kommt jemand die Straße herunter.

## Spielen

- **Links wischen/halten:** laufen bzw. lenken · **rechts wischen:** umsehen
- **Aktion:** nehmen, lesen, Türen, ein-/aussteigen · **Feuer:** schießen (wenn die Pistole gezogen ist)
- **Inventarleiste unten:** antippen = benutzen (Licht an/aus, essen, Pistole ziehen, Zettel lesen)
- **Im Bus hinten:** Bett (schlafen ab 22 Uhr), Küche (Konserve aufwärmen), Zettel, Fahrersitz, Tür – einfach hinsehen und Aktion drücken
- Am PC (Browser): WASD, Maus, `E` Aktion, `F` Licht, `Q` Essen, `G` Pistole, Leertaste Feuer, `B` nach hinten, `J` Notizen, `M` Karte

## Inhalt (v0.4)

- Insel ohne Raster: Hafen (Start), Dorf Grauwik (Laden, Gasthaus, Kapelle mit Friedhof, Schule, Wohnhäuser,
  Telefonzelle, Bushaltestelle), Tankstelle mit Werkstatt, Jagdhütte, Leuchtturm, Bergwerk mit begehbarem Stollen,
  Sendemast, Schiffswrack, Camp, Nebeninsel (per Boot)
- Hauptstraße mit Markierung, Leitpfosten, Strommasten, Wegweisern und Schildern; Querstraße und Waldwege
- Dorfhäuser außen aus einem gescannten Fassaden-Bausatz (echte Wand-, Fenster- und Türteile)
- Camper-Bus: Wohnbereich (Bett, Küche, Riegel, Kassettenrekorder), Autoradio (abschaltbar), Reifenpanne und leere Batterie, Ausbauteile, spiegelnder Rückspiegel
- Echte Spiegel in den Häusern
- Uhr läuft durch die Nacht bis zum Morgen; Schlafen, sobald er dich verloren hat – oder verriegelt
- Verfolger mit Wahrnehmung: sieht Licht, hört Motor, Schritte und Schüsse; sucht die letzte bekannte Stelle ab.
  Steht der Bus, steigt er aus, rennt zur Tür und reißt sie auf. Verstecken, Ablenken (Hupe, Kofferradio),
  Türen verrammeln oder schießen hilft. Schläfst du zweimal am selben Platz, wartet er dort.
- Inselkarte (findbar), Notizbuch, Kassetten, Telefon, Fotos, Spiegel, Vorzeichen am Morgen
- Taschenlampe braucht Batterien
- Kurze Sequenzen (Fähre legt ab, erste Sichtung), zwei Enden, Zähler für Durchläufe
- Einstellungen (Zahnrad oben rechts): Empfindlichkeit, Knopfgröße, Schwierigkeit, Vibration, Grafik, Fotomodus, Erfolge, Statistik
- Sechs versteckte Polaroids, automatische Skizzen im Notizbuch
- Neues Spiel Plus nach dem ersten Ende: als Verfolger den Camper aufhalten (drittes Ende)
- Admin-/Cheat-Menü: fünfmal schnell auf die Tag-Anzeige oben links tippen, Code `1984`

## Aufbau

| Ordner | Inhalt |
|---|---|
| `web/` | Das Spiel (three.js / WebGL, Vite). `web/src/` = Code, `web/public/assets/` = Texturen & Modelle |
| `android/` | Dünne Android-Hülle (WebView, Vollbild, Querformat), packt `web/dist` als Assets ein |
| `tools/fetch_assets.py` | Lädt die Assets neu von Poly Haven |
| `build_apk.sh` | Baut alles → `release/LetzteAusfahrt.apk` |

Wichtige Dateien in `web/src/`: `world.js` (Insel, Straßen, Wegenetz), `buildings.js` (Orte, Häuser, Gegenstände),
`details.js` (Straßendetails, Schilder, Tiere), `bus.js`, `stalker.js` (Verfolger), `story.js` (alle Texte), `weather.js` (Eskalation pro Tag), `fx.js` (Filter, Gras),
`main.js` (Spiellogik).

Im Browser testen: `cd web && npm install && npx vite`

## Assets / Lizenz

Alle Texturen, 3D-Scans (Möbel, Pistole, Requisiten, abgedecktes Auto) und der Himmel stammen von
[Poly Haven](https://polyhaven.com) (CC0). Tannen, Farn und Gras sind aus Poly-Haven-Scans gebacken.
Dorfhäuser, Kapelle, Hafenbüro, Lagerhalle, Tankstelle, Leuchtturm-Haus, Bergwerks-Schuppen und Masthütte tragen außen
gescannte Fassadenteile (Poly Haven `modular_urban_apartments_facade` und `modular_factory_facade`); Dächer, Innenwände,
Jagdhütte, Leuchtturm, Stollen und der Bus sind selbst modelliert und mit Fototexturen belegt (lizenzfreie Scans davon gibt es nicht).
Ton wird komplett im Spiel synthetisiert.
