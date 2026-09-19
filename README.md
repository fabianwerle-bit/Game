# Slime Sweep — Android-Prototyp 0.2

Eine native Android-App mit OpenGL ES 2.0. Kein Browser, keine WebView,
kein Login, keine Werbung, keine Internetberechtigung.

## Spielen

- Hochkant spielen, mit dem Joystick unten rollen.
- Perspektivkamera dicht hinter dem Schleim; sie folgt der Laufrichtung weich.
- Bei Häuserwänden rückt die Kamera näher an die Figur.
- Jeder neue Joystick-Zug orientiert sich an der aktuellen Kamerarichtung.
- Dosen, Flaschen und Kartons automatisch aufsammeln (maximal 10).
- Zur grünen Recyclingstation in der Inselmitte rollen: automatische Abgabe.
- Jede Abgabe bringt Punkte und 1,65 Sekunden pro Müllteil zurück.
- Große Lieferungen und aufeinanderfolgende Lieferungen bringen Bonuspunkte.
- Der Zeitverbrauch steigt mit der Spieldauer. Autos kosten bei Berührung 4 Sekunden.
- Passanten lassen immer neuen Müll fallen.
- Der Rekord wird auf dem Gerät gespeichert. Im Hintergrund pausiert das Spiel.
- Tonausgabe kann im Start- oder Pausenmenü abgeschaltet werden.

## Installation

Die APK auf ein Android-Gerät laden und öffnen. Falls Android danach fragt,
die Installation aus dieser Quelle für den verwendeten Dateimanager oder Browser
zulassen. Android 6.0 oder neuer, OpenGL ES 2.0. Die APK ist als Entwicklungsbuild
signiert; sie ist nicht über Google Play veröffentlicht.

## Echte Grafikassets

Originale Kenney-3D-Modelle (CC0), in ein kompaktes OpenGL-Meshformat konvertiert:

- Stadthäuser, Geschäfte, Sonnenschirme: https://kenney.nl/assets/city-kit-commercial
- Häuser, Bäume, Wege: https://kenney.nl/assets/city-kit-suburban
- Straßen, Kreuzungen, Laternen: https://kenney.nl/assets/city-kit-roads
- Autos: https://kenney.nl/assets/car-kit
- Figuren: https://kenney.nl/assets/mini-characters
- Gras, Blumen, Sträucher, Steine: https://kenney.nl/assets/nature-kit
- Müllgegenstände: https://kenney.nl/assets/food-kit

Originale Lizenztexte liegen unter `assets/licenses/`; die Zuordnung der Modelle
steht in `assets/models.json`. Die Gebäude, Straßen, Fahrzeuge und Landschaftsobjekte
sind heruntergeladene 3D-Assets, keine KI-generierten Bilder. Die Fassaden und Dächer wurden für eine kräftige, bunte Farbpalette umgefärbt. Spielfeldanordnung,
Schleim, Recyclingstation und Benutzeroberfläche sind für diesen Prototyp programmiert.

Die fünf Audiodateien sind eigens erstellte Soundeffekte: Plopp beim Aufsammeln,
Schlürfen beim Abliefern, federnder Bounce bei Kollisionen, ein blubbernder Ausklang
am Rundenende und ein kurzer Menü-Pop. Generator: `tools/make_audio.py`.

## Quellcode bauen (Linux)

Java 17 Runtime, Python 3, unzip erforderlich. Die fertigen Grafik- und Audioassets
liegen bei und müssen für einen normalen Build nicht neu erstellt werden.

```sh
python3 tools/setup_android.py
./build.sh
```

Ergebnis: `build/Slime-Sweep-0.2.apk`.
Der Build verwendet Android SDK Platform 35, Build Tools 35.0.0 und Eclipse ECJ 3.38.0.
Alternative Pfade: `ANDROID_BUILD_TOOLS`, `ANDROID_JAR`, `ECJ_JAR`.

`dev-signing.p12` ist ein ausschließlich für diesen Prototyp verwendeter
Entwicklungsschlüssel (Alias `slime-dev`, Passwort `android`). Mit demselben
Schlüssel können weitere Prototyp-Versionen über diese Installation installiert
werden. Für eine öffentliche Veröffentlichung einen eigenen geschützten
Veröffentlichungsschlüssel verwenden.

## Umfang

Eine Insel, ein Schleim, eine Endlos-Highscore-Spielrunde mit steigendem Zeitdruck.
Dies ist ein erster spielbarer Prototyp, noch kein abschließend auf verschiedenen
Handys getestetes Store-Spiel.

## Version 0.2 — Änderungen und Prüfung

- Straßennahe Third-Person-Kamera mit 64° Perspektive und weicher Nachführung.
- Kamerakollision mit Häusern, sanfte Rückkehr und Ausblenden der Figur bei sehr geringem Abstand.
- Dichtere Stadt mit zwölf Gebäuden, Geschäften, bunten Fassaden, Palmen, Markisen,
  Sonnenschirmen, Blumen und achtzehn Passanten.
- Sichtbar fallender Müll, glänzender Schleim und sichtbare gesammelte Gegenstände.
- Straßenkacheln auf die Fahrtrichtung korrigiert.
- Gleicher Entwicklungsschlüssel und erhöhte Versionsnummer: Update über Version 0.1 möglich.

Prüfung: Build und APK-Signatur erfolgreich, Spielregeln und Kamerabewegung in JVM-Tests
geprüft, drei Ansichten mit den tatsächlichen Szenen-Daten und Shadern außerhalb von
Android gerendert und visuell geprüft. Kein abgeschlossener Test auf einem Android-Handy.
Der Grafikstil bleibt ein vereinfachter 3D-Prototyp und entspricht nicht der Detailfülle
der bereitgestellten Konzeptbilder.
