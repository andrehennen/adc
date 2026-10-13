// axe-core über alle Seiten und Zustände, Handy und Desktop
import { chromium } from 'playwright';
import fs from 'node:fs';
import { ORIGIN, serveLocal, noInstallHint } from './lib.mjs';

const LIVE = process.argv.includes('--live');
const axeSrc = fs.readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const browser = await chromium.launch({ channel: 'chromium' });
const all = {};
let total = 0;

async function run(page, label) {
  await page.evaluate(axeSrc);
  const r = await page.evaluate(tags => axe.run(document, { runOnly: { type: 'tag', values: tags } }), TAGS);
  for (const v of r.violations) {
    total += v.nodes.length;
    const k = v.id + ' (' + v.impact + ')';
    (all[k] = all[k] || { hilfe: v.help, wo: {} });
    v.nodes.slice(0, 4).forEach(n => { const key = n.target.join(' ').slice(0, 90); (all[k].wo[key] = all[k].wo[key] || []).push(label); });
    all[k].anzahl = (all[k].anzahl || 0) + v.nodes.length;
    if (v.id === 'color-contrast') v.nodes.slice(0, 6).forEach(n => { all[k].detail = all[k].detail || []; const d = n.any[0] && n.any[0].data; if (d) all[k].detail.push(`${n.target.join(' ').slice(0, 60)}: ${d.fgColor} auf ${d.bgColor} = ${d.contrastRatio}`); });
  }
}

for (const [vp, w, h] of [['handy', 375, 812], ['desktop', 1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'de-DE', bypassCSP: true });
  if (!LIVE) await serveLocal(ctx);
  await noInstallHint(ctx);
  for (const p of ['/impressum', '/datenschutz', '/gibtsnicht']) {
    const page = await ctx.newPage();
    await page.goto(ORIGIN + p, { waitUntil: 'networkidle' });
    await run(page, vp + p); await page.close();
  }
  const page = await ctx.newPage();
  await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  await run(page, vp + '/start');
  await page.click('#toggle-all'); await page.waitForTimeout(500);
  await run(page, vp + '/alle-offen');
  await page.click('#toggle-all'); await page.waitForTimeout(300);
  await page.click('#help-btn'); await page.waitForTimeout(500);
  await run(page, vp + '/hilfe');
  await page.keyboard.press('Escape');
  if (await page.evaluate(() => !document.getElementById('profile-btn').hidden)) {
    await page.click('#suggest-btn'); await page.waitForTimeout(1300);
    await run(page, vp + '/formular');
    await page.fill('#s-title', 'QA-Testtitel'); await page.click('#s-submit'); await page.waitForTimeout(500);
    await run(page, vp + '/wer');
    await page.click('#w-cancel'); await page.click('#s-cancel');
  }
  await page.click('#cl-btn'); await page.waitForTimeout(300);
  await run(page, vp + '/changelog');
  // Installations-Hinweis
  await page.evaluate(() => { document.getElementById('inst-txt').textContent = 'Test'; document.getElementById('install').showModal(); }); await page.waitForTimeout(700);
  await run(page, vp + '/install');
  await ctx.close();
}
await browser.close();
for (const k in all) for (const t in all[k].wo) all[k].wo[t] = [...new Set(all[k].wo[t])].join(', ');
console.log(JSON.stringify(all, null, 1));
console.log('axe-Befunde gesamt (Knoten):', total);
