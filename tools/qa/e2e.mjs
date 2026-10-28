// Abläufe mit nachgebautem Speicher (kein Schreibzugriff auf die echte Datenbank)
import { chromium, webkit } from 'playwright';
import { ORIGIN, serveLocal, watch, noInstallHint } from './lib.mjs';

const CODE = 'qa-code';
const XSS = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>"\'>';
const results = [];
const ok = (name, cond, extra) => { results.push((cond ? 'OK   ' : 'FEHLER ') + name + (cond || !extra ? '' : ' → ' + extra)); };

function fakeStore(seedXss) {
  const now = () => new Date().toISOString();
  const db = { helpers: [], comments: [], tickets: [], step_edits: [], votes: [], contacts: [], trash: [], jury_locations: [], seq: 10 };
  if (seedXss) {
    db.tickets.push({ id: 1, s: 'hh', sektion: XSS, emoji: XSS, title: 'XSS-Titel ' + XSS, body: XSS + ' https://example.com/"onmouseover="window.__xss=1', x: XSS, tags: ['events', XSS], created_by: XSS, created_at: now(), updated_by: XSS, updated_at: now(), deleted: false });
    db.helpers.push({ ticket: 'neu-1', name: XSS, created_at: now() });
    db.comments.push({ id: 5, ticket: 'neu-1', name: XSS, body: XSS + ' javascript:alert(1) https://a.b/<x>', created_at: now(), deleted: false });
    db.votes.push({ ticket: 'neu-1', name: XSS });
    db.step_edits.push({ ticket: 'neu-1', body: XSS, base: XSS, name: XSS, created_at: now() });
    db.contacts.push({ name: XSS, email: 'a@b.de"><img src=x onerror=window.__xss=1>', phone: '+49"><img src=x onerror=window.__xss=1>' });
  }
  const calls = [];
  const handler = async route => {
    const req = route.request(), u = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(b) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (db.down) return route.abort('internetdisconnected');
    const t = u.pathname.replace('/rest/v1/', '');
    if (!t.startsWith('rpc/')) return json((db[t] || []).filter(r => !((t === 'tickets' || t === 'jury_locations') && r.deleted)));
    const a = JSON.parse(req.postData() || '{}'), fn = t.slice(4);
    calls.push(fn);
    if (a.p_code !== CODE) return json({ code: '28000', message: 'Falscher Mitglieder-Code' }, 403);
    if (db.failNext) { db.failNext = false; return json({ message: 'Testfehler vom Server' }, 500); }
    switch (fn) {
      case 'verify_code': return json(true);
      case 'get_contacts': return json(db.contacts);
      case 'toggle_vote': { const i = db.votes.findIndex(v => v.ticket === a.p_ticket && v.name === a.p_name); i < 0 ? db.votes.push({ ticket: a.p_ticket, name: a.p_name }) : db.votes.splice(i, 1); return json(null); }
      case 'add_helper': db.helpers.push({ ticket: a.p_ticket, name: a.p_name, created_at: now() }); return json(null);
      case 'remove_helper': db.helpers = db.helpers.filter(h => !(h.ticket === a.p_ticket && h.name === a.p_name)); return json(null);
      case 'add_comment': db.comments.push({ id: ++db.seq, ticket: a.p_ticket, name: a.p_name, body: a.p_body, created_at: now(), deleted: false }); return json(null);
      case 'delete_comment': { const c = db.comments.find(c => c.id === a.p_id); db.comments = db.comments.filter(x => x !== c); db.trash.push({ ...c, deleted_by: a.p_name, deleted_at: now() }); return json(null); }
      case 'restore_comment': { const c = db.trash.find(c => c.id === a.p_id); db.trash = db.trash.filter(x => x !== c); db.comments.push(c); return json(null); }
      case 'get_trash': return json({ tickets: db.tickets.filter(t => t.deleted), comments: db.trash });
      case 'create_ticket': { const id = ++db.seq; db.tickets.push({ id, s: a.p_s, sektion: a.p_sektion, emoji: a.p_emoji, title: a.p_title, body: a.p_body, x: a.p_x, tags: a.p_tags, created_by: a.p_name, created_at: now(), deleted: false }); return json(id); }
      case 'update_ticket': { const tk = db.tickets.find(t => t.id === a.p_id); Object.assign(tk, { title: a.p_title, body: a.p_body, x: a.p_x, updated_by: a.p_name, updated_at: now() }); return json(null); }
      case 'delete_ticket': { const tk = db.tickets.find(t => t.id === a.p_id); tk.deleted = true; tk.deleted_by = a.p_name; tk.deleted_at = now(); return json(null); }
      case 'restore_ticket': db.tickets.find(t => t.id === a.p_id).deleted = false; return json(null);
      case 'set_next_steps': db.step_edits.unshift({ ticket: a.p_ticket, body: a.p_body, base: a.p_base, name: a.p_name, created_at: now() }); return json(null);
      case 'save_contact': db.contacts = db.contacts.filter(c => c.name !== a.p_name).concat({ name: a.p_name, email: a.p_email, phone: a.p_phone }); return json(null);
      case 'save_jury_location': {
        const f = { ort: a.p_ort, firma: a.p_firma || null, adresse: a.p_adresse, lat: a.p_lat, lng: a.p_lng, raeume: a.p_raeume, plaetze: a.p_plaetze, internet: a.p_internet, catering: a.p_catering || null, tage: a.p_tage || null, jury: a.p_jury || null, notiz: a.p_notiz || null };
        if (a.p_id) { Object.assign(db.jury_locations.find(l => l.id === a.p_id), f, { updated_by: a.p_name }); return json(a.p_id); }
        const id = ++db.seq; db.jury_locations.push({ id, ...f, created_by: a.p_name, created_at: now(), deleted: false }); return json(id);
      }
      case 'delete_jury_location': db.jury_locations.find(l => l.id === a.p_id).deleted = true; return json(null);
      case 'delete_contact': db.contacts = db.contacts.filter(c => c.name !== a.p_name); return json(null);
    }
    return json({ message: 'unbekannt: ' + fn }, 404);
  };
  return { db, calls, handler };
}

