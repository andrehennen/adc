// Liefert das Datum des letzten Commits. Läuft serverseitig, damit Besucher:innen
// nicht direkt mit GitHub verbunden werden (Datenschutz).
module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  try {
    var r = await fetch('https://api.github.com/repos/andrehennen/adc/commits?per_page=1', { headers: { 'User-Agent': 'adc-dashboard' } });
    var c = r.ok ? await r.json() : null;
    var date = c && c[0] && c[0].commit && c[0].commit.committer.date;
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
    res.end(JSON.stringify(date ? { date: date } : {}));
  } catch (e) {
    res.end('{}');
  }
};
