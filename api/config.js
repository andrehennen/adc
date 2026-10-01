// Liefert die ÖFFENTLICHE Supabase-Konfiguration aus den Vercel-Umgebungsvariablen
// (gesetzt durch die Supabase-Vercel-Integration). Niemals den Secret/service_role Key ausgeben.
function isPublicKey(k) {
  if (!k) return false;
  if (k.indexOf('sb_secret_') === 0) return false;
  if (k.indexOf('sb_publishable_') === 0) return true;
  try {
    var payload = JSON.parse(Buffer.from(k.split('.')[1], 'base64').toString());
    return payload.role === 'anon';
  } catch (e) { return false; }
}

module.exports = function (req, res) {
  var env = process.env;
  var url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  var key = [env.SUPABASE_PUBLISHABLE_KEY, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
             env.SUPABASE_ANON_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY].filter(isPublicKey)[0] || '';
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(url && key ? { url: url, key: key } : {}));
};
