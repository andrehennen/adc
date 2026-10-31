# ADC Dashboard – Arbeitsregeln für Claude

Dieses Repo ist das **„Dein ADC Dashboard“**: eine Übersicht der Ideen und Initiativen aus der ADC-Ideensammlung (Sli.do), getrennt nach dem, was Sektionen selbst umsetzen können, und dem, was Gesamtverein, Präsidium oder JHV braucht.
Verantwortlich ist André Hennen (CCO/Partner Curious Company, Sektionsvorstand ADC Hamburg). Kommunikation auf Deutsch, direkt, knapp, inhaltlich. André gibt kurze, iterative Anweisungen.

## Hosting & Workflow

- Repo `andrehennen/adc`, Branch `main` → Vercel deployt automatisch nach https://adc-germany-dashboard.vercel.app/ (alte URL adc-hh-dashboard leitet dorthin weiter)
- **Standardregel: Jede Änderung am Dashboard wird committed und gepusht**, ohne nachzufragen. Danach kurz sagen, was sich geändert hat.
- Der Kompass ist ein separates Repo: `andrehennen/adc-compass` → https://adc-compass.vercel.app/
- **Niemals** Tokens oder Zugangsdaten in `index.html`, `data.js` oder `app.js` schreiben (GitHub Secret Scanning blockt das, und die Seite ist öffentlich). Einzige Ausnahme: der Supabase **Publishable/anon Key** (`SB_KEY`), der ist dafür gemacht. Den `service_role`/Secret Key und den Mitglieder-Code nie ins Repo.

## Grundsätze (wichtig, hart erarbeitet)

- **Sprache auf der Seite: „Ideen“, nie „Tickets“** (klingt weniger nach Arbeit). Intern im Code und in dieser Datei heißen sie weiter Tickets.

- **Das Dashboard ist die Single Source of Truth.** Trello wird nicht mehr genutzt.
- **Ticket-Inhalte** (Status, Owner, Leitlinien, Anträge) ändert nur Claude im Code, auf Andrés Anweisung. Ausnahme: **Nächste Schritte** können Mitglieder online bearbeiten (siehe Speicher).
- **Speicherfunktion (seit 1.10.2026, Supabase):** Mitglieder können online Tickets anlegen/bearbeiten/löschen, Tickets hochvoten, sich als „Mach mit“ eintragen, Kontaktdaten hinterlegen, Nächste Schritte bearbeiten und kommentieren. Siehe Abschnitt „Speicher (Supabase)“.
- Vor jeder Änderung logisch und auf UX prüfen. Bei Unklarheit **erst fragen**, dann bauen. Offene Fragen immer im Chat als klickbare Auswahl stellen (AskUserQuestion), nicht als Fließtext.
- **Modellwahl:** Vor dem Start komplexerer Aufgaben prüfen, welches Modell am besten passt (z. B. Opus für Architektur, große Umbauten, knifflige Fehler; Sonnet für Routine-Änderungen; Haiku für Kleinkram). Läuft es schon, weitermachen. Wenn nicht, stoppen und den Wechsel vorschlagen (klickbar im Chat).
- Nach jeder Änderung prüfen, ob `var D = [...]` in `data.js` noch parst (z. B. mit Node per Regex extrahieren und `eval`) und ob die Seite ohne JS-Fehler rendert.
- Beim Entfernen von Tickets auf verwaiste Kommas achten (`,\s*,`).
- **Leitlinien** (`rahmen`) sind getroffene Entscheidungen und Ziele, keine nächsten Schritte.
- Anträge nicht zusammenlegen, wenn André es nicht ausdrücklich sagt.

## Speicher (Supabase)

