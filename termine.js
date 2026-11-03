// Nächste Termine (oben im Dashboard und als Kalenderdatei über /api/termin).
// Neueste Termine einfach ergänzen, die Reihenfolge ist egal (sortiert wird nach Datum).
// Vergangene Termine verschwinden von selbst. Alte Einträge dürfen stehen bleiben, besser aber nach einiger Zeit löschen.
// Felder: id (eindeutig, fürs Kalender-Abo), d ("JJJJ-MM-TT"), bis_d (optional, letzter Tag bei mehrtägigen Terminen),
// von/bis ("HH:MM", optional; ohne von = ganztägig), n (Titel, auch im Kalender), k (optional, kurzer Titel für die Seite), ort, url (Infos/Tickets), sektion (optional), info (optional, kurz)
var TE = [
  {id:"creative-club-hamburg-2026", d:"2026-11-03", von:"16:00", n:"ADC Creative Club Hamburg", k:"Creative Club Hamburg", ort:"Design Zentrum Hamburg", sektion:"Hamburg", url:"https://www.adc.de/events/creative-club-hamburg-2026/", info:"Einlass und Mappencheck ab 16 Uhr, Bühne ab 18 Uhr, danach Get-together"},
  {id:"creative-club-muenchen-2026", d:"2026-11-12", von:"16:00", bis:"22:00", n:"ADC Creative Club München", k:"Creative Club München", ort:"ZIRKA, München", url:"https://www.adc.de/events/creative-club-muenchen-2026/", info:"Mappencheck ab 16:30 Uhr, Präsentationen ab 18 Uhr"},
  {id:"kombi-treffen-digital-hamburg-2026", d:"2026-12-17", von:"19:00", bis:"22:00", n:"ADC Kombi-Treffen: Fachbereich Digital & Sektion Hamburg", k:"Kombi-Treffen Digital & Hamburg", ort:"Curious Company, Völckersstraße 14–20, Hamburg", sektion:"Hamburg", info:"Erstes gemeinsames Treffen von Fachbereich Digital und Sektion Hamburg: Glühwein, News aus dem Präsidium, zwei Bewerber:innen. Umfrage, wer kommt, folgt in der WhatsApp-Gruppe"},
  {id:"adc-digital-conference-2026", d:"2026-11-30", n:"ADC Digital Conference 2026", k:"Digital Conference", ort:"Kunstpalast Düsseldorf", url:"https://www.adc.de/events/adc-digital-conference-2026/"}
];
if (typeof module !== 'undefined') module.exports = TE;
