# ADC Dashboard – Arbeitsregeln für Claude

Dieses Repo ist das **„Dein ADC Dashboard“**: eine Übersicht der Ideen und Initiativen aus der ADC-Ideensammlung (Sli.do), getrennt nach dem, was Sektionen selbst umsetzen können, und dem, was Gesamtverein, Präsidium oder JHV braucht.
Verantwortlich ist André Hennen (CCO/Partner Curious Company, Sektionsvorstand ADC Hamburg). Kommunikation auf Deutsch, direkt, knapp, inhaltlich. André gibt kurze, iterative Anweisungen.

## Hosting & Workflow

- Repo `andrehennen/adc`, Branch `main` → Vercel deployt automatisch nach https://adc-germany-dashboard.vercel.app/ (alte URL adc-hh-dashboard leitet dorthin weiter)
- **Standardregel: Jede Änderung am Dashboard wird committed und gepusht**, ohne nachzufragen. Danach kurz sagen, was sich geändert hat.
- Ändern sich Anträge, wird auch `antraege-jhv.pdf` neu gebaut und gepusht (siehe unten).
- Der Kompass ist ein separates Repo: `andrehennen/adc-compass` → https://adc-compass.vercel.app/
- **Niemals** Tokens oder Zugangsdaten in `index.html` schreiben (GitHub Secret Scanning blockt das, und die Seite ist öffentlich).

## Grundsätze (wichtig, hart erarbeitet)

- **Das Dashboard ist die Single Source of Truth.** Trello wird nicht mehr genutzt.
- **Kein Freitext, keine Auswahlfelder, keine Speicherfunktion auf der Seite.** Persistenz aus dem Browser funktioniert nicht. Status, Verantwortliche und Inhalte ändert nur Claude im Code, auf Andrés Anweisung.
- Vor jeder Änderung logisch und auf UX prüfen. Bei Unklarheit **erst fragen**, dann bauen.
- Nach jeder Änderung prüfen, ob `var D = [...]` noch parst (z. B. mit Node per Regex extrahieren und `eval`) und ob die Seite ohne JS-Fehler rendert.
- Beim Entfernen von Tickets auf verwaiste Kommas achten (`,\s*,`).
- **Leitlinien** (`rahmen`) sind getroffene Entscheidungen und Ziele, keine nächsten Schritte.
- Anträge nicht zusammenlegen, wenn André es nicht ausdrücklich sagt.

## Datenmodell (in `index.html`, `var D = [...]`)

Jedes Ticket ist ein Objekt:

| Feld | Bedeutung |
|---|---|
| `s` | `"hh"` = Sektionen (linke Spalte), `"jhv"` = Gesamtverein / Präsidium / JHV (rechte Spalte) |
| `sektion` | `"Hamburg"` / `"Berlin"` (optional, für den Sektionsfilter) |
| `e` | Emoji |
| `n` | Titel (aus ihm wird auch die Ticket-ID für Deep-Links `#slug` gebildet) |
| `v` | Stimmen aus der Sli.do-Sammlung (Zahl oder `null`) |
| `t` | Tags: `events`, `network`, `members`, `jury` |
| `f` | Aufwand: `easy`, `medium`, `complex` |
| `status` | `idea`, `planned`, `active`, `draft`, `checked`, `doing`, `live`, `done` |
| `prio` | `true` für Prio-Tickets (stehen ganz oben) |
| `owner` | Verantwortliche:r; fehlt er, zeigt die Karte „Noch offen“ und einen Mitmach-Hinweis |
| `x` | Nächste Schritte (`1. … 2. …` oder mit `;` getrennt, wird zu Bullets) |
| `bisher` | Bisher passiert, mit ` \| ` getrennt |
| `rahmen` | Leitlinien, mit ` \| ` getrennt |
| `antrag` | JHV-Antragstext (im Dashboard mit Kopierbutton) |
| `antragPdf` | Nur-PDF-Fassung, überschreibt `antrag` im PDF |
| `antragTitel` | Nur-PDF-Titel, überschreibt `n` im PDF |
| `orig` | Originalidee(n) aus der Sammlung, wörtlich |