- Supabase-Projekt `uuqeoefgwqsyvysfyood`, über die Supabase-Vercel-Integration verbunden. Die Seite holt URL und Publishable Key zur Laufzeit von `/api/config` (`api/config.js`, liest die Vercel-Env, gibt nie den Secret Key aus). `SB_URL`/`SB_KEY` oben in `app.js` bleiben leer (nur für lokale Tests). Ist der Speicher nicht erreichbar, fällt die Seite auf Sli.do/WhatsApp zurück.
- Schema: `supabase/schema.sql` (Tabellen `helpers`, `comments`, `suggestions`) `supabase/002_kontakte_naechste_schritte.sql` (`contacts`, `step_edits`) und `supabase/003_tickets_votes.sql` (`tickets`, `votes`), `004_tag_verein.sql` und `005_haertung.sql` (Längen-/Formatgrenzen). `009_schreibrechte.sql` entzieht den öffentlichen Rollen alle Schreibrechte auf die Tabellen; **neue Tabellen bekommen für `anon` nur `select`**. Die Tabelle `suggestions` ist abgelöst (Inhalte wurden zu Tickets). Neue SQL-Dateien muss André im Supabase SQL Editor ausführen. Lesen ist öffentlich, Schreiben nur über RPC-Funktionen, die den Mitglieder-Code serverseitig prüfen (`private.settings`, key `write_code`).
- Name und Code merkt sich der Browser (`localStorage` `adc-me`, dazu `token` für die eigenen Kontaktdaten).
- **Kontaktdaten** (`contacts`): E-Mail und/oder WhatsApp-Nummer, nicht öffentlich lesbar, nur über `get_contacts` mit Code. Ändern/Löschen nur mit dem Browser-Token. Auf den Karten stehen ✉️/💬-Links bei Owner und Mitmachenden. Beim Hovern bzw. Antippen eines Namens erscheinen ✉️/💬-Icons direkt im Namens-Chip. Zuordnung über den vollen Namen, akzent- und großschreibungsunabhängig (André = Andre), sonst über einen eindeutigen Vornamen. Der Login-Dialog verlangt Vor- und Nachnamen.
- **Nächste Schritte online** (`step_edits`): Die neueste Bearbeitung gilt nur, solange `base` gleich dem `x` im Code ist. **Bevor Claude `x` im Code ändert, die neueste Bearbeitung lesen** (öffentlich: `GET /rest/v1/step_edits?ticket=eq.<id>&order=created_at.desc&limit=1` mit Publishable Key von `/api/config`) und in den neuen Text übernehmen, sonst geht sie verloren.
- **Abhaken** (seit 2.26): Jeder Nächste Schritt hat bei festen Ideen eine Checkbox. Abhaken speichert über `set_next_steps` einen neuen Text, in dem die Zeile `✓ Schritt (erledigt: Name, TT.MM.JJJJ)` heißt; die Karte zeigt sie dann unter „Bisher passiert“ (Haken entfernen macht sie wieder offen). Keine eigene Tabelle. **Ändert Claude `x`, erledigte `✓`-Zeilen aus der neuesten Bearbeitung als Eintrag in `bisher` übernehmen** und nur die offenen Schritte in `x` lassen. `✓`-Zeilen dürfen auch direkt in `x` stehen.
- Verknüpfung über die Ticket-ID (Slug aus `n`). **Wird ein Titel umbenannt, die alte ID als `id:"alter-slug"` am Ticket festhalten**, sonst verlieren Mitmachende und Kommentare ihre Zuordnung.
- **Online-Tickets** (`tickets`): „💡 Neues Ticket“ ersetzt „Idee vorschlagen“. Alle mit Code dürfen anlegen, bearbeiten, löschen (Löschen = `deleted=true`, endgültig nur im Table Editor). Mit „Anonym einreichen“ wird `created_by = 'Anonym'` gespeichert und nur der Code abgefragt, kein Name. Im Board erscheinen sie mit ID `neu-<id>`, Status `idea`, ohne Aufwand, mit Badge „🆕 Neu“ (14 Tage). Für sie gibt es keinen separaten „Nächste Schritte bearbeiten“-Button, das läuft über „Ticket bearbeiten“.
- **Übernahme ins feste Board:** Soll ein Online-Ticket in `D`, dort mit `id:"neu-<id>"` anlegen (sonst verliert es Stimmen, Kommentare, Mitmachende) und das Online-Ticket löschen (André über die Seite oder Table Editor).
- **Löschen & Papierkorb** (`006_papierkorb.sql`): Online-Ideen und Kommentare können alle mit Code löschen (`deleted=true`, `deleted_by`, `deleted_at`). Der Papierkorb im Footer neben dem Changelog (`get_trash`, nur mit Code lesbar) zeigt Gelöschtes 30 Tage und stellt es wieder her (`restore_ticket`, `restore_comment`); danach wird endgültig gelöscht (`private.purge_trash`). Feste Ideen aus `D` lassen sich online nicht löschen. Gelöschte Kommentare werden seit `008_papierkorb_privat.sql` physisch nach `private.deleted_comments` verschoben (die Leseregel `NOT deleted` griff bei `comments` aus ungeklärtem Grund nicht); die Seite filtert `deleted` zusätzlich selbst. **Nach jeder Änderung an Leseregeln live mit einem echten gelöschten Eintrag prüfen**, nicht nur mit leerem Ergebnis.
- **Upvotes** (`votes`): eine Stimme pro Person (Name) und Ticket, per `toggle_vote` an/aus. Angezeigt wird `v` (Sli.do) + Online-Stimmen; danach wird auch sortiert.
- Moderation (Spam, falsche Einträge löschen) im Supabase Table Editor.
- **Backup:** Das private Repo `andrehennen/adc-intern` sichert die Daten täglich per GitHub Actions (Branch `backups`, letzte 35 Tage, JSON pro Tag). Dort liegen auch Claudes vertrauliche Notizen (`notizen/`). **Kommt eine neue Tabelle dazu, sie in `adc-intern/scripts/backup.py` ergänzen.**
- Mitmachende ohne Code-Owner: Die Karte zeigt dann nicht mehr „Noch offen“, und das Ticket sortiert wie eines mit Owner.

