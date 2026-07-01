# Gambit — Beziehungsstrategie 🤝

Eine minimalistische App, um auf Basis der **Spieltheorie** (Tit for Tat & Verwandte) den
Überblick zu behalten, *mit welcher Person du wo stehst* — und was dein nächster kluger Zug ist.

Lege eine Person an (z. B. „Tom Müller"), hake nach jeder Interaktion an, ob sie **nett war
und kooperiert hat (grün)** oder **nicht (rot)**. Gambit schlägt dir – begründet durch die
gewählte Strategie – vor, ob du beim nächsten Mal **kooperieren** oder **dich zurückziehen** solltest.

Der **Spielverlauf** wird zweizeilig dargestellt (obere Reihe = deine Züge, untere = die der
Person), spaltenweise pro Runde ausgerichtet und horizontal scrollbar. **Tippe einen Kreis**,
um **Datum** (Standard: jetzt, editierbar), **Thema** (Freitext *oder* Auswahl aus bereits
verwendeten Themen) und **Details** (Freitext) zu erfassen.

Die Farben sind auf **Rot-Grün-Sehschwäche** ausgelegt (helles Grün, dunkles Rot – großer
Helligkeitskontrast), und die Oberfläche kommt ohne dekorative Emojis aus.

## Nutzung

Keine Installation, kein Build. Einfach `index.html` im Browser öffnen
(Desktop oder Handy). Alle Daten bleiben lokal im Browser (`localStorage`).
Export/Import als JSON über das Menü (⋯).

## Strategien

| Strategie | Kurz |
|---|---|
| 🕊️ **Großzügiges Tit for Tat** *(Standard)* | Startet nett, spiegelt, **verzeiht einen einzelnen Ausrutscher**. Robust gegen Missverständnisse. |
| 🧠 **Contrite Tit for Tat** | Erkennt, ob der andere dich *zu Recht* bestraft hat (→ verzeihen) oder grundlos angriff (→ reagieren). |
| 🪞 **Tit for Tat** | Der Klassiker: spiegelt exakt den letzten Zug. Fair, aber streng. |
| 🎯 **Pavlov** (Win-Stay, Lose-Shift) | Behält bei, was funktioniert; wechselt, was nicht. Durchsetzungsstark. |
| ⛔ **Grim Trigger** | Ein Vertrauensbruch = für immer keine Kooperation mehr. |

**Warum „großzügig" als Standard?** In echten Beziehungen gibt es „Rauschen"
(schlechte Tage, Missverständnisse). Ein rein spiegelndes Tit for Tat gerät nach
einem einzelnen Fehler in eine endlose Vergeltungsschleife. Etwas Nachsicht
verhindert das, ohne dich ausbeutbar zu machen.

## Dateien

- `index.html` — Struktur
- `app.css` — Design (hell/dunkel automatisch)
- `strategies.js` — spieltheoretische Engine (Empfehlung + Begründung)
- `app.js` — App-Logik, Speicherung, UI
