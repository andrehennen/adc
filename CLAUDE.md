# ADC Dashboard – Arbeitsregeln für Claude

Dieses Repo ist das **„Dein ADC Dashboard“**: eine Übersicht der Ideen und Initiativen aus der ADC-Ideensammlung (Sli.do), getrennt nach dem, was Sektionen selbst umsetzen können, und dem, was Gesamtverein, Präsidium oder JHV braucht.
Verantwortlich ist André Hennen (CCO/Partner Curious Company, Sektionsvorstand ADC Hamburg). Kommunikation auf Deutsch, direkt, knapp, inhaltlich. André gibt kurze, iterative Anweisungen.

## Hosting & Workflow

- Repo `andrehennen/adc`, Branch `main` → Vercel deployt automatisch nach https://adc-germany-dashboard.vercel.app/ (alte URL adc-hh-dashboard leitet dorthin weiter)
- **Standardregel: Jede Änderung am Dashboard wird committed und gepusht**, ohne nachzufragen. Danach kurz sagen, was sich geändert hat.
- Ändern sich Anträge, wird auch `antraege-jhv.pdf` neu gebaut und gepusht (siehe unten).
- Der Kompass ist ein separates Repo: `andrehennen/adc-compass` → https://adc-compass.vercel.app/
- **Niemals** Tokens oder Zugangsdaten in `index.html` schreiben (GitHub Secret Scanning blockt das, und die Seite ist öffentlich). Einzige Ausnahme: der Supabase **Publishable/anon Key** (`SB_KEY`), der ist dafür gemacht. Den `service_role`/Secret Key und den Mitglieder-Code nie ins Repo.

## Grundsätze (wichtig, hart erarbeitet)

- **Sprache auf der Seite: „Ideen“, nie „Tickets“** (klingt weniger nach Arbeit). Intern im Code und in dieser Datei heißen sie weiter Tickets.

- **Das Dashboard ist die Single Source of Truth.** Trello wird nicht mehr genutzt.
- **Ticket-Inhalte** (Status, Owner, Leitlinien, Anträge) ändert nur Claude im Code, auf Andrés Anweisung. Ausnahme: **Nächste Schritte** können Mitglieder online bearbeiten (siehe Speicher).
- **Speicherfunktion (seit 1.10.2026, Supabase):** Mitglieder können online Tickets anlegen/bearbeiten/löschen, Tickets hochvoten, sich als „Mach mit“ eintragen, Kontaktdaten hinterlegen, Nächste Schritte bearbeiten und kommentieren. Siehe Abschnitt „Speicher (Supabase)“.
- Vor jeder Änderung logisch und auf UX prüfen. Bei Unklarheit **erst fragen**, dann bauen.
- Nach jeder Änderung prüfen, ob `var D = [...]` noch parst (z. B. mit Node per Regex extrahieren und `eval`) und ob die Seite ohne JS-Fehler rendert.
- Beim Entfernen von Tickets auf verwaiste Kommas achten (`,\s*,`).
- **Leitlinien** (`rahmen`) sind getroffene Entscheidungen und Ziele, keine nächsten Schritte.
- Anträge nicht zusammenlegen, wenn André es nicht ausdrücklich sagt.

## Speicher (Supabase)