## Sicherheit & Zuverlässigkeit (QA vom 3.10.2026)

- **Alles, was aus der Datenbank kommt, mit `esc()` ausgeben** (auch Emoji, Namen, Sektion). Links nur über `linkify(esc(...))`.
- `vercel.json` setzt Schutz-Header inkl. Content-Security-Policy und `noindex`. **Die CSP erlaubt keine Inline-Scripts** (seit 13.10.2026): kein `<script>…</script>` im HTML, keine `onclick`-Attribute, auch nicht in per JS erzeugtem HTML. Logik gehört in `app.js`. **Neue externe Quellen (Scripts, Fonts, APIs) müssen dort in die CSP**, sonst blockt der Browser sie. Scripts möglichst lokal ablegen (`vendor/`), nicht vom CDN.
- `.vercelignore` hält `CLAUDE.md` und `supabase/` aus dem Deployment. Das Repo selbst ist öffentlich: **nichts Vertrauliches in diese Datei oder ins Repo schreiben** (interne Einschätzungen, offene Entscheidungen), das gehört in Claudes privaten Projektspeicher.
- `render()` behält ungespeicherte Kommentar-Entwürfe und offene „Nächste Schritte“-Bearbeitungen (`keepDrafts`). Nach erfolgreichem Speichern das Feld leeren bzw. das Formular entfernen, **bevor** `load()` läuft.
- Kein Auto-Reload, solange etwas Ungespeichertes offen ist (`unsaved()`).
- Speichern-Buttons während des Requests deaktivieren (Doppelklick).
- Der Zugang ist bewusst einfach gehalten (ein gemeinsamer Code, kein Login). Einfachheit geht vor.

## Qualitätsprüfung (seit 13.10.2026)

- Tests liegen in `tools/qa/` (Playwright, axe-core, html-validate), Ablauf und letzter Stand in `QA.md`. Beides wird nicht deployt.
- **Nach Änderungen an Markup, CSS oder Logik `npm run alles` in `tools/qa` laufen lassen**, nach dem Deploy `npm run live`. Ziel: 0 Befunde.
- Die Tests schreiben nie in die echte Datenbank (`e2e.mjs` baut den Speicher nach). Kommt eine neue Funktion dazu, dort einen Ablauf ergänzen.
- `/fonts/` und `/vendor/` werden ein Jahr gecacht (`vercel.json`). **Wird eine Datei dort ersetzt, Dateinamen oder `?v=` ändern.**
- `/.well-known/security.txt` läuft am 13.10.2027 ab, dann Datum erneuern.

## Datenmodell (in `data.js`, `var D = [...]`)

Seit 13.10.2026 liegen die Inhalte (`D`, `CL`) in `data.js` und die Logik in `app.js`; `index.html` enthält nur noch Markup und CSS.

Jedes Ticket ist ein Objekt:

| Feld | Bedeutung |
|---|---|
| `s` | `"hh"` = Sektionen (linke Spalte), `"jhv"` = Gesamtverein / Präsidium / JHV (rechte Spalte) |
| `sektion` | `"Hamburg"` / `"Berlin"` / `"Berlin & Hamburg"` (optional, für den Sektionsfilter; mit ` & ` erscheint das Ticket in beiden) |
| `e` | Emoji |
| `n` | Titel (aus ihm wird auch die Ticket-ID für Deep-Links `#slug` und Speicher gebildet) |
| `id` | Optional: feste Ticket-ID, wenn der Titel geändert wurde |
| `v` | Stimmen aus der Sli.do-Sammlung (Zahl oder `null`); Online-Stimmen kommen dazu |
| `t` | Themen: `events` (🎤 Events), `members` (👥 Mitglieder: Angebote & Austausch für Mitglieder), `network` (🌍 Partner & Öffentlichkeit: Kooperationen, Nachwuchs, Sponsoren, Stadt), `verein` (🏛️ Verein & Struktur: Satzung, Wahlen, Beiträge, Transparenz, Tools), `jury` (⚖️ Jury/Wettbewerb). Möglichst 1–2 pro Ticket. **Auf der Seite** (Filter, Karten, Formular) erscheinen sie seit 2.30 nur als drei Gruppen (`TG` in `app.js`): 🏠 Intern = `events`/`members`/`verein`, 🌍 Extern = `network`, ⚖️ Jury = `jury` |
| `f` | Aufwand: `easy`, `medium`, `complex` |
| `status` | `idea`, `planned`, `active`, `done` (seit 2.30; alte Werte `draft`/`checked`/`doing`/`live` bildet `SA` in `app.js` noch ab) |
| `prio` | `true` für Prio-Tickets (stehen ganz oben) |
| `owner` | Verantwortliche:r, **immer mit vollem Namen** (für die Kontakt-Zuordnung), mehrere mit ` & `; fehlt er, zeigt die Karte „Noch offen“ und einen Mitmach-Hinweis |
| `x` | Nächste Schritte (`1. … 2. …` oder mit `;` getrennt, wird zu Bullets) |
| `bisher` | Bisher passiert, mit ` \| ` getrennt |
| `rahmen` | Leitlinien, mit ` \| ` getrennt |
| `antrag` | JHV-Antragstext (im Dashboard mit Kopierbutton) |
| `orig` | Originalidee(n) aus der Sammlung, wörtlich |

Status-Labels: 💡 Idee · 📋 Geplant · ⚡ Läuft · ✅ Erledigt

Sortierung: zuerst Prio, dann Status (done > active > planned > idea), dann Stimmen, dann „hat Owner“.
In jeder Spalte gibt es zwei Gruppen: „🚀 Läuft schon“ (alles außer `idea`) und „💡 Ideen – suchen Mitstreiter:innen“.

## Design (seit Okt. 2026)

- Hell, orientiert an adc.de: weißer Hintergrund, schwarze Typo, Inter (lokal in `fonts/`, nicht von Google), große fette Headlines, ADC-Logo schwarz (als base64 eingebettet).
- Kompakt (seit 1.10.2026): Fließtext 14–15 px, Ticket-Titel 16 px, H1 max. 44 px, Labels/Pills 12 px als Untergrenze.
- Die Tickets sind einklappbar (Accordion, kein Modal), dazu gibt es „Alle aufklappen“ und pro Ticket „Link zu dieser Idee kopieren“.
- Muss auf dem iPhone funktionieren (kein horizontales Scrollen) und ist als Homescreen-App nutzbar (Manifest, Apple-Meta-Tags, Auto-Reload nach mehr als 2 Minuten im Hintergrund).
- Header rechts: Profil-Symbol (`#profile-btn`, SVG-Person, Kontaktdaten, nur mit Speicher) und „?“. „💬 WhatsApp-Gruppe“ steht nur noch im Footer und in der Hilfe. „Für mich“ ist der erste Chip in der Filterzeile (`.fb.mine`, ohne `data-t`; der Filter-Handler reagiert nur auf `.fb[data-t]`); der Zustand bleibt pro Browser gespeichert, `localStorage` `adc-mine`, gilt erst, wenn der Speicher läuft).
- Hilfe-Button „?“ im Header öffnet das Modal `#help` mit den wichtigsten Funktionen. **Bei neuen Funktionen dort mitpflegen.** Es wächst animiert aus dem „?“ und schrumpft beim Schließen dorthin zurück. Seit 2.29 gilt das für alle großen Fenster: Hilfe, Kontaktdaten (`#profile`) und „Neue Idee“/„Idee bearbeiten“ (`#suggest`) sind `<dialog>`s mit `dlgAnim(d)` → `open(ursprungsKnopf)`/`close()`; alle Schließwege inkl. Escape laufen über `close()`. Kontaktdaten schließen sich nach dem Speichern von selbst. Beim ersten Besuch öffnet es sich automatisch als Tutorial (`localStorage` `adc-help` = `seen`).
- Installations-Hinweis (Modal `#install`): ab dem zweiten Besuch (beim ersten läuft das Tutorial), je nach Gerät mit Install-Button (Chrome/Android), Anleitung für iOS/Android oder Lesezeichen-Tipp (Desktop). Status in `localStorage` `adc-install` (`installed`/`done` = nie wieder, `later` = nach 14 Tagen erneut). In der installierten App erscheint er nie.
- Bewegung (seit 2.14/2.15): Akkordeon per JS (`setOpen`, Web Animations auf Höhe, Inhalt in `.cbody > .cin > .cpad`), Filter per FLIP (`flipRender`), weiches Scrollen mit Lenis (lokal in `vendor/lenis.min.js`, Version 1.3.26, MIT; eigene Scrollbereiche mit `data-lenis-prevent`, Scrollen per `scrollToEl`/`scrollByY`, nie direkt `scrollIntoView`). Tasten skalieren beim Drücken, Dialoge/Panels blenden ein, Header mit Milchglas. `prefers-reduced-motion` schaltet alles ab. Animationen haben Timeout-Fallbacks, falls der Browser sie nicht abspielt.
- Kommentare: In der offenen Karte steht nur „💬 Kommentieren“ (`[data-cwrite]`), das Feld klappt erst auf Klick auf.
- Karten aufgeklappt: Namen stehen nur unter „Wer kümmert sich“ (die Zeile unter dem Titel blendet Owner/Mitmachende aus, Klasse `.mo`). Aufwand und Themen als eine Zeile (`.facts`), Originalidee eingeklappt (`<details class="orig">`). Der Hinweis „keine Kontaktdaten“ erscheint nur, wenn die angemeldete Person selbst Owner/Mitmachende:r ist und keine Daten hinterlegt hat.
- `[hidden]` ist global `display:none!important`, weil `.btn` sonst `hidden` überschreibt.
- „Letztes Update“ steht im Kopf von „Zuletzt passiert“ und kommt automatisch aus dem letzten GitHub-Commit, über `/api/updated` (serverseitig, damit Besucher:innen nicht direkt mit GitHub verbunden werden).
- Externe Verbindungen der Seite: nur Supabase. Schrift, Scripts und GitHub-Abfrage laufen über die eigene Domain. So lassen.
- `/api/keepalive` wird täglich per Vercel Cron aufgerufen (`vercel.json`) und hält das Supabase-Projekt im Gratis-Tarif aktiv.