async function setup(browser, { seedXss = false, viewport = { width: 1280, height: 900 }, noConfig = false, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'de-DE', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const store = fakeStore(seedXss);
  await serveLocal(ctx, { api: (route, u) => u.pathname === '/api/config' ? route.fulfill({ contentType: 'application/json', body: noConfig ? '{}' : JSON.stringify({ url: 'https://qa.supabase.co', key: 'sb_publishable_qa' }) }) : route.fulfill({ contentType: 'application/json', body: '{"date":"2026-10-12T10:38:19Z"}' }) });
  await ctx.route('https://qa.supabase.co/**', store.handler);
  await noInstallHint(ctx);
  const page = await ctx.newPage(); const log = watch(page);
  const dialogs = []; page.on('dialog', d => { dialogs.push(d.type() + ': ' + d.message()); d.accept(); });
  await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  return { ctx, page, log, store, dialogs };
}
const login = async (page, name = 'Qa Testerin', code = CODE) => { await page.fill('#w-name', name); await page.fill('#w-code', code); await page.click('#wform button[type=submit]'); };

const browser = await chromium.launch({ channel: 'chromium' });

// 1. Kernabläufe
{
  const { ctx, page, log, store, dialogs } = await setup(browser);
  const first = page.locator('.card').first(); const id = await first.getAttribute('id');
  ok('Speicher an: „Neue Idee" und „Mein Kontakt" sichtbar', await page.locator('#profile-btn').isVisible() && (await page.textContent('#suggest-btn')).includes('Neue Idee'));
  const v0 = parseInt((await first.locator('.vote').textContent()).replace(/\D/g, '')) || 0;
  await first.locator('.vote').click();
  ok('Voten ohne Anmeldung öffnet Login-Dialog', await page.locator('#who').evaluate(d => d.open));
  ok('Fokus liegt im Login-Dialog', await page.evaluate(() => document.getElementById('who').contains(document.activeElement)));
  await login(page, 'Qa');
  ok('Nur Vorname wird abgelehnt', (await page.textContent('#w-msg')).includes('Vor- und Nachnamen'));
  await login(page, 'Qa Testerin', 'falsch');
  await page.waitForFunction(() => /Falscher/.test(document.getElementById('w-msg').textContent), null, { timeout: 5000 }).catch(() => {});
  ok('Falscher Code: Meldung am Feld, Dialog bleibt offen', (await page.textContent('#w-msg')).includes('Falscher Mitglieder-Code') && await page.locator('#who').evaluate(d => d.open));
  await login(page);
  await page.waitForFunction(i => document.getElementById(i).querySelector('.vote.on'), id, { timeout: 5000 }).catch(() => {});
  const v1 = parseInt((await page.locator('#' + id + ' .vote').textContent()).replace(/\D/g, ''));
  ok('Stimme gezählt und markiert', v1 === v0 + 1 && await page.locator('#' + id + ' .vote').getAttribute('aria-pressed') === 'true', v0 + ' → ' + v1);
  ok('Name und Code im Browser gemerkt', await page.evaluate(() => JSON.parse(localStorage.getItem('adc-me')).name === 'Qa Testerin'));
  await page.locator('#' + id + ' .vote').click(); await page.waitForTimeout(500);
  ok('Zweiter Klick nimmt die Stimme zurück', store.db.votes.length === 0);

  // Karte öffnen, kommentieren
  await page.locator('#' + id + ' .chead').click(); await page.waitForTimeout(800);
  const card = page.locator('#' + id);
  await card.locator('[data-cform] textarea').fill('Entwurf, der ein Neuzeichnen überleben muss');
  await page.locator('.fb[data-t=all]').click(); await page.waitForTimeout(900);
  ok('Kommentar-Entwurf überlebt Neuzeichnen (Filterklick)', await card.locator('[data-cform] textarea').inputValue() === 'Entwurf, der ein Neuzeichnen überleben muss');
  ok('Karte bleibt nach Neuzeichnen offen', await card.evaluate(c => c.classList.contains('open')));
  store.db.failNext = true;
  await card.locator('[data-cform] button').click(); await page.waitForTimeout(600);
  ok('Serverfehler beim Speichern: Meldung, Text bleibt erhalten, Knopf wieder aktiv', dialogs.some(d => d.includes('Testfehler')) && await card.locator('[data-cform] textarea').inputValue() !== '' && await card.locator('[data-cform] button').isEnabled(), dialogs.join(' | '));
  await card.locator('[data-cform] button').click();
  await page.waitForFunction(i => document.getElementById(i).querySelector('.cm'), id, { timeout: 5000 }).catch(() => {});
  ok('Kommentar gespeichert, Feld geleert', await card.locator('.cm').count() === 1 && await card.locator('[data-cform] textarea').inputValue() === '');
  // Doppelklick
  await card.locator('[data-cform] textarea').fill('Doppelklick-Test');
  await card.locator('[data-cform] button').dblclick(); await page.waitForTimeout(800);
  ok('Doppelklick speichert nur einmal', store.db.comments.filter(c => c.body === 'Doppelklick-Test').length === 1, 'Anzahl ' + store.db.comments.filter(c => c.body === 'Doppelklick-Test').length);
  // Mitmachen
  const join = card.locator('[data-join]');
  if (await join.count()) { await join.first().click(); await page.waitForTimeout(600); ok('Mitmachen trägt den Namen ein', store.db.helpers.some(h => h.name === 'Qa Testerin') && (await card.textContent()).includes('Qa Testerin')); }
  // Nächste Schritte bearbeiten
  const eb = card.locator('[data-edit]');
  if (await eb.count()) {
    await eb.click(); await card.locator('.sform textarea').fill('Schritt eins\nSchritt zwei');
    await card.locator('.sform button[type=submit]').click(); await page.waitForTimeout(700);
    ok('Nächste Schritte online bearbeitet', (await card.locator('[data-steps]').textContent()).includes('Schritt zwei') && (await card.locator('[data-steps]').textContent()).includes('Bearbeitet von Qa Testerin'));
    // Abhaken → „Bisher passiert“, wieder öffnen
    await card.locator('[data-steps] [data-tick]').first().check({ force: true }); await page.waitForTimeout(700);
    const body1 = store.db.step_edits[0].body;
    ok('Schritt abhaken speichert ihn als erledigt', /^✓ Schritt eins \(erledigt: Qa Testerin, \d{1,2}\.\d{1,2}\.\d{4}\)\nSchritt zwei$/.test(body1), body1);
    ok('Abgehakter Schritt steht unter „Bisher passiert“', !(await card.locator('[data-steps]').textContent()).includes('Schritt eins') && await card.locator('.todo li.done', { hasText: 'Schritt eins' }).count() === 1);
    await card.locator('.todo li.done [data-tick]').first().uncheck({ force: true }); await page.waitForTimeout(700);
    ok('Haken entfernen macht ihn wieder offen', store.db.step_edits[0].body === 'Schritt eins\nSchritt zwei' && (await card.locator('[data-steps]').textContent()).includes('Schritt eins'), store.db.step_edits[0].body);
  }
  // Kommentar löschen → Papierkorb → wiederherstellen
  await card.locator('.cdel').first().click(); await page.waitForTimeout(700);
  ok('Kommentar löschen fragt nach und entfernt ihn', dialogs.some(d => d.startsWith('confirm: Kommentar löschen')) && store.db.trash.length === 1);
  await page.click('#trash-btn'); await page.waitForTimeout(700);
  ok('Papierkorb zeigt den gelöschten Kommentar', (await page.textContent('#trash-list')).includes('Kommentar'));
  await page.locator('#trash-list [data-restore]').first().click(); await page.waitForTimeout(800);
  ok('Wiederherstellen holt ihn zurück', store.db.trash.length === 0 && store.db.comments.length === 2);

  // Neue Idee: Grenzwerte, Anlegen, Bearbeiten, Löschen
  await page.click('#suggest-btn'); await page.waitForTimeout(1200);
  ok('Formular offen, Fokus im Titelfeld', await page.evaluate(() => document.activeElement.id === 's-title'));
  await page.fill('#s-title', 'ab'); await page.click('#s-submit');
  ok('Titel unter 3 Zeichen wird abgelehnt', (await page.textContent('#s-msg')).includes('mindestens 3'));
  await page.fill('#s-title', '   '); await page.click('#s-submit'); await page.waitForTimeout(200);
  ok('Nur Leerzeichen als Titel wird abgelehnt', !store.calls.includes('create_ticket'));
  ok('Längenbegrenzung im Titelfeld (140)', await page.evaluate(() => { const t = document.getElementById('s-title'); t.value = ''; return t.maxLength === 140; }));
  await page.fill('#s-title', 'QA-Idee mit Umlauten äöü & <Zeichen>');
  await page.fill('#s-body', 'Beschreibung\nzweite Zeile https://example.com/pfad?a=1&b=2.');
  await page.fill('#s-x', '1. erster\n\n  zweiter  ');
  await page.check('input[name="s-t[]"][value=events]', { force: true });
  await page.click('#s-submit');
  await page.waitForSelector('.card[id^=neu-]', { timeout: 5000 }).catch(() => {});
  const neu = page.locator('.card[id^=neu-]').first();
  ok('Neue Idee angelegt, aufgeklappt, mit Badge „Neu"', await neu.count() === 1 && await neu.evaluate(c => c.classList.contains('open')) && (await neu.textContent()).includes('Neu'));
  ok('Sonderzeichen korrekt dargestellt', (await neu.locator('.cname').textContent()) === 'QA-Idee mit Umlauten äöü & <Zeichen>');
  ok('Link in der Beschreibung klickbar, Satzpunkt nicht im Link', await neu.locator('a[href="https://example.com/pfad?a=1&b=2"]').count() === 1);
  await page.waitForTimeout(500);
  ok('Formular nach dem Speichern geschlossen', await page.locator('#suggest').isHidden());
  ok('Anker wieder aus der Adresse entfernt', !(await page.evaluate(() => location.hash)));
  await page.waitForTimeout(1300);
  await neu.locator('[data-tedit]').click(); await page.waitForTimeout(1200);
  ok('Bearbeiten füllt das Formular vor', await page.inputValue('#s-title') === 'QA-Idee mit Umlauten äöü & <Zeichen>' && await page.locator('#s-anon-row').isHidden());
  await page.fill('#s-title', 'QA-Idee geändert'); await page.click('#s-submit'); await page.waitForTimeout(900);
  ok('Änderung gespeichert', (await page.locator('.card[id^=neu-] .cname').first().textContent()) === 'QA-Idee geändert');
  await page.waitForTimeout(1300);
  await page.locator('.card[id^=neu-] [data-tdel]').first().click(); await page.waitForTimeout(900);
  ok('Idee löschen: Rückfrage, verschwindet, liegt im Papierkorb', dialogs.some(d => d.startsWith('confirm: Idee „QA-Idee geändert“ löschen')) && await page.locator('.card[id^=neu-]').count() === 0 && (await page.textContent('#trash-list')).includes('QA-Idee geändert'));
  // Anonym
  await page.click('#suggest-btn'); await page.waitForTimeout(1200);
  await page.fill('#s-title', 'Anonyme QA-Idee'); await page.check('#s-anon'); await page.click('#s-submit'); await page.waitForTimeout(900);
  ok('Anonym einreichen speichert keinen Namen', store.db.tickets.some(t => t.title === 'Anonyme QA-Idee' && t.created_by === 'Anonym'));
  // Kontakt
  await page.click('#profile-btn'); await page.waitForTimeout(300);
  await page.click('#pform button[type=submit]');
  ok('Kontakt ohne Angaben wird abgelehnt', (await page.textContent('#p-msg')).includes('Bitte E-Mail oder WhatsApp'));
  await page.click('#p-close'); await page.waitForTimeout(500);
  ok('Kontakt-Panel lässt sich mit × schließen', await page.locator('#profile').isHidden());
  await page.click('#profile-btn'); await page.waitForTimeout(300);
  await page.fill('#p-email', 'qa@example.com'); await page.click('#pform button[type=submit]'); await page.waitForTimeout(700);
  ok('Kontakt gespeichert', store.db.contacts.some(c => c.email === 'qa@example.com') && (await page.textContent('#p-msg')).includes('Gespeichert'));
  // Ungespeichertes: kein Auto-Reload
  await page.waitForTimeout(900);
  ok('Kontaktdaten schließen sich nach dem Speichern', await page.evaluate(() => !document.getElementById('profile').open));
  await page.click('#profile-btn'); await page.waitForTimeout(500);
  ok('Offenes Formular zählt als ungespeichert (kein Auto-Reload)', await page.evaluate(() => document.getElementById('profile').open));
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  // Netz weg mitten im Ablauf
  store.db.down = true;
  await page.locator('.card').first().locator('.vote').click(); await page.waitForTimeout(700);
  ok('Netz weg beim Speichern: verständliche Meldung, Knopf wieder aktiv', dialogs.some(d => d.includes('Keine Verbindung zum Speicher')) && await page.locator('.card').first().locator('.vote').isEnabled(), dialogs.slice(-1)[0]);
  store.db.down = false;
  // Neuladen: Zustand bleibt
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('.card');
  ok('Nach Neuladen weiter angemeldet, Daten da', (await page.evaluate(() => JSON.parse(localStorage.getItem('adc-me')).code)) === CODE && await page.locator('.card[id^=neu-]').count() === 1);
  // Code wird ungültig (Sitzungsablauf)
  await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('adc-me')); m.code = 'alt'; localStorage.setItem('adc-me', JSON.stringify(m)); });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('.card');
  await page.locator('.card').first().locator('.vote').click(); await page.waitForTimeout(700);
  ok('Veralteter Code: Meldung, Code wird vergessen', dialogs.some(d => d.includes('Falscher Mitglieder-Code')) && !(await page.evaluate(() => JSON.parse(localStorage.getItem('adc-me')).code)));
  await page.locator('.card').first().locator('.vote').click(); await page.waitForTimeout(400);
  ok('Danach fragt die Seite wieder nach dem Code', await page.locator('#who').evaluate(d => d.open));
  ok('Keine JS-/CSP-Fehler im Ablauf', log.filter(l => !/403|500|ERR_INTERNET|internetdisconnected|Speicher nicht erreichbar|Failed to load resource/.test(l)).length === 0, log.filter(l => !/403|500|ERR_INTERNET|internetdisconnected|Failed to load resource/.test(l)).join(' || '));
  await ctx.close();
}