- Supabase-Projekt `uuqeoefgwqsyvysfyood`, über die Supabase-Vercel-Integration verbunden. Die Seite holt URL und Publishable Key zur Laufzeit von `/api/config` (`api/config.js`, liest die Vercel-Env, gibt nie den Secret Key aus). `SB_URL`/`SB_KEY` oben im Script bleiben leer (nur für lokale Tests). Ist der Speicher nicht erreichbar, fällt die Seite auf Sli.do/WhatsApp zurück.
- Schema: `supabase/schema.sql` (Tabellen `helpers`, `comments`, `suggestions`) `supabase/002_kontakte_naechste_schritte.sql` (`contacts`, `step_edits`) und `supabase/003_tickets_votes.sql` (`tickets`, `votes`). Die Tabelle `suggestions` ist abgelöst (Inhalte wurden zu Tickets). Neue SQL-Dateien muss André im Supabase SQL Editor ausführen. Lesen ist öffentlich, Schreiben nur über RPC-Funktionen, die den Mitglieder-Code serverseitig prüfen (`private.settings`, key `write_code`).
- Name und Code merkt sich der Browser (`localStorage` `adc-me`, dazu `token` für die eigenen Kontaktdaten).
- **Kontaktdaten** (`contacts`): E-Mail und/oder WhatsApp-Nummer, nicht öffentlich lesbar, nur über `get_contacts` mit Code. Ändern/Löschen nur mit dem Browser-Token. Auf den Karten stehen ✉️/💬-Links bei Owner und Mitmachenden. Beim Hovern bzw. Antippen eines Namens erscheinen ✉️/💬-Icons direkt im Namens-Chip. Zuordnung über den vollen Namen, akzent- und großschreibungsunabhängig (André = Andre), sonst über einen eindeutigen Vornamen. Der Login-Dialog verlangt Vor- und Nachnamen.
- **Nächste Schritte online** (`step_edits`): Die neueste Bearbeitung gilt nur, solange `base` gleich dem `x` im Code ist. **Bevor Claude `x` im Code ändert, die neueste Bearbeitung lesen** (öffentlich: `GET /rest/v1/step_edits?ticket=eq.<id>&order=created_at.desc&limit=1` mit Publishable Key von `/api/config`) und in den neuen Text übernehmen, sonst geht sie verloren.
- Verknüpfung über die Ticket-ID (Slug aus `n`). **Wird ein Titel umbenannt, die alte ID als `id:"alter-slug"` am Ticket festhalten**, sonst verlieren Mitmachende und Kommentare ihre Zuordnung.
- **Online-Tickets** (`tickets`): „💡 Neues Ticket“ ersetzt „Idee vorschlagen“. Alle mit Code dürfen anlegen, bearbeiten, löschen (Löschen = `deleted=true`, endgültig nur im Table Editor). Im Board erscheinen sie mit ID `neu-<id>`, Status `idea`, ohne Aufwand, mit Badge „🆕 Neu“ (14 Tage). Für sie gibt es keinen separaten „Nächste Schritte bearbeiten“-Button, das läuft über „Ticket bearbeiten“.
- **Übernahme ins feste Board:** Soll ein Online-Ticket in `D`, dort mit `id:"neu-<id>"` anlegen (sonst verliert es Stimmen, Kommentare, Mitmachende) und das Online-Ticket löschen (André über die Seite oder Table Editor).
- **Upvotes** (`votes`): eine Stimme pro Person (Name) und Ticket, per `toggle_vote` an/aus. Angezeigt wird `v` (Sli.do) + Online-Stimmen; danach wird auch sortiert.
- Moderation (Spam, falsche Einträge löschen) im Supabase Table Editor.
- Mitmachende ohne Code-Owner: Die Karte zeigt dann nicht mehr „Noch offen“, und das Ticket sortiert wie eines mit Owner.

## Datenmodell (in `index.html`, `var D = [...]`)

Jedes Ticket ist ein Objekt:

