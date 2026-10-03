// Wird täglich per Vercel Cron aufgerufen (siehe vercel.json). Ein kleiner Lesezugriff hält das
// Supabase-Projekt im Gratis-Tarif aktiv (es pausiert sonst nach etwa einer Woche ohne Zugriffe).
module.exports = async function (req, res) {
  var env = process.env;
  var url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  var key = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
            env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (!url || !key) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: 'not configured' })); }
  try {
    var r = await fetch(url + '/rest/v1/tickets?select=id&limit=1', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    res.statusCode = r.ok ? 200 : 502;
    res.end(JSON.stringify({ ok: r.ok, status: r.status, at: new Date().toISOString() }));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ ok: false, error: 'unreachable' }));
  }
};
