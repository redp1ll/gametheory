# Gambit — Beziehungsstrategie

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

## Daten & Anmeldung

Die Einträge liegen in einer Postgres-Datenbank bei Supabase (Region Frankfurt).
Der Zugriff ist über *Row Level Security* abgesichert: Jede Zeile gehört einem
Konto, und die Datenbank gibt ausschliesslich die eigenen Zeilen heraus – auch
dann, wenn jemand den öffentlichen Schlüssel aus dem Quelltext benutzt.
Angemeldet wird sich mit E-Mail und Passwort. Das braucht keinen Mailversand
und funktioniert deshalb auch in der auf dem Startbildschirm installierten App;
das iPhone kann das Passwort im Schlüsselbund sichern und per Face ID
ausfüllen. Wer sein Passwort vergisst, fordert über „Passwort vergessen" einen
Link zum Zurücksetzen an.

Beim ersten Anmelden bietet die App an, zuvor lokal gespeicherte Einträge in
das Konto zu übernehmen. Sicherung und Wiederherstellung als JSON gibt es
weiterhin im Menü unter „Daten".

## Nutzung

Keine Installation, kein Build.

**Sofort ausprobieren (lokal):** Repository herunterladen und `index.html`
im Browser öffnen (Doppelklick). Läuft vollständig, auch offline.

**Als Web-App aufs Handy (empfohlen):** Über einen statischen Hoster
bereitstellen – am einfachsten **GitHub Pages**:

1. Im Repo **Settings → Pages** öffnen.
2. Unter *Build and deployment* als *Source* **Deploy from a branch** wählen,
   Branch z. B. `main` (oder den Feature-Branch) und Ordner `/ (root)`.
3. Nach ~1 Minute erscheint die URL `https://<user>.github.io/gametheory/`.
4. Diese URL am Handy öffnen → Browser-Menü → **„Zum Startbildschirm
   hinzufügen"**. Dank Manifest + Service-Worker startet sie dann wie eine
   echte App im Vollbild und funktioniert offline.

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

- `index.html` — Struktur und Anmeldebildschirm
- `app.css` — Design (hell/dunkel/System)
- `strategies.js` — spieltheoretische Engine (Empfehlung + Begründung)
- `store.js` — Anmeldung und Datenbankzugriff
- `app.js` — App-Logik und Oberfläche
- `vendor/supabase.js` — Datenbank-Client (fest eingebunden, damit die App
  ohne Fremdserver und offline lädt)

## Lizenz

© 2026 redp1ll. Veröffentlicht unter der
**[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)**
(siehe [`LICENSE`](LICENSE)).

- ✅ **Erlaubt:** Ansehen, Ausprobieren und Nutzung für **nicht-kommerzielle**
  Zwecke (privat, Bildung, Forschung, gemeinnützige Organisationen).
- ⛔ **Nicht erlaubt:** jede **kommerzielle Nutzung** – dazu zählt u. a., die App
  oder Teile davon zu verkaufen, in ein kommerzielles Produkt einzubauen oder
  damit Einnahmen zu erzielen.

**Kommerzielle Nutzung?** Dafür ist eine separate Lizenz nötig – bitte den
Inhaber über ein [GitHub-Issue](https://github.com/redp1ll/gametheory/issues)
kontaktieren.

*Alle nicht ausdrücklich gewährten Rechte bleiben vorbehalten.*
