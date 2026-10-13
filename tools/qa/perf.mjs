// Ladezeit am Handy (gedrosselt: 4× CPU, „Slow 4G"), 3 Läufe je Seite, Median
import { chromium, devices } from 'playwright';
import { ORIGIN } from './lib.mjs';
const b = await chromium.launch({ channel: 'chromium' });
const med = a => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const path of ['/', '/datenschutz']) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'de-DE' });
    await ctx.addInitScript(() => {
      try { localStorage.setItem('adc-install', '{"s":"done"}'); } catch (e) {}
      window.__m = { lcp: 0, cls: 0, long: 0 };
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.long += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let bytes = 0, reqs = 0; const hosts = new Set();
    cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; reqs++; });
    page.on('request', r => hosts.add(new URL(r.url()).host));
    await page.goto(ORIGIN + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => ({ ...window.__m, dom: document.querySelectorAll('*').length, cookies: document.cookie.length, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, ttfb: performance.getEntriesByType('navigation')[0].responseStart }));
    runs.push({ ...m, bytes, reqs, hosts: [...hosts] });
    await ctx.close();
  }
  console.log(path, JSON.stringify({ ttfb: Math.round(med(runs.map(r => r.ttfb))), fcp: Math.round(med(runs.map(r => r.fcp))), lcp: Math.round(med(runs.map(r => r.lcp))), cls: +med(runs.map(r => r.cls)).toFixed(3), blockiert_ms: Math.round(med(runs.map(r => r.long))), kB: Math.round(med(runs.map(r => r.bytes)) / 1024), abrufe: med(runs.map(r => r.reqs)), dom: runs[0].dom, cookies: runs[0].cookies, hosts: runs[0].hosts }));
}
await b.close();
