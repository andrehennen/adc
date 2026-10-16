// Adresssuche für die Jury Map. Läuft serverseitig über Nominatim (OpenStreetMap),
// damit Besucher:innen nicht direkt mit Dritten verbunden werden. Nur Hamburg, max. 5 Treffer.
// Nominatim-Regeln: eigener User-Agent, keine Suche bei jedem Tastendruck (die Seite sucht nur per Button).
module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  var q = String((req.query && req.query.q) || '').trim().slice(0, 160);
  if (q.length < 3) { res.statusCode = 400; return res.end('[]'); }
  try {
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=de&bounded=1'
      + '&viewbox=9.6,53.8,10.4,53.3&accept-language=de&addressdetails=0&q=' + encodeURIComponent(q);
    var r = await fetch(url, { headers: { 'User-Agent': 'adc-jury-map/1.0 (https://adc-germany-dashboard.vercel.app; andre.hennen@adc.de)' } });
    var list = r.ok ? await r.json() : [];
    var out = (Array.isArray(list) ? list : []).map(function (x) {
      return { name: String(x.display_name || '').split(', ').slice(0, 4).join(', '), lat: +x.lat, lng: +x.lon };
    }).filter(function (x) { return x.lat > 53.3 && x.lat < 53.8 && x.lng > 9.6 && x.lng < 10.4; });
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 502;
    res.end('[]');
  }
};