// 2. XSS: alles aus der Datenbank wird nur als Text ausgegeben
{
  const { ctx, page, log } = await setup(browser, { seedXss: true });
  await page.evaluate(() => localStorage.setItem('adc-me', JSON.stringify({ name: 'Qa Testerin', code: 'qa-code' })));
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('.card[id^=neu-]');
  await page.$$eval('.toggle-all', bs => bs.forEach(b => b.click())); await page.waitForTimeout(600);
  await page.click('#trash-btn'); await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({ xss: window.__xss, imgs: document.querySelectorAll('main img, footer img, main script').length, bad: [...document.querySelectorAll('a')].filter(a => /^javascript:/i.test(a.getAttribute('href') || '') || a.hasAttribute('onmouseover')).length, on: [...document.querySelectorAll('main *')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length }));
  ok('XSS-Versuche in allen Feldern bleiben Text', !r.xss && r.imgs === 0 && r.bad === 0 && r.on === 0, JSON.stringify(r));
  ok('XSS-Seite ohne JS-Fehler', log.filter(l => /JS-Fehler/.test(l)).length === 0, log.join(' || '));
  await ctx.close();
}

// 3. Speicher nicht erreichbar / nicht konfiguriert → Rückfall auf Sli.do/WhatsApp
for (const mode of ['down', 'noConfig']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  await serveLocal(ctx, { api: (route, u) => mode === 'noConfig' || u.pathname !== '/api/config' ? route.fulfill({ status: mode === 'noConfig' ? 500 : 200, contentType: 'application/json', body: '{}' }) : route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://qa.supabase.co', key: 'k' }) }) });
  await ctx.route('https://qa.supabase.co/**', r => r.abort('internetdisconnected'));
  await noInstallHint(ctx);
  const page = await ctx.newPage(); const log = watch(page);
  await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
  const n = await page.locator('.card').count();
  ok(`Speicher weg (${mode}): Seite zeigt alle festen Ideen, Sli.do-Link statt Formular, keine JS-Fehler`, n >= 30 && (await page.getAttribute('#suggest-btn', 'href')).includes('sli.do') && await page.locator('#profile-btn').isHidden() && await page.locator('#mine-btn').isHidden() && !log.some(l => /JS-Fehler/.test(l)), n + ' Karten; ' + log.join(' | '));
  await page.locator('.card .chead').first().click(); await page.waitForTimeout(700);
  ok(`Speicher weg (${mode}): Karte ohne Schreib-Knöpfe, mit WhatsApp-Hinweis wo nötig`, await page.locator('.card.open [data-cform], .card.open [data-edit]').count() === 0);
  await ctx.close();
}

// 3b. Filter „Für mich“
{
  const { ctx, page, store } = await setup(browser);
  ok('„Für mich“ sichtbar, wenn der Speicher läuft', await page.locator('#mine-btn').isVisible());
  await page.click('#mine-btn');
  ok('„Für mich“ ohne Anmeldung öffnet Login-Dialog', await page.locator('#who').evaluate(d => d.open));
  await login(page, 'Andre Hennen'); await page.waitForTimeout(1400);
  const r = await page.evaluate(() => [...document.querySelectorAll('.card')].map(c => c.querySelector('.cmeta').textContent));
  ok('„Für mich“ zeigt nur eigene Ideen (Owner, akzentunabhängig)', r.length > 0 && r.every(t => /André Hennen/.test(t)), r.length + ' Karten');
  ok('„Für mich“ ist gedrückt und zeigt die Anzahl', await page.getAttribute('#mine-btn', 'aria-pressed') === 'true' && (await page.textContent('#mine-btn')).includes('· ' + r.length));
  await page.click('.fb[data-t=jury]'); await page.waitForTimeout(900);
  const j = await page.locator('.card').count();
  ok('„Für mich“ kombiniert sich mit Themen-Filter', j < r.length, j + ' von ' + r.length);
  await page.click('.fb[data-t=all]'); await page.waitForTimeout(900);
  await page.click('#mine-btn'); await page.waitForTimeout(900);
  ok('Zweiter Klick zeigt wieder alle', await page.locator('.card').count() >= 30);
  await page.click('#mine-btn'); await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('#mine-btn:visible'); await page.waitForTimeout(600);
  ok('„Für mich“ bleibt nach Neuladen aktiv', await page.getAttribute('#mine-btn', 'aria-pressed') === 'true' && await page.locator('.card').count() < 30);
  await page.click('#mine-btn'); await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('#mine-btn:visible'); await page.waitForTimeout(600);
  ok('„Für mich“ bleibt nach Neuladen aus', await page.getAttribute('#mine-btn', 'aria-pressed') === 'false' && await page.locator('.card').count() >= 30);
  // Mitmachen landet in „Für mich“
  const other = page.locator('.card:not(:has-text("André Hennen")) .chead').first();
  const oid = await other.evaluate(e => e.parentElement.id); await other.click(); await page.waitForTimeout(800);
  await page.locator('#' + oid + ' [data-join]').first().click(); await page.waitForTimeout(800);
  await page.click('#mine-btn'); await page.waitForTimeout(1000);
  ok('Mitgemachte Idee erscheint unter „Für mich“', await page.locator('#' + oid).count() === 1);
  await page.evaluate(() => { localStorage.setItem('adc-me', JSON.stringify({ name: 'Niemand Hier', code: 'qa-code' })); });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('#mine-btn:visible'); await page.waitForTimeout(1000);
  ok('Ohne eigene Ideen: freundlicher Hinweis statt leerer Spalte', (await page.textContent('#chh')).includes('Hier bist du noch bei keiner Idee dabei'));
  await ctx.close();
}

// 4. Tastatur und Fokus
{
  const { ctx, page } = await setup(browser);
  await page.keyboard.press('Tab');
  const skip = await page.evaluate(() => ({ t: document.activeElement.textContent, vis: document.activeElement.getBoundingClientRect().left >= 0 }));
  ok('Erster Tab: Sprunglink „Zum Inhalt", sichtbar', skip.t === 'Zum Inhalt' && skip.vis, JSON.stringify(skip));
  const noFocus = [];
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); const vis = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'; const r = e.getBoundingClientRect(); return { n: (e.tagName + '.' + e.className + ' ' + e.textContent.trim().slice(0, 25)), vis, inView: r.width > 0 }; });
    if (!f.vis || !f.inView) noFocus.push(f.n);
  }
  ok('Sichtbarer Fokus bei den ersten 45 Tab-Stopps', noFocus.length === 0, [...new Set(noFocus)].join(' | '));
  await page.focus('#help-btn'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  ok('Hilfe per Tastatur: Fokus im Dialog', await page.evaluate(() => document.getElementById('help').open && document.getElementById('help').contains(document.activeElement)));
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  ok('Fokus bleibt im Dialog (Fokusfalle)', await page.evaluate(() => document.getElementById('help').contains(document.activeElement) || document.activeElement === document.body));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok('Escape schließt, Fokus zurück am Hilfe-Knopf', await page.evaluate(() => !document.getElementById('help').open && document.activeElement.id === 'help-btn'));
  const c = page.locator('.card .chead').first(); await c.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  ok('Karte per Enter aufklappbar, aria-expanded stimmt', await c.getAttribute('aria-expanded') === 'true');
  await page.keyboard.press('Space'); await page.waitForTimeout(800);
  ok('Karte per Leertaste zuklappbar', await c.getAttribute('aria-expanded') === 'false');
  const fb = page.locator('.fb[data-t=jury]'); await fb.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  ok('Filter per Tastatur, aria-pressed gesetzt', await fb.getAttribute('aria-pressed') === 'true' && await page.locator('.fb[data-t=all]').getAttribute('aria-pressed') === 'false');
  await ctx.close();
}

// 5. Zielgrößen auf dem Handy (WCAG 2.2: mindestens 24 × 24 px)
{
  const { ctx, page } = await setup(browser, { viewport: { width: 375, height: 812 }, seedXss: false });
  await page.evaluate(() => localStorage.setItem('adc-me', JSON.stringify({ name: 'Qa Testerin', code: 'qa-code' })));
  await page.$$eval('.toggle-all', bs => bs.forEach(b => b.click())); await page.waitForTimeout(600);
  const small = await page.evaluate(() => { const m = {}; document.querySelectorAll('a, button, input, textarea, [tabindex="0"]').forEach(e => { const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).visibility === 'hidden') return; if (r.width < 24 || r.height < 24) { const inline = getComputedStyle(e).display === 'inline' && e.closest('p, li, .txt, .quote, .legal, .by, .edited'); if (inline) return; const k = (e.tagName + '.' + (e.className || e.id)).slice(0, 40); m[k] = (m[k] || 0) + 1; m[k + ' Maß'] = Math.round(r.width) + '×' + Math.round(r.height); } }); return m; });
  ok('Zielgrößen ≥ 24 px', Object.keys(small).length === 0, JSON.stringify(small));
  await ctx.close();
}