Status-Labels: 💡 Idee · 📋 Geplant · ⚡ In Arbeit · 📝 Entwurf vorbereitet · 🔍 Prüfung abgeschlossen · ✅ Wird gemacht! · 🟢 Live, wird getestet · ✅ Abgeschlossen

Sortierung: zuerst Prio, dann Status (done > doing > live > active > draft > checked > planned > idea), dann „hat Owner“, dann Stimmen.
In jeder Spalte gibt es zwei Gruppen: „🚀 Läuft schon“ (alles außer `idea`) und „💡 Ideen – suchen Mitstreiter:innen“.

## Design (seit Okt. 2026)

- Hell, orientiert an adc.de: weißer Hintergrund, schwarze Typo, Inter, große fette Headlines, ADC-Logo schwarz (als base64 eingebettet).
- **Mindestschriftgröße 14 px**, Fließtext 17 px, Ticket-Titel 19 px.
- Die Tickets sind einklappbar (Accordion, kein Modal), dazu gibt es „Alle aufklappen“ und pro Ticket „Link zu dieser Idee kopieren“.
- Muss auf dem iPhone funktionieren (kein horizontales Scrollen) und ist als Homescreen-App nutzbar (Manifest, Apple-Meta-Tags, Auto-Reload nach mehr als 2 Minuten im Hintergrund).
- „Letztes Update“ kommt automatisch aus dem letzten GitHub-Commit.

Feste Links:
- 🧭 ADC Kompass: https://adc-compass.vercel.app/
- 💡 Idee vorschlagen!: https://app.sli.do/event/9tSaEJk3TA4ixbnNpB3LAU/live/polls
- 💬 WhatsApp Gruppe: https://chat.whatsapp.com/FXO2e2MOiaY0qElp6SQVUc?mode=gi_t
- 📄 Anträge JHV.pdf: https://github.com/andrehennen/adc/raw/main/antraege-jhv.pdf (der relative Pfad funktionierte auf Vercel nicht)
- Footer: „Stand Juli 2026 · Erstellt und verantwortlich André Hennen, Curious Company“

## JHV-Anträge & PDF (`antraege-jhv.pdf`)

- Antragsteller-Formulierung immer: **„André Hennen, stellvertretend für die Ideen aus der Sektion Hamburg, beantragt …“**
- Reihenfolge im PDF: Satzungsänderungen zuerst.
- Aktuell 4 Anträge:
  1. Alle Wahlen digital (Satzungsänderung)
  2. Abstimmungen vereinfachen (Satzungsänderung, § 6.5)
  3. ADC Artist Shop – freie Arbeiten von Mitgliedern (A24-Shop als Referenz, ausdrücklich kein ADC-Logo-Merch)
  4. Jury-Kandidatur um Arbeiten ergänzen (im PDF nur Variante A)
- PDF-Layout (reportlab), ADC-CI:
  - schwarzes Cover mit ADC-Logo
  - Headlines Times-Bold, Fließtext Helvetica
  - Kopfzeile „ADC“ / „JHV-Anträge · Entwurfsfassung“, Seitenzahlen
  - keine Emojis (sie werden im PDF als Kästchen gerendert)
- Das alte Build-Skript ist nicht im Repo. Beim nächsten Neubau ein Skript `tools/build_pdf.py` anlegen, das die Anträge aus `index.html` liest, und es mit einchecken.

### Offene Punkte (Stand 1.10.2026)

Das Präsidium hat mit Anwalt einen Gegenvorschlag zu den Satzungsänderungen geschickt (`20260914_Satzungsaenderungen.docx`).

- **Wahlen:** Die Präsidiumsfassung (§ 7.2, allgemein für virtuell/hybrid/online) ist die bessere. Empfohlen wird, in § 7.2 zu ergänzen: „Bei Wahlen ist sicherzustellen, dass die Stimmabgabe geheim, nachvollziehbar und dokumentierbar erfolgt.“
- **Abstimmungen:** „Einwandverfahren“ statt „Konsent“. Die bisherige Fassung enthält noch den widersprüchlichen Satz zu Enthaltungen. André hat noch nicht entschieden zwischen:
  - a) die Ermessensfassung des Präsidiums übernehmen
  - b) eine verbindliche Regel ohne den Enthaltungssatz
  - c) eine verbindliche Regel mit Mindestzustimmung (z. B. ≥ 25 % der Anwesenden)
