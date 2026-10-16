// Gemeinsame Helfer: lokaler Stand unter der echten Adresse, mit den Headern aus vercel.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ORIGIN = 'https://adc-germany-dashboard.vercel.app';
export const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.woff2': 'font/woff2',
  '.png': 'image/png', '.ico': 'image/vnd.microsoft.icon', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8', '.pbf': 'application/x-protobuf', '.pmtiles': 'application/octet-stream' };
const IGNORED = ['CLAUDE.md', 'supabase', 'tools'];

function vercelHeaders() {
  const v = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
  const h = {};
  (v.headers || []).forEach(r => { if (r.source === '/(.*)') r.headers.forEach(x => { h[x.key.toLowerCase()] = x.value; }); });
  return h;
}

// Statische Dateien aus dem Repo, /api/* geht an die Live-Seite (nur lesend)
export async function serveLocal(context, opt = {}) {
  const headers = vercelHeaders();
  await context.route(ORIGIN + '/**', async route => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith('/api/')) return opt.api ? opt.api(route, u) : route.continue();
    let p = decodeURIComponent(u.pathname);
    if (p === '/') p = '/index.html';
    if (IGNORED.includes(p.split('/')[1])) return route.fulfill({ status: 404, headers, body: 'NOT_FOUND' });
    let f = path.join(REPO, p);
    if (!path.extname(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      const nf = path.join(REPO, '404.html');
      if (fs.existsSync(nf)) return route.fulfill({ status: 404, headers: { ...headers, 'content-type': TYPES['.html'] }, body: fs.readFileSync(nf) });
      return route.fulfill({ status: 404, headers, body: 'NOT_FOUND' });
    }
    const type = TYPES[path.extname(f)] || 'application/octet-stream';
    // Teilabrufe (Range) wie bei Vercel, die Jury-Karte (PMTiles) lädt nur Ausschnitte
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers()['range'] || '');
    if (range) {
      const size = fs.statSync(f).size, start = +range[1], end = Math.min(range[2] ? +range[2] : size - 1, size - 1);
      const fd = fs.openSync(f, 'r'), buf = Buffer.alloc(end - start + 1);
      fs.readSync(fd, buf, 0, buf.length, start); fs.closeSync(fd);
      return route.fulfill({ status: 206, headers: { ...headers, 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(buf.length) }, body: buf });
    }
    return route.fulfill({ status: 200, headers: { ...headers, 'content-type': type }, body: fs.readFileSync(f) });
  });
}

// Sammelt JS-Fehler, Konsole (inkl. CSP-Verstöße) und fehlgeschlagene Abrufe
export function watch(page) {
  const log = [];
  page.on('pageerror', e => log.push('JS-Fehler: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || /Content Security Policy|CSP/i.test(m.text())) log.push('Konsole ' + m.type() + ': ' + m.text().slice(0, 300)); });
  // Kartenkacheln, die beim Zoomen abgebrochen werden, sind kein Fehler
  page.on('requestfailed', r => /\.pmtiles$/.test(r.url()) && /ERR_ABORTED|cancelled/i.test((r.failure() || {}).errorText || '') ? null : log.push('Abruf fehlgeschlagen: ' + r.url().slice(0, 120) + ' ' + (r.failure() || {}).errorText));
  page.on('response', r => { if (r.status() >= 400) log.push('HTTP ' + r.status() + ': ' + r.url().slice(0, 120)); });
  return log;
}

// Ragt etwas seitlich aus dem Bild?
export const overflow = page => page.evaluate(() => {
  const w = document.documentElement.clientWidth, out = [];
  if (document.documentElement.scrollWidth > w + 1) out.push('Seite scrollt quer: ' + document.documentElement.scrollWidth + ' > ' + w);
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    if (el.classList.contains('skip')) return; // Sprunglink liegt absichtlich außerhalb
    if (r.right > w + 1 || r.left < -1) {
      // in einem eigenen Scrollbereich ist das in Ordnung
      for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return; }
      out.push((el.tagName + '.' + el.className).slice(0, 60) + ' ' + Math.round(r.left) + '–' + Math.round(r.right));
    }
  });
  return out.slice(0, 8);
});

export const noInstallHint = context => context.addInitScript(() => { try { localStorage.setItem('adc-install', JSON.stringify({ s: 'done' })); } catch (e) {} });