// 5b. Jury Map: Ort eintragen (Pin über Adresssuche), bearbeiten, löschen; Datenbank-Inhalte nur als Text
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'de-DE' });
  const store = fakeStore(true), geo = [];
  store.db.jury_locations.push({ id: 2, ort: XSS, firma: XSS, adresse: XSS, lat: 53.55, lng: 9.99, raeume: 1, plaetze: 2, internet: true, catering: 'ja', tage: XSS, jury: XSS, notiz: XSS + ' https://a.b/"onmouseover="window.__xss=1', created_by: XSS, created_at: new Date().toISOString(), deleted: false });
  await serveLocal(ctx, { api: (route, u) => {
    if (u.pathname === '/api/config') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://qa.supabase.co', key: 'sb_publishable_qa' }) });
    if (u.pathname === '/api/geocode') { geo.push(u.searchParams.get('q')); return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ name: 'Glashüttenstraße 38, St. Pauli, Hamburg', lat: 53.5622, lng: 9.9646 }]) }); }
    return route.fulfill({ contentType: 'application/json', body: '{}' });
  } });
  await ctx.route('https://qa.supabase.co/**', store.handler);
  const page = await ctx.newPage(); const log = watch(page);
  page.on('dialog', d => d.accept());
  await page.goto(ORIGIN + '/jury', { waitUntil: 'networkidle' });
  await page.waitForSelector('#ort-2'); await page.waitForTimeout(1500);
  ok('Jury Map: Karte und Pins laden, Demo-Orte ohne Bearbeiten', await page.locator('.maplibregl-canvas').count() === 1 && await page.locator('.maplibregl-marker').count() === 4 && await page.locator('#ort--1').count() === 1 && await page.locator('#ort--1 [data-edit]').count() === 0);
  ok('Jury Map: XSS aus der Datenbank wird nicht ausgeführt', !(await page.evaluate(() => window.__xss)) && await page.locator('#locs img, #locs script').count() === 0);
  await page.click('#add-btn'); await login(page); await page.waitForSelector('#form-panel:not([hidden])');
  await page.fill('#f-ort', 'QA Agentur, Raum Elbe'); await page.fill('#f-adresse', 'Glashüttenstraße 38');
  await page.click('#f-submit'); const msg1 = await page.textContent('#f-msg');
  await page.click('#f-find'); await page.waitForTimeout(600);
  await page.fill('#f-raeume', '2');
  await page.click('label.opt:has(input[name=f-net][value="1"])');
  await page.click('#f-submit'); await page.waitForTimeout(1000);
  const saved = store.db.jury_locations.find(l => l.ort === 'QA Agentur, Raum Elbe');
  ok('Jury Map: Pin ist Pflicht, Adresssuche setzt ihn, Speichern', /Pin/.test(msg1) && geo[0] === 'Glashüttenstraße 38, Hamburg' && saved && saved.lat === 53.5622 && saved.raeume === 2 && saved.internet === true && saved.created_by === 'Qa Testerin', JSON.stringify({ msg1, geo, saved }));
  ok('Jury Map: neuer Ort in der Liste, Formular zu', !!saved && await page.locator('#ort-' + saved.id).count() === 1 && await page.locator('#form-panel').isHidden());
  if (saved) {
    await page.click(`[data-edit="${saved.id}"]`); await page.fill('#f-jury', 'Film'); await page.click('#f-submit'); await page.waitForTimeout(1000);
    ok('Jury Map: Ort bearbeiten', saved.jury === 'Film' && /Film/.test(await page.textContent('#ort-' + saved.id)));
    await page.click(`[data-edit="${saved.id}"]`); await page.click('#f-del'); await page.waitForTimeout(1000);
    ok('Jury Map: Ort löschen', saved.deleted && await page.locator('#ort-' + saved.id).count() === 0);
  }
  // abgebrochene Kachel-Abrufe beim Zoomen sind normal
  const jlog = log.filter(l => !/pmtiles net::ERR_ABORTED/.test(l));
  ok('Jury Map: keine JS-, CSP- oder Ladefehler', jlog.length === 0, jlog.join(' | '));
  // Speicher beim Laden weg, beim Klick wieder da: „Ort anbieten“ versucht es neu
  const p2 = await ctx.newPage();
  store.db.down = true;
  await p2.goto(ORIGIN + '/jury', { waitUntil: 'networkidle' }); await p2.waitForTimeout(800);
  const demoOnly = await p2.locator('.loc[data-id]').count();
  store.db.down = false;
  await p2.click('#add-btn'); await p2.waitForTimeout(800);
  ok('Jury Map: Speicher erst weg, dann „Ort anbieten“ lädt neu und öffnet das Formular', demoOnly === 3 && await p2.locator('#form-panel').isVisible(), 'Demo-Karten: ' + demoOnly);
  await ctx.close();
}

