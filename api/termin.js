// Kalenderdatei (.ics) für die Nächsten Termine aus termine.js.
// /api/termin?id=<id> → ein Termin (Button „In Kalender“), /api/termin → alle kommenden Termine (Kalender-Abo per webcal://).
var TE = require('../termine.js');

var TZ = 'Europe/Berlin';
// Ortszeit Berlin → UTC (berücksichtigt Sommer-/Winterzeit)
function berlinToUtc(d, hm) {
  var p = d.split('-').map(Number), t = hm.split(':').map(Number);
  var guess = Date.UTC(p[0], p[1] - 1, p[2], t[0], t[1]);
  var f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  var o = {}; f.formatToParts(new Date(guess)).forEach(function (x) { o[x.type] = x.value; });
  var asLocal = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute);
  return new Date(guess - (asLocal - guess));
}
function stamp(dt) { return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function dateOnly(d, plusDays) {
  var p = d.split('-').map(Number), x = new Date(Date.UTC(p[0], p[1] - 1, p[2] + (plusDays || 0)));
  return x.toISOString().slice(0, 10).replace(/-/g, '');
}
function esc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
// Zeilen über 75 Byte falten (RFC 5545)
function fold(line) {
  var out = [], cur = '', n = 0;
  for (var ch of line) {
    var b = Buffer.byteLength(ch);
    if (n + b > 73) { out.push(cur); cur = ' '; n = 1; }
    cur += ch; n += b;
  }
  out.push(cur);
  return out.join('\r\n');
}
function vevent(e, now) {
  var l = ['BEGIN:VEVENT', 'UID:' + e.id + '@adc-germany-dashboard', 'DTSTAMP:' + stamp(now)];
  if (e.von) {
    var start = berlinToUtc(e.d, e.von);
    var end = e.bis ? berlinToUtc(e.bis_d || e.d, e.bis) : new Date(start.getTime() + 6 * 3600e3);
    l.push('DTSTART:' + stamp(start), 'DTEND:' + stamp(end));
  } else {
    l.push('DTSTART;VALUE=DATE:' + dateOnly(e.d), 'DTEND;VALUE=DATE:' + dateOnly(e.bis_d || e.d, 1));
  }
  l.push('SUMMARY:' + esc(e.n));
  if (e.ort) l.push('LOCATION:' + esc(e.ort));
  l.push('DESCRIPTION:' + esc([e.info, e.url ? 'Infos und Tickets: ' + e.url : ''].filter(Boolean).join('\n')));
  if (e.url) l.push('URL:' + e.url);
  l.push('END:VEVENT');
  return l;
}

module.exports = function (req, res) {
  var id = String((req.query && req.query.id) || '').slice(0, 80);
  var today = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  var list = id ? TE.filter(function (e) { return e.id === id; })
                : TE.filter(function (e) { return (e.bis_d || e.d) >= today; });
  if (id && !list.length) { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end('Termin nicht gefunden'); }
  var now = new Date();
  var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ADC Dashboard//Termine//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:ADC Termine', 'X-WR-TIMEZONE:' + TZ];
  list.forEach(function (e) { lines = lines.concat(vevent(e, now)); });
  lines.push('END:VCALENDAR');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="' + (id || 'adc-termine') + '.ics"');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.end(lines.map(fold).join('\r\n') + '\r\n');
};