Feste Links:
- 🧭 ADC Kompass: https://adc-compass.vercel.app/
- 💡 Idee vorschlagen: öffnet das Vorschlagsfeld auf der Seite (Fallback ohne Supabase: https://app.sli.do/event/9tSaEJk3TA4ixbnNpB3LAU/live/polls). Im ausgeklappten Feld steht ein Hinweis mit Link auf die alte Sli.do-Sammlung.
- 💬 WhatsApp Gruppe (Footer, Hilfe): https://chat.whatsapp.com/FXO2e2MOiaY0qElp6SQVUc?mode=gi_t
- Footer: „Version x.y · Changelog“ (aufklappbar) und „Entwickelt von André Hennen, Curious Company“ (verlinkt auf https://curiouscompany.de); darunter Links zu `/impressum` und `/datenschutz`
- **Impressum & Datenschutz** (`impressum.html`, `datenschutz.html`, eigenständige Seiten, über `cleanUrls` ohne `.html` erreichbar). Anbieter ist der ADC e. V. (Angaben von adc.de), Ansprechpartner André (andre.hennen@adc.de). **Ändert sich, was gespeichert wird oder wohin die Seite Daten schickt (neuer Dienst, neues Feld), die Datenschutzseite mit anpassen.**

## Jury Map (`/jury`, seit 16.10.2026)

- „Hamburg ADC Jury Map“: Orte für die dezentralen Jurys 2027 in Hamburg. Eigene Seite `jury.html` + `jury.js`. **Seit 17.10.2026 nicht mehr im Dashboard verlinkt** (Button und Hilfe-Eintrag entfernt, auf Andrés Wunsch), nur direkt über `/jury` erreichbar. Zum Wiedereinbauen: Button „🗺️ Jury Map“ im Kopf neben dem Kompass, Eintrag in der Hilfe unter „Orientierung“.
- **Karte selbst gehostet, kein Google:** MapLibre (`vendor/maplibre-gl-csp-*.js`, CSP-Build mit eigenem Worker) + PMTiles (`vendor/pmtiles-*.js`). Kartendaten OpenStreetMap/Protomaps als eine Datei `map/hamburg-<stand>.pmtiles` (nur Zentrum Hamburg, Zoom bis 14), Stil `map/style-<stand>.json`, Schriften/Symbole in `map/fonts`, `map/sprites`. Stil neu bauen und Karte aktualisieren: siehe Kopf von `tools/map/build_style.mjs`; danach `MAP_STAND` in `jury.js` anpassen (neuer Dateiname, weil `/map/` ein Jahr gecacht wird).
- Routen nur als Links (Google Maps, Apple Karten), nichts eingebettet. Adresssuche über `/api/geocode` (serverseitig Nominatim, nur Hamburg, nur per Button).
- Speicher: Tabelle `jury_locations` (`supabase/010_jury_map.sql`), Schreiben per `save_jury_location`/`delete_jury_location` mit Mitglieder-Code. Löschen blendet nur aus (`deleted`), Wiederherstellen im Table Editor. Alle mit Code dürfen alle Orte bearbeiten, auch „Zugeordnete Jury“.
- **Abend-Treffpunkt:** Konstante `TREFF` oben in `jury.js` (Name, Adresse, lat/lng, Info). Solange `null`, zeigt die Seite „steht noch nicht fest“.
- **Demo-Orte:** `DEMO` oben in `jury.js` (3 Beispiele, IDs negativ, nicht bearbeitbar, Badge „Demo-Eintrag“). Entfernen mit `DEMO = []`, sobald echte Orte da sind.
- „Ort anbieten“ versucht den Speicher neu zu laden, falls er beim Seitenaufruf nicht erreichbar war.
- **Aufbau (seit 16.10.2026):** App-Layout ohne Seiten-Scroll. Karte links (Handy: oben), Seitenleiste rechts (Handy: unten) mit eigenem Scrollbereich. Formular „Ort anbieten“ öffnet in der Seitenleiste, die Karte bleibt sichtbar zum Pin-Setzen. Infotexte stecken eingeklappt unter „Wie läuft das ab?“.
- Pins zeigen „Jury 2: Film“, ohne Jury „Ort 2“ (`pinLabel`).
- Fußwege sind grob geschätzt (Luftlinie × 1,3 bei 5 km/h).

## Zuletzt passiert (`UP` in `data.js`)

- Unter den Filtern zeigt „🆕 Zuletzt passiert“ die drei neuesten **inhaltlichen** Updates. Quellen: die Liste `var UP = [...]` (`{d:"JJJJ-MM-TT", id:"ticket-id", k:"Kurztitel", t:"Ein kurzer Satz ohne Punkt"}`; jeder Eintrag ist eine Zeile, auf dem Handy wird abgeschnitten, also kurz halten), neue Online-Ideen und online abgehakte Schritte (automatisch).
- **Bei jeder inhaltlichen Änderung an einer Idee (Status, Termin, Beschluss, neue Idee im Board) einen `UP`-Eintrag ergänzen**, neueste zuerst, höchstens 5 behalten. Keine Software-/Plattform-Updates, die gehören in den Changelog. Die `id` muss eine bestehende Ticket-ID sein (Slug, max. 60 Zeichen), sonst wird der Eintrag nicht angezeigt.

## Changelog & Versionen

- Liste `var CL = [...]` in `data.js`, neueste Version zuerst: `["2.2", "1. Okt. 2026", "Kurzbeschreibung"]`.
- Bei jeder für Nutzer:innen sichtbaren Änderung (Funktion, Design, größere Inhaltsrunde) einen Eintrag ergänzen. Mehrere Änderungen am selben Tag dürfen in einen Eintrag.
- Neue Funktion oder größere Überarbeitung: Minor (2.2 → 2.3). Komplett neues Design/Konzept: Major (→ 3.0). Reine Ticket-Updates (Status, Owner, Next Steps) brauchen keinen Eintrag.
- Texte knapp halten, keine unnötigen Zeilen. Anträge (`antrag`) und Originalideen (`orig`) bleiben wörtlich.

## JHV-Anträge

- Antragsteller-Formulierung für neue Anträge: **„André Hennen, stellvertretend für die Ideen aus der Sektion Hamburg, beantragt …“**
- JHV 15.10.2026: Die Satzungsänderungen „Abstimmungen vereinfachen“ (§ 6.5) und „Alle Wahlen digital“ (§ 7.2, § 7.5.2) wurden angenommen, im Wortlaut von Rechtsanwalt Oliver Brexl. Im Feld `antrag` steht jeweils der beschlossene Text.
- Das PDF `antraege-jhv.pdf` und der Button dazu wurden danach entfernt.