// 6. Weniger Bewegung
{
  const { ctx, page } = await setup(browser, { reduced: true });
  const c = page.locator('.card').first(); await c.locator('.chead').click();
  const anims = await page.evaluate(() => document.getAnimations().length);
  ok('prefers-reduced-motion: Karte öffnet ohne Animation', await c.evaluate(e => e.classList.contains('open')) && anims === 0, anims + ' Animationen');
  await ctx.close();
}
// 6b. Erster Besuch: Hilfe als Tutorial, danach nicht mehr; „Zuletzt passiert“ mit letztem Update
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  await serveLocal(ctx, { api: (route, u) => route.fulfill({ contentType: 'application/json', body: u.pathname === '/api/config' ? '{}' : '{"date":"2026-10-12T10:38:19Z"}' }) });
  await ctx.addInitScript(() => { try { localStorage.setItem('adc-install', JSON.stringify({ s: 'done' })); } catch (e) {} });
  const page = await ctx.newPage(); const log = watch(page);
  await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1600);
  ok('Erster Besuch: Hilfe öffnet sich als Tutorial', await page.evaluate(() => document.getElementById('help').open));
  ok('„Zuletzt passiert“ zeigt höchstens 3 Einträge und das letzte Update', await page.evaluate(() => { const n = document.querySelectorAll('#news-list li').length; return n > 0 && n <= 3 && /Letztes Update: 12\. Oktober 2026/.test(document.getElementById('last-update').textContent); }));
  await page.click('#help-close'); await page.waitForTimeout(500);
  ok('„Alles klar“ schließt die Hilfe (animiert)', await page.evaluate(() => !document.getElementById('help').open));
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1600);
  ok('Zweiter Besuch: kein Tutorial mehr', await page.evaluate(() => !document.getElementById('help').open) && !log.some(l => /JS-Fehler/.test(l)), log.join(' | '));
  await ctx.close();
}

await browser.close();

// 7. Safari/iPhone: Kernablauf einmal in WebKit
{
  const wk = await webkit.launch();
  const { ctx, page, log, store } = await setup(wk, { viewport: { width: 375, height: 812 } });
  await page.locator('.card').first().locator('.vote').click();
  await login(page); await page.waitForTimeout(900);
  await page.locator('.card .chead').first().click(); await page.waitForTimeout(900);
  await page.locator('.card.open [data-cform] textarea').fill('WebKit-Kommentar');
  await page.locator('.card.open [data-cform] button').click(); await page.waitForTimeout(900);
  ok('WebKit (iPhone-Breite): Anmelden, Voten, Kommentieren', store.db.votes.length === 1 && store.db.comments.length === 1 && !log.some(l => /JS-Fehler/.test(l)), log.join(' | '));
  await ctx.close(); await wk.close();
}

console.log(results.join('\n'));
console.log(results.filter(r => r.startsWith('FEHLER')).length + ' Fehler von ' + results.length + ' Prüfungen');