| Feld | Bedeutung |
|---|---|
| `s` | `"hh"` = Sektionen (linke Spalte), `"jhv"` = Gesamtverein / Präsidium / JHV (rechte Spalte) |
| `sektion` | `"Hamburg"` / `"Berlin"` (optional, für den Sektionsfilter) |
| `e` | Emoji |
| `n` | Titel (aus ihm wird auch die Ticket-ID für Deep-Links `#slug` und Speicher gebildet) |
| `id` | Optional: feste Ticket-ID, wenn der Titel geändert wurde |
| `v` | Stimmen aus der Sli.do-Sammlung (Zahl oder `null`); Online-Stimmen kommen dazu |
| `t` | Themen: `events` (🎤 Events), `members` (👥 Mitglieder: Angebote & Austausch für Mitglieder), `network` (🌍 Partner & Öffentlichkeit: Kooperationen, Nachwuchs, Sponsoren, Stadt), `verein` (🏛️ Verein & Struktur: Satzung, Wahlen, Beiträge, Transparenz, Tools), `jury` (⚖️ Jury/Wettbewerb). Möglichst 1–2 pro Ticket |
| `f` | Aufwand: `easy`, `medium`, `complex` |
| `status` | `idea`, `planned`, `active`, `draft`, `checked`, `doing`, `live`, `done` |
| `prio` | `true` für Prio-Tickets (stehen ganz oben) |
| `owner` | Verantwortliche:r, **immer mit vollem Namen** (für die Kontakt-Zuordnung), mehrere mit ` & `; fehlt er, zeigt die Karte „Noch offen“ und einen Mitmach-Hinweis |
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
- Kompakt (seit 1.10.2026): Fließtext 14–15 px, Ticket-Titel 16 px, H1 max. 44 px, Labels/Pills 12 px als Untergrenze.
- Die Tickets sind einklappbar (Accordion, kein Modal), dazu gibt es „Alle aufklappen“ und pro Ticket „Link zu dieser Idee kopieren“.
- Muss auf dem iPhone funktionieren (kein horizontales Scrollen) und ist als Homescreen-App nutzbar (Manifest, Apple-Meta-Tags, Auto-Reload nach mehr als 2 Minuten im Hintergrund).
- Installations-Hinweis (Modal `#install`): nur beim ersten Besuch, je nach Gerät mit Install-Button (Chrome/Android), Anleitung für iOS/Android oder Lesezeichen-Tipp (Desktop). Status in `localStorage` `adc-install` (`installed`/`done` = nie wieder, `later` = nach 14 Tagen erneut). In der installierten App erscheint er nie.
- `[hidden]` ist global `display:none!important`, weil `.btn` sonst `hidden` überschreibt.
- „Letztes Update“ kommt automatisch aus dem letzten GitHub-Commit.

Feste Links:
- 🧭 ADC Kompass: https://adc-compass.vercel.app/
- 💡 Idee vorschlagen: öffnet das Vorschlagsfeld auf der Seite (Fallback ohne Supabase: https://app.sli.do/event/9tSaEJk3TA4ixbnNpB3LAU/live/polls). Im ausgeklappten Feld steht ein Hinweis mit Link auf die alte Sli.do-Sammlung.
- 💬 WhatsApp Gruppe: https://chat.whatsapp.com/FXO2e2MOiaY0qElp6SQVUc?mode=gi_t
- 📄 Anträge JHV.pdf: https://github.com/andrehennen/adc/raw/main/antraege-jhv.pdf (der relative Pfad funktionierte auf Vercel nicht)
- Footer: „Version x.y · Changelog“ (aufklappbar) und „Erstellt und verantwortlich: André Hennen, Curious Company“

## Changelog & Versionen

- Liste `var CL = [...]` oben im Script, neueste Version zuerst: `["2.2", "1. Okt. 2026", "Kurzbeschreibung"]`.
- Bei jeder für Nutzer:innen sichtbaren Änderung (Funktion, Design, größere Inhaltsrunde) einen Eintrag ergänzen. Mehrere Änderungen am selben Tag dürfen in einen Eintrag.
- Neue Funktion oder größere Überarbeitung: Minor (2.2 → 2.3). Komplett neues Design/Konzept: Major (→ 3.0). Reine Ticket-Updates (Status, Owner, Next Steps) brauchen keinen Eintrag.
- Texte knapp halten, keine unnötigen Zeilen. Anträge (`antrag`, `antragPdf`) und Originalideen (`orig`) bleiben wörtlich.

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
