# QA – ADC Dashboard

Projektnotiz zur Qualitätsprüfung (Skill „website-endboss“). Letzter vollständiger Lauf: 13.10.2026.

## Bestandsaufnahme

- **Art:** Webapp für ADC-Mitglieder (Ideen und Initiativen ansehen, mitmachen, kommentieren). Bewusst nicht für Suchmaschinen (`noindex`).
- **Technik:** statische Seiten ohne Build (`index.html` mit `data.js` und `app.js`, `impressum.html`, `datenschutz.html`, `404.html`), drei Vercel-Funktionen in `api/`, Daten in Supabase. Deploy: Push auf `main` → Vercel. Kein Staging.
- **Inhalte:** Ideen, Anträge und Originalideen gehören André bzw. den Mitgliedern. Claude ändert sie nur auf Anweisung; Rechtschreibung nur nach Freigabe.
- **Vorgaben:** Design nach adc.de, muss auf dem iPhone funktionieren, Impressum und Datenschutz vorhanden, keine Cookies.

## Prüfen

```
cd tools/qa
npm run setup      # einmalig: Pakete und Browser
npm run alles      # HTML, Barrierefreiheit, Geräte, Abläufe – gegen den lokalen Stand
npm run live       # Barrierefreiheit und Geräte gegen die Live-Seite
npm run tempo      # Ladezeit der Live-Seite
```

- Die Tests laden den lokalen Stand unter der echten Adresse, mit den Headern aus `vercel.json` (CSP greift wie live).
- `e2e.mjs` baut den Speicher nach. Es wird nie in die echte Datenbank geschrieben.
- Geräte: WebKit 320/375/390/1024/1280, Chromium 412/768/1440, Firefox 1440.

## Stand 13.10.2026

| Bereich | Ergebnis |
|---|---|
| HTML-Validierung | 15 → 0 Fehler |
| Barrierefreiheit (axe, WCAG 2.2 AA, alle Seiten und Zustände) | 19 → 0 Befunde |
| Geräte (9 Kombinationen, alle Zustände) | Querscrollen bei 320 px behoben, sonst ohne Befund |
| Abläufe (56 Prüfungen, nachgebauter Speicher) | 56 von 56 |
| Ladezeit Startseite (Handy-Profil, Labor) | LCP ca. 0,5 s, CLS 0,01, 104 kB, keine Cookies |
| Externe Links | alle erreichbar |

## Nachtrag 16.10.2026 (Jury Map)

- `/jury` ist in HTML-Prüfung, axe, Geräten und Abläufen enthalten (7 neue Prüfungen, 71 von 71). `lib.mjs` beantwortet jetzt Teilabrufe (Range), die die Karte braucht.
- Gegen den lokalen Stand meldet `devices.mjs` auf `/jury` HTTP 404 für `jury_locations`, bis `supabase/010_jury_map.sql` ausgeführt ist. Sonst ohne Befund.

## Entfällt

- SEO/GEO, Sitemap, strukturierte Daten, Search Console: Die Seite ist absichtlich nicht auffindbar.
- Mehrsprachigkeit, Dark Mode, Druckansicht, Bilder-Optimierung (es gibt nur das Logo).

## Nur von Hand prüfbar

- Installation auf dem Homescreen (iOS/Android) und der Name unter dem Icon.
- Screenreader-Durchgang (VoiceOver), Schriftgröße/Zoom auf dem echten Gerät.
- PageSpeed Insights: https://pagespeed.web.dev/ mit der Live-Adresse.

## Wiederkehrend

- Vor jedem größeren Umbau und danach: `npm run alles`, nach dem Deploy `npm run live`.
- Einmal im Quartal: Links, Header (`curl -I`), Browser-Tests mit aktuellen Versionen, `security.txt` läuft am 13.10.2027 ab.
