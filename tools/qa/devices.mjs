// Geräte-Test: jede Seite in jeder Breite/Engine, mit den wichtigsten Zuständen
import { chromium, webkit, firefox, devices } from 'playwright';
import { ORIGIN, OUT, serveLocal, watch, overflow, noInstallHint } from './lib.mjs';

const LIVE = process.argv.includes('--live');
const SHOTS = process.argv.includes('--shots');
const MATRIX = [
  ['webkit-320', webkit, { viewport: { width: 320, height: 568 }, userAgent: devices['iPhone SE'].userAgent, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
  ['webkit-375', webkit, { viewport: { width: 375, height: 812 }, userAgent: devices['iPhone 13'].userAgent, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
  ['webkit-390', webkit, { viewport: { width: 390, height: 844 }, userAgent: devices['iPhone 14'].userAgent, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
  ['chromium-412', chromium, { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } }],
  ['chromium-768', chromium, { viewport: { width: 768, height: 1024 } }],
  ['webkit-1024', webkit, { viewport: { width: 1024, height: 768 } }],
  ['chromium-1440', chromium, { viewport: { width: 1440, height: 900 } }],
  ['firefox-1440', firefox, { viewport: { width: 1440, height: 900 } }],
  ['webkit-1280', webkit, { viewport: { width: 1280, height: 800 } }],
];
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
const res = [];
const launched = new Map();

for (const [name, engine, opts] of MATRIX) {
  if (only && !name.includes(only)) continue;
  if (!launched.has(engine)) launched.set(engine, await engine.launch(engine === chromium ? { channel: 'chromium' } : {}));
  const ctx = await launched.get(engine).newContext({ ...opts, locale: 'de-DE' });
  if (!LIVE) await serveLocal(ctx);
  await noInstallHint(ctx);
  const add = (state, log, of) => { if (log.length || of.length) res.push({ geraet: name, zustand: state, fehler: [...new Set(log)], quer: of }); };
  const shot = async (page, state) => { if (SHOTS) await page.screenshot({ path: `${OUT}/${name}-${state}.png`, fullPage: state !== 'hilfe' && state !== 'wer' }); };

  for (const p of ['/impressum', '/datenschutz', '/gibtsnicht', '/jury']) {
    const page = await ctx.newPage(); const log = watch(page);
    await page.goto(ORIGIN + p, { waitUntil: 'networkidle' });
    if (p === '/jury') await page.waitForTimeout(1500);
    const of = await overflow(page);
    await shot(page, p.slice(1));
    add(p, p === '/gibtsnicht' ? log.filter(l => !/404/.test(l)) : log, of);
    await page.close();
  }

  const page = await ctx.newPage(); const log = watch(page);
  await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  add('start', log.splice(0), await overflow(page)); await shot(page, 'start');

  // Navigation/Kopf im Bild
  const hdr = await page.evaluate(() => { const w = innerWidth; return [...document.querySelectorAll('header a, header button')].filter(e => { const r = e.getBoundingClientRect(); return r.right > w + 1 || r.left < -1 || r.width < 24 || r.height < 24; }).map(e => e.textContent.trim() + ' ' + JSON.stringify(e.getBoundingClientRect())); });
  if (hdr.length) res.push({ geraet: name, zustand: 'kopf', fehler: hdr, quer: [] });

  // Alle aufklappen
  await page.$$eval('.toggle-all', bs => bs.forEach(b => b.click())); await page.waitForTimeout(400);
  add('alle-offen', log.splice(0), await overflow(page)); await shot(page, 'alle-offen');
  await page.$$eval('.toggle-all', bs => bs.forEach(b => b.click())); await page.waitForTimeout(300);

  // jeder Filter
  for (const b of await page.$$('.fb')) {
    await b.click(); await page.waitForTimeout(900);
    const t = await b.getAttribute('data-t');
    add('filter-' + t, log.splice(0), await overflow(page));
  }
  await page.click('.fb[data-t=all]'); await page.waitForTimeout(900);

  // Hilfe-Dialog: im Bild, Escape schließt
  await page.click('#help-btn'); await page.waitForTimeout(500);
  const dlg = await page.evaluate(() => { const d = document.getElementById('help'), r = d.getBoundingClientRect(); return { open: d.open, ok: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1, r: [r.left, r.top, r.right, r.bottom].map(Math.round), vw: [innerWidth, innerHeight] }; });
  if (!dlg.open || !dlg.ok) res.push({ geraet: name, zustand: 'hilfe', fehler: ['Dialog nicht im Bild: ' + JSON.stringify(dlg)], quer: [] });
  add('hilfe', log.splice(0), await overflow(page)); await shot(page, 'hilfe');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.getElementById('help').open)) res.push({ geraet: name, zustand: 'hilfe', fehler: ['Escape schließt nicht'], quer: [] });

  // Formular „Neue Idee" (braucht den Speicher) und Login-Dialog
  const store = await page.evaluate(() => !document.getElementById('profile-btn').hidden);
  if (!store) res.push({ geraet: name, zustand: 'speicher', fehler: ['Speicher nicht erreichbar, Formular-Zustände nicht geprüft'], quer: [] });
  else {
    await page.click('#suggest-btn'); await page.waitForTimeout(1300);
    add('formular', log.splice(0), await overflow(page)); await shot(page, 'formular');
    await page.fill('#s-title', 'QA-Testtitel, wird nicht gespeichert');
    await page.click('#s-submit'); await page.waitForTimeout(500);
    const who = await page.evaluate(() => { const d = document.getElementById('who'), r = d.getBoundingClientRect(); return { open: d.open, ok: r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }; });
    if (!who.open || !who.ok) res.push({ geraet: name, zustand: 'wer', fehler: ['Login-Dialog: ' + JSON.stringify(who)], quer: [] });
    add('wer', log.splice(0), await overflow(page)); await shot(page, 'wer');
    await page.click('#w-cancel'); await page.click('#s-cancel');
  }
  // Changelog
  await page.click('#cl-btn'); await page.waitForTimeout(300);
  add('changelog', log.splice(0), await overflow(page));
  // Deep Link
  const id = await page.evaluate(() => document.querySelector('.card').id);
  await page.goto(ORIGIN + '/#' + id, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  if (!await page.evaluate(i => document.getElementById(i).classList.contains('open'), id)) res.push({ geraet: name, zustand: 'deeplink', fehler: ['Idee nicht aufgeklappt'], quer: [] });
  add('deeplink', log.splice(0), await overflow(page));
  await ctx.close();
  console.error('fertig:', name);
}
for (const b of launched.values()) await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(res.length ? `BEFUNDE: ${res.length}` : 'OK: keine Befunde');
