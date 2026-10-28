// Speicher (Supabase). Leer lassen = Konfiguration kommt aus /api/config (Vercel-Env der Supabase-Integration).
// Der Publishable Key ist absichtlich öffentlich; Schreiben prüft den Mitglieder-Code serverseitig.
var SB_URL = '';
var SB_KEY = '';

(function(){
var WA = 'https://chat.whatsapp.com/FXO2e2MOiaY0qElp6SQVUc?mode=gi_t';
var TL = {events:"🎤 Events",members:"👥 Mitglieder",network:"🌍 PR",verein:"🏛️ Verein",jury:"⚖️ Jury"};
var FL = {easy:"🟢 Leicht umsetzbar",medium:"🟡 Mittlerer Aufwand",complex:"🔴 Komplex / langfristig"};
var SL = {idea:"💡 Idee",planned:"📋 Geplant",active:"⚡ In Arbeit",draft:"📝 Entwurf vorbereitet",checked:"🔍 Prüfung abgeschlossen",doing:"✅ Wird gemacht!",live:"🟢 Live, wird getestet",done:"✅ Abgeschlossen"};
var SW = {done:8, doing:7, live:6, active:5, draft:4, checked:3, planned:2, idea:1};
var CHEV = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6l4.5 4.5L12.5 6"/></svg>';
var active = 'all';
var mineOn = false;  // Filter „Für mich“, lässt sich mit den Themen-Filtern kombinieren
var openSet = {};

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function linkify(h){ return h.replace(/(https?:\/\/[^\s<)]+[^\s<).,;:])/g,'<a href="$1" target="_blank" rel="noopener">$1</a>'); }
function slug(s){ return s.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60); }
D.forEach(function(i){ i.id = i.id || slug(i.n); });

// --- Speicher ---
var SB_ON = false; // erst an, wenn der Speicher erreichbar ist
var bumpId = null, HELP = {}, COMM = {}, STEPS = {}, CONTACTS = null, ONLINE = [], VOTES = {}, pendingOpen = null;
var ME = {};
try { ME = JSON.parse(localStorage.getItem('adc-me') || '{}') || {}; } catch(e) {}
function saveMe(){ try { localStorage.setItem('adc-me', JSON.stringify(ME)); } catch(e) {} }
function fmtDate(d){ return new Date(d).toLocaleDateString('de-DE',{day:'numeric',month:'short',year:'numeric'}); }
function sbFetch(path, opt){
  opt = opt || {};
  opt.headers = {apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json'};
  return fetch(SB_URL+'/rest/v1/'+path, opt).catch(function(){
    throw new Error('Keine Verbindung zum Speicher. Bitte prüfe dein Netz und versuch es nochmal.');
  }).then(function(r){
    if (r.ok) return r.status === 204 ? null : r.json();
    return r.json().catch(function(){ return {}; }).then(function(j){ throw new Error(j.message || ('Fehler '+r.status)); });
  });
}
function api(fn, args){
  args.p_code = ME.code;
  return sbFetch('rpc/'+fn, {method:'POST', body:JSON.stringify(args)}).catch(function(err){
    if (/Mitglieder-Code/.test(err.message)) { delete ME.code; saveMe(); }
    throw err;
  });
}
function alertErr(err){ alert('Das hat nicht geklappt: '+err.message); }
function group(rows){ var m = {}; rows.forEach(function(r){ (m[r.ticket] = m[r.ticket] || []).push(r); }); return m; }
function load(){
  if (!SB_URL || !SB_KEY) return Promise.resolve(false);
  return Promise.all([
    sbFetch('helpers?select=ticket,name,created_at&order=created_at'),
    sbFetch('comments?select=id,ticket,name,body,created_at,deleted&order=created_at').catch(function(){ return sbFetch('comments?select=id,ticket,name,body,created_at&order=created_at'); }),
    sbFetch('tickets?select=*&order=created_at').catch(function(){ return []; }),
    sbFetch('step_edits?select=ticket,body,base,name,created_at&order=created_at.desc').catch(function(){ return []; }),
    ME.code ? sbFetch('rpc/get_contacts', {method:'POST', body:JSON.stringify({p_code:ME.code})}).catch(function(){ return null; }) : Promise.resolve(null),
    sbFetch('votes?select=ticket,name').catch(function(){ return []; })
  ]).then(function(r){
    HELP = group(r[0]); COMM = group(r[1].filter(function(c){ return !c.deleted; })); VOTES = group(r[5]);
    ONLINE = r[2].filter(function(t){ return !t.deleted; }).map(function(t){
      return {s:t.s, sektion:t.sektion, e:t.emoji || '💡', n:t.title, v:null, t:t.tags || [], status:'idea', x:t.x || '', body:t.body, id:'neu-'+t.id, online:t};
    });
    STEPS = {}; r[3].forEach(function(e){ if (!STEPS[e.ticket]) STEPS[e.ticket] = e; });
    CONTACTS = r[4];
    if (!SB_ON) { SB_ON = true; initStore(); }
    render(); renderSugg(); bumpId = null;
    if (pendingOpen) { var po = pendingOpen; pendingOpen = null; openTicket(po); }
    return true;
  }).catch(function(e){ console.warn('Speicher nicht erreichbar', e); return false; });
}

// Kontakt zu einem Namen finden: exakter Name, sonst eindeutiger Vorname
// Namen vergleichbar machen: klein, ohne Akzente (André = Andre), einfache Leerzeichen
function norm(n){ return String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim(); }
function contactFor(name){
  if (!CONTACTS) return null;
  var k = norm(name);
  var hit = CONTACTS.filter(function(c){ return norm(c.name) === k; });
  // Fallback: nur Vorname auf einer Seite, z. B. Owner „André“ ↔ Kontakt „André Hennen“ oder umgekehrt
  if (!hit.length) hit = CONTACTS.filter(function(c){
    var cn = norm(c.name);
    return k.indexOf(' ') < 0 ? cn.split(' ')[0] === k : cn.indexOf(' ') < 0 && k.split(' ')[0] === cn;
  });
  return hit.length === 1 ? hit[0] : null;
}
function waLink(p){
  var d = p.replace(/[^0-9+]/g,'');
  d = d.indexOf('+') === 0 ? d.slice(1) : d.indexOf('00') === 0 ? d.slice(2) : d.indexOf('0') === 0 ? '49' + d.slice(1) : d;
  return 'https://wa.me/' + d.replace(/\D/g,'');
}
// Namens-Chip: mit Kontakt klappen beim Hovern bzw. Antippen Mail- und WhatsApp-Icons auf
function nameChip(name, cls, extra){
  var c = contactFor(name);
  if (!c) return '<span class="chip '+cls+'">'+esc(name)+(extra||'')+'</span>';
  var icons = (c.email ? '<a class="ci" href="mailto:'+esc(c.email)+'" title="Mail an '+esc(name)+'" aria-label="Mail an '+esc(name)+'">✉️</a>' : '')
            + (c.phone ? '<a class="ci" href="'+esc(waLink(c.phone))+'" target="_blank" rel="noopener" title="WhatsApp an '+esc(name)+'" aria-label="WhatsApp an '+esc(name)+'">💬</a>' : '');
  return '<span class="chip '+cls+' hasc" tabindex="0">'+esc(name)+'<span class="cis">'+icons+'</span>'+(extra||'')+'</span>';
}
function ownerNames(o){
  return (o || '').replace(/\([^)]*\)/g,'').split(/\s*(?:&|,|\bund\b)\s*/).map(function(x){ return x.trim(); }).filter(Boolean);
}

// Name + Mitglieder-Code einmalig abfragen
var whoCb = null;
function fullName(n){ return String(n||'').trim().split(/\s+/).length >= 2; }
var whoCodeOnly = false;
function whoami(cb, codeOnly){
  if (ME.code && (codeOnly || fullName(ME.name))) return cb();
  whoCb = cb; whoCodeOnly = !!codeOnly;
  var wn = document.getElementById('w-name');
  wn.hidden = whoCodeOnly; wn.required = !whoCodeOnly;
  document.getElementById('w-txt').textContent = whoCodeOnly
    ? 'Für anonyme Ideen reicht der Mitglieder-Code (aus der WhatsApp-Gruppe). Dein Name wird nicht abgefragt.'
    : 'Einmalig Name und Mitglieder-Code (aus der WhatsApp-Gruppe) eingeben. Dein Browser merkt sich beides.';
  wn.value = ME.name || '';
  document.getElementById('w-code').value = ME.code || '';
  var wm = document.getElementById('w-msg');
  var needLast = ME.name && !whoCodeOnly;
  wm.className = 'msg' + (needLast ? ' err' : '');
  wm.textContent = needLast ? 'Bitte ergänze deinen Nachnamen.' : '';
  document.getElementById('who').showModal();
}


// Letztes Update = Datum des letzten Commits im Repo
fetch('/api/updated')
  .then(function(r){ return r.ok ? r.json() : null; })
  .then(function(c){
    if (!c || !c.date) return;
    var d = new Date(c.date);
    document.getElementById('last-update').textContent = 'Letztes Update: ' + d.toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'});
  }).catch(function(){});

// --- Bewegung ----------------------------------------------------------------
var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var EASE = 'cubic-bezier(.32,.72,0,1)';          // iOS-Feder
var EASE_IO = 'cubic-bezier(.45,.05,.2,1)';      // weich an und aus
var lenis = null;
if (!REDUCED && window.Lenis && window.HTMLDialogElement) {
  lenis = new Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true, allowNestedScroll: true });
  // Während ein Dialog offen ist, scrollt die Seite dahinter nicht
  var sm = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function(){ lenis.stop(); this.addEventListener('close', function(){ lenis.start(); }, {once:true}); return sm.apply(this, arguments); };
}
function headerH(){ return document.querySelector('header').offsetHeight; }
function scrollToEl(el){
  if (lenis) lenis.scrollTo(el, {offset: -(headerH() + 12), duration: 1.1});
  else el.scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: 'start'});
}
function scrollByY(dy){
  if (lenis) lenis.scrollTo(window.scrollY + dy, {duration: 0.9});
  else window.scrollBy({top: dy, behavior: REDUCED ? 'auto' : 'smooth'});
}
// Akkordeon: Höhe weich animieren
function setOpen(el, o){
  var b = el.querySelector('.cbody'), pad = b.querySelector('.cpad');
  b.getAnimations().concat(pad.getAnimations()).forEach(function(a){ a.cancel(); });
  if (REDUCED) { el.classList.toggle('open', o); return; }
  if (o) {
    el.classList.add('open');
    var h = b.scrollHeight;
    b.animate([{height:'0px'},{height:h+'px'}], {duration: Math.min(650, 380 + h * 0.25), easing: EASE_IO});
    pad.animate([{opacity:0, transform:'translateY(-8px)'},{opacity:1, transform:'none'}], {duration: 480, delay: 90, easing: EASE, fill: 'backwards'});
  } else {
    var h2 = b.offsetHeight;
    pad.animate([{opacity:1},{opacity:0}], {duration: 220, easing: 'ease-out', fill: 'forwards'});
    var d = Math.min(520, 300 + h2 * 0.2), done = false;
    var fin = function(){ if (done || openSet[el.id]) return; done = true; el.classList.remove('open'); b.getAnimations().concat(pad.getAnimations()).forEach(function(x){ x.cancel(); }); };
    b.animate([{height:h2+'px'},{height:'0px'}], {duration: d, easing: EASE_IO, fill: 'forwards'}).onfinish = fin;
    setTimeout(fin, d + 80);
  }
}
// Filterwechsel: bleibende Karten gleiten an ihren neuen Platz, neue blenden ein, wegfallende blenden aus
function flipRender(){
  if (REDUCED) return render();
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var keep = {}; filtered().forEach(function(i){ keep[i.id] = 1; });
  var leaving = cards.filter(function(c){ return !keep[c.id]; });
  var first = {}; cards.forEach(function(c){ first[c.id] = c.getBoundingClientRect(); });
  var go = function(){
    render();
    var k = 0;
    document.querySelectorAll('.card, .group-title').forEach(function(c){
      var f = c.id && first[c.id];
      if (f) {
        var l = c.getBoundingClientRect(), dx = f.left - l.left, dy = f.top - l.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) c.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}], {duration: 560, easing: EASE});
      } else {
        c.animate([{opacity:0, transform:'translateY(10px) scale(.98)'},{opacity:1, transform:'none'}], {duration: 460, delay: Math.min(k++, 12) * 22, easing: EASE, fill: 'backwards'});
      }
    });
  };
  if (!leaving.length) return go();
  var anims = leaving.map(function(c){ return c.animate([{opacity:1, transform:'none'},{opacity:0, transform:'scale(.97)'}], {duration: 170, easing: 'ease-in', fill: 'forwards'}); });
  document.querySelectorAll('.group-title').forEach(function(t){ t.animate([{opacity:1},{opacity:0}], {duration: 170, fill: 'forwards'}); });
  var ran = false, once = function(){ if (!ran) { ran = true; go(); } };
  anims[0].onfinish = once;
  setTimeout(once, 240);
}

function all(){ return D.concat(ONLINE); }
// Bin ich verantwortlich, mache mit oder habe die Idee angelegt?
function isMine(i){
  var me = norm(ME.name);
  if (!me) return false;
  return ownerNames(i.owner).some(function(n){ return norm(n) === me; })
    || (HELP[i.id] || []).some(function(h){ return norm(h.name) === me; })
    || (!!i.online && norm(i.online.created_by) === me);
}
function syncMine(){
  if (!ME.name) mineOn = false;
  var b = document.getElementById('mine-btn'), n = ME.name ? all().filter(isMine).length : 0;
  b.classList.toggle('on', mineOn);
  b.setAttribute('aria-pressed', mineOn ? 'true' : 'false');
  document.getElementById('mine-n').textContent = ME.name ? ' · ' + n : '';
}
function votes(i){ return (i.v || 0) + (VOTES[i.id] || []).length; }
function filtered(){
  var A = all();
  var r = active === 'all' ? A :
          active === 'antrag' ? A.filter(function(i){ return !!i.antrag; }) :
          (active === 'Hamburg' || active === 'Berlin') ? A.filter(function(i){ return (i.sektion || '').split(' & ').indexOf(active) >= 0; }) :
          A.filter(function(i){ return i.t.indexOf(active) >= 0; });
  if (mineOn) r = r.filter(isMine);
  return r.sort(function(a,b){
    if (a.prio && !b.prio) return -1;
    if (!a.prio && b.prio) return 1;
    var sa = SW[a.status||'idea']||0, sb = SW[b.status||'idea']||0;
    if (sa !== sb) return sb - sa;
    var va = votes(a), vb = votes(b);
    if (va !== vb) return vb - va;
    var oa = (a.owner || (HELP[a.id]||[]).length)?1:0, ob = (b.owner || (HELP[b.id]||[]).length)?1:0;
    return ob - oa;
  });
}

function bullets(text, splitter){
  var items = splitter === '|' ? text.split(' | ') : text.indexOf('\n') >= 0 ? text.split('\n').map(function(l){ return l.replace(/^\s*(\d+\.|[-•*])\s*/,''); }) : text.split(/\d+\.\s+/);
  items = items.map(function(s){ return s.trim().replace(/[;,]$/,''); }).filter(Boolean);
  if (splitter !== '|' && items.length <= 1) items = text.split(/;\s+/).map(function(s){ return s.trim(); }).filter(Boolean);
  if (items.length <= 1) return '<p>'+linkify(esc(text))+'</p>';
  return '<ul>'+items.map(function(s){ return '<li>'+linkify(esc(s))+'</li>'; }).join('')+'</ul>';
}

function mkcard(i){
  var st = i.status || 'idea';
  var el = document.createElement('article');
  el.className = 'card' + (i.prio ? ' prio' : '') + (openSet[i.id] ? ' open' : '');
  el.id = i.id;
  var badges = (i.prio ? '<span class="pill pill-prio">PRIO</span>' : '')
    + '<span class="pill st-'+st+'">'+SL[st]+'</span>'
    + (i.antrag ? '<span class="pill pill-antrag">📄 Antrag</span>' : '')
    + (i.online && Date.now() - new Date(i.online.created_at) < 14*864e5 ? '<span class="pill pill-new">🆕 Neu</span>' : '');
  var vl = VOTES[i.id] || [], myVote = vl.some(function(x){ return norm(x.name) === norm(ME.name); }), vn = votes(i);
  var vtitle = (i.v ? i.v+' aus der Sli.do-Sammlung' : '') + (i.v && vl.length ? ' + ' : '') + (vl.length ? vl.length+' online' : '') || 'Noch keine Stimmen';
  var vote = SB_ON
    ? '<button class="vote'+(myVote ? ' on' : '')+(bumpId === i.id && myVote ? ' bump' : '')+'" data-vote="1" title="'+esc(vtitle)+(myVote ? ' · Klick nimmt deine Stimme zurück' : ' · Hochvoten')+'" aria-pressed="'+myVote+'">▲ '+vn+'</button>'
    : (vn ? '<span class="vote" title="'+esc(vtitle)+'">▲ '+vn+'</span>' : '');
  var hl = HELP[i.id] || [], cl = COMM[i.id] || [];
  var owner = i.owner ? '<span>👤 '+esc(i.owner)+'</span>' : (hl.length ? '' : '<span class="owner-open">👤 Noch offen</span>');
  if (hl.length) owner += '<span>🙋 '+esc(hl.map(function(h){ return h.name; }).join(', '))+'</span>';
  if (cl.length) owner += '<span>💬 '+cl.length+'</span>';
  var sek = i.sektion ? '<span>📍 '+esc(i.sektion)+'</span>' : '';
  var tags = i.t.map(function(t){ return TL[t]; }).join(' · ');

  var body = '';
  if (!i.owner && !hl.length) body += '<div class="sec"><div class="helpbox"><span>Noch niemand verantwortlich. Lust, das zu übernehmen?</span>'+(SB_ON ? '<button data-join="1">🙋 Ich übernehme</button>' : '<a href="'+WA+'" target="_blank" rel="noopener">💬 Melde dich</a>')+'</div></div>';
  else if (SB_ON) {
    var me = norm(ME.name);
    var mine = hl.some(function(h){ return norm(h.name) === me; });
    body += '<div class="sec"><div class="lbl">🙋 Wer kümmert sich</div><div class="chips">'
      + ownerNames(i.owner).map(function(n){ return nameChip(n, 'own'); }).join('')
      + hl.map(function(h){ return nameChip(h.name, '', norm(h.name) === me ? '<button data-leave="1" title="Austragen" aria-label="Austragen">×</button>' : ''); }).join('')
      + (mine ? '' : '<button class="minibtn" data-join="1">🙋 Ich mach mit</button>')
      + (CONTACTS ? '' : '<button class="linkbtn" data-unlock="1">🔒 Kontakte anzeigen</button>') + '</div>'
      + (CONTACTS && !ownerNames(i.owner).concat(hl.map(function(h){ return h.name; })).some(contactFor)
          ? '<div class="edited">Noch keine Kontaktdaten hinterlegt. Eintragen kann man sie oben über „📱 Mein Kontakt“.</div>' : '')
      + '</div>';
  }
  var se = STEPS[i.id] && STEPS[i.id].base === i.x ? STEPS[i.id] : null;
  var steps = se ? se.body : i.x;
  var items = stepItems(steps), openS = items.filter(function(s){ return !s.done; }), doneS = items.filter(function(s){ return s.done; });
  var canTick = SB_ON && !i.online;
  if (i.body) body += '<div class="sec"><div class="lbl">📝 Beschreibung</div><div class="txt"><p style="white-space:pre-wrap">'+linkify(esc(i.body))+'</p></div></div>';
  body += '<div class="sec" data-steps="1"><div class="lbl-row"><div class="lbl">👉 Nächste Schritte</div>'+(SB_ON && !i.online ? '<button class="copy" data-edit="1">✏️ Bearbeiten</button>' : '')+'</div><div class="txt">'
    + (openS.length ? (canTick ? todoList(openS, items, true) : bullets(openS.map(stepLine).join('\n'))) : '<p class="by">'+(doneS.length ? 'Alles erledigt.' : 'Noch keine.')+' Ergänze sie über „'+(canTick ? 'Bearbeiten' : 'Idee bearbeiten')+'“.</p>')+'</div>'
    + (se ? '<div class="edited">Bearbeitet von '+esc(se.name)+' · '+fmtDate(se.created_at)+'</div>' : '') + '</div>';
  if (i.rahmen) body += '<div class="sec"><div class="lbl">🎯 Leitlinien</div><div class="txt">'+bullets(i.rahmen,'|')+'</div></div>';
  if (i.bisher || doneS.length) body += '<div class="sec"><div class="lbl">✅ Bisher passiert</div><div class="txt">'+(i.bisher ? bullets(i.bisher,'|') : '')+(doneS.length ? todoList(doneS, items, canTick) : '')+'</div></div>';
  if (i.antrag) body += '<div class="sec"><div class="lbl-row"><div class="lbl">📄 JHV-Antrag (Entwurf)</div><button class="copy" data-copy="1">Text kopieren</button></div><div class="antrag" data-lenis-prevent aria-label="JHV-Antrag (Entwurf): '+esc(i.n)+'">'+esc(i.antrag)+'</div></div>';
  if (i.f || tags) body += '<div class="sec"><div class="lbl">'+(i.f ? '⏱️ Aufwand' : '🏷️ Themen')+'</div>'+(i.f ? '<span class="pill ef-'+i.f+'">'+FL[i.f]+'</span>' : '')+(tags ? '<span class="txt" style="'+(i.f ? 'margin-left:10px;' : '')+'font-size:13px">'+tags+'</span>' : '')+'</div>';
  if (i.orig) body += '<div class="sec"><div class="lbl">💬 Originalidee(n)</div><div class="quote" data-lenis-prevent aria-label="Originalidee: '+esc(i.n)+'">'+linkify(esc(i.orig))+'</div></div>';
  if (SB_ON) body += '<div class="sec"><div class="lbl">💬 Notizen & Kommentare</div>'
    + (cl.length ? '<div class="clist">'+cl.map(function(c){ return '<div class="cm"><span class="by"><b>'+esc(c.name)+'</b> · '+fmtDate(c.created_at)+(c.id ? '<button class="cdel" data-cdel="'+(+c.id)+'" title="Kommentar löschen" aria-label="Kommentar löschen">🗑️</button>' : '')+'</span><p>'+linkify(esc(c.body))+'</p></div>'; }).join('')+'</div>' : '')
    + '<form class="cform" data-cform="1"><textarea maxlength="2000" placeholder="Notiz oder Kommentar …" required></textarea><button class="minibtn" type="submit">Speichern</button></form></div>';
  if (i.online) body += '<div class="sec edited">Angelegt von '+esc(i.online.created_by)+' · '+fmtDate(i.online.created_at)
    + (i.online.updated_by ? ' · zuletzt bearbeitet von '+esc(i.online.updated_by)+' · '+fmtDate(i.online.updated_at) : '')
    + (SB_ON ? ' · <button class="linkbtn" data-tedit="1">✏️ Idee bearbeiten</button> · <button class="linkbtn" data-tdel="1">🗑️ Löschen</button>' : '') + '</div>';
  body += '<button class="permalink" data-link="1">🔗 Link zu dieser Idee kopieren</button>';

  el.innerHTML =
    '<button class="chead" aria-expanded="'+(openSet[i.id]?'true':'false')+'">'
      + '<div class="badges">'+badges+'</div>'
      + '<div class="ctitle"><span class="cemoji">'+esc(i.e)+'</span><span class="cname">'+esc(i.n)+'</span><span class="chev">'+CHEV+'</span></div>'
      + '<div class="cmeta">'+owner+sek+'</div>'
    + '</button>'
    + vote
    + '<div class="cbody"><div class="cin"><div class="cpad">'+body+'</div></div></div>';

  el.querySelector('.chead').addEventListener('click', function(){
    var o = !openSet[i.id];
    // Beim Zuklappen einer langen Karte den Kopf im Blick behalten, statt den Inhalt wegspringen zu lassen
    var top = el.getBoundingClientRect().top, bar = headerH() + 8;
    if (!o && top < bar) scrollByY(top - bar - 4);
    setOpen(el, o);
    if (o) markScroll(el);
    this.setAttribute('aria-expanded', o ? 'true' : 'false');
    if (o) openSet[i.id] = 1; else delete openSet[i.id];
    syncToggle();
  });
  var cb = el.querySelector('[data-copy]');
  if (cb) cb.addEventListener('click', function(){
    copy(i.antrag, cb, 'Text kopieren');
  });
  var jb = el.querySelector('[data-join]');
  if (jb) jb.addEventListener('click', function(){
    whoami(function(){ jb.disabled = true; api('add_helper', {p_ticket:i.id, p_name:ME.name}).then(load, function(err){ jb.disabled = false; alertErr(err); }); });
  });
  var lb = el.querySelector('[data-leave]');
  if (lb) lb.addEventListener('click', function(){
    if (!confirm('Bei „'+i.n+'“ austragen?')) return;
    api('remove_helper', {p_ticket:i.id, p_name:ME.name}).then(load, alertErr);
  });
  var vb = el.querySelector('[data-vote]');
  if (vb) vb.addEventListener('click', function(){
    whoami(function(){ vb.disabled = true; bumpId = i.id; api('toggle_vote', {p_ticket:i.id, p_name:ME.name}).then(load, function(err){ vb.disabled = false; alertErr(err); }); });
  });
  var te = el.querySelector('[data-tedit]');
  if (te) te.addEventListener('click', function(){ openForm(i); });
  var ub = el.querySelector('[data-unlock]');
  if (ub) ub.addEventListener('click', function(){ whoami(load); });
  var eb = el.querySelector('[data-edit]');
  if (eb) eb.addEventListener('click', function(){
    var sec = el.querySelector('[data-steps]');
    var cur = bulletsPlain(steps);
    sec.innerHTML = '<div class="lbl">👉 Nächste Schritte bearbeiten</div><form class="sform"><textarea maxlength="3000" placeholder="Ein Schritt pro Zeile"></textarea>'
      + '<div class="form-row"><button class="minibtn" type="submit">Speichern</button><button class="linkbtn" type="button" data-cancel="1">Abbrechen</button><span class="msg">Ein Schritt pro Zeile</span></div></form>';
    var ta = sec.querySelector('textarea'); ta.value = cur; ta.focus();
    sec.querySelector('[data-cancel]').addEventListener('click', function(){ sec.innerHTML = ''; render(); });
    sec.querySelector('form').addEventListener('submit', function(e){
      e.preventDefault();
      var v = ta.value.split('\n').map(function(l){ return l.trim(); }).filter(Boolean).join('\n');
      if (v.length < 3) return;
      whoami(function(){
        var sb2 = sec.querySelector('button[type=submit]'); sb2.disabled = true;
        api('set_next_steps', {p_ticket:i.id, p_name:ME.name, p_body:v, p_base:i.x}).then(function(){ sec.innerHTML = ''; return load(); }, function(err){ sb2.disabled = false; alertErr(err); });
      });
    });
  });
  Array.prototype.forEach.call(el.querySelectorAll('[data-tick]'), function(cb){
    cb.addEventListener('change', function(){
      var want = cb.checked; cb.checked = !want;
      whoami(function(){
        var it = stepItems(steps), s = it[+cb.dataset.tick]; if (!s) return;
        s.done = want; s.by = want ? ME.name : ''; s.at = want ? new Date().toLocaleDateString('de-DE') : '';
        cb.checked = want; cb.disabled = true;
        api('set_next_steps', {p_ticket:i.id, p_name:ME.name, p_body:it.map(stepLine).join('\n'), p_base:i.x}).then(load, function(err){ cb.checked = !want; cb.disabled = false; alertErr(err); });
      });
    });
  });
  Array.prototype.forEach.call(el.querySelectorAll('[data-cdel]'), function(b){
    b.addEventListener('click', function(){
      if (!confirm('Kommentar löschen? Er bleibt 30 Tage im Papierkorb (unten auf der Seite) und lässt sich dort wiederherstellen.')) return;
      whoami(function(){ b.disabled = true; api('delete_comment', {p_name:ME.name, p_id:+b.dataset.cdel}).then(afterTrash, function(err){ b.disabled = false; alertErr(err); }); });
    });
  });
  var td = el.querySelector('[data-tdel]');
  if (td) td.addEventListener('click', function(){
    if (!confirm('Idee „'+i.n+'“ löschen? Sie bleibt 30 Tage im Papierkorb (unten auf der Seite) und lässt sich dort wiederherstellen.')) return;
    whoami(function(){ td.disabled = true; api('delete_ticket', {p_name:ME.name, p_id:i.online.id}).then(afterTrash, function(err){ td.disabled = false; alertErr(err); }); });
  });
  var cf = el.querySelector('[data-cform]');
  if (cf) cf.addEventListener('submit', function(e){
    e.preventDefault();
    var ta = cf.querySelector('textarea'), txt = ta.value.trim();
    if (!txt) return;
    whoami(function(){
      cf.querySelector('button').disabled = true;
      api('add_comment', {p_ticket:i.id, p_name:ME.name, p_body:txt}).then(function(){ ta.value = ''; return load(); }, function(err){ cf.querySelector('button').disabled = false; alertErr(err); });
    });
  });
  var pl = el.querySelector('[data-link]');
  pl.addEventListener('click', function(){
    copy(location.origin + location.pathname + '#' + i.id, pl, '🔗 Link zu dieser Idee kopieren');
  });
  return el;
}

// Lange Antrags- und Zitatfelder scrollen in sich: dann per Tastatur erreichbar machen
function markScroll(card){
  Array.prototype.forEach.call(card.querySelectorAll('.antrag, .quote'), function(s){
    if (s.scrollHeight > s.clientHeight + 1) { s.tabIndex = 0; s.setAttribute('role', 'region'); }
  });
}

// Text der Nächsten Schritte als eine Zeile pro Schritt (für das Bearbeitungsfeld)
// Nächste Schritte als To-dos: erledigte Zeilen beginnen mit „✓“, dahinter optional „(erledigt: Name, TT.MM.JJJJ)“
var DONE_RE = /^✓\s*(.*?)(?:\s+\(erledigt: (.+?), (\d{1,2}\.\d{1,2}\.\d{4})\))?$/;
function stepItems(text){
  if (!text) return [];
  return bulletsPlain(text).split('\n').map(function(l){ return l.replace(/^\s*(\d+\.|[-•*])\s+/,'').trim(); }).filter(Boolean).map(function(l){
    var m = l.match(DONE_RE);
    return m ? {t:m[1], done:true, by:m[2]||'', at:m[3]||''} : {t:l, done:false};
  });
}
function stepLine(s){ return s.done ? '✓ '+s.t+(s.by ? ' (erledigt: '+s.by+', '+s.at+')' : '') : s.t; }
function todoList(items, all, tick){
  return '<ul class="todo">'+items.map(function(s){
    var k = all.indexOf(s);
    return '<li'+(s.done ? ' class="done"' : '')+'>'
      + (tick ? '<span class="tick"><input type="checkbox" data-tick="'+k+'"'+(s.done ? ' checked' : '')+' aria-label="'+esc((s.done ? 'Wieder offen: ' : 'Erledigt: ')+s.t)+'"><span aria-hidden="true"></span></span>' : '<span class="tick" aria-hidden="true">'+(s.done ? '✓' : '')+'</span>')
      + '<span>'+linkify(esc(s.t))+(s.done && s.by ? ' <span class="by">· '+esc(s.by)+', '+esc(s.at)+'</span>' : '')+'</span></li>';
  }).join('')+'</ul>';
}

function bulletsPlain(text){
  var items = text.indexOf('\n') >= 0 ? text.split('\n') : text.split(/\d+\.\s+/);
  items = items.map(function(s){ return s.trim().replace(/[;,]$/,''); }).filter(Boolean);
  if (items.length <= 1) items = text.split(/;\s+/).map(function(s){ return s.trim(); }).filter(Boolean);
  return items.join('\n');
}

function copy(text, btn, label){
  var done = function(){ btn.textContent = '✓ Kopiert'; setTimeout(function(){ btn.textContent = label; }, 2000); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function(){ fallback(text); done(); });
  } else { fallback(text); done(); }
}
function fallback(text){
  var ta = document.createElement('textarea'); ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} document.body.removeChild(ta);
}

function fill(container, list){
  container.innerHTML = '';
  if (!list.length) { container.innerHTML = '<div class="empty">' + (mineOn ? 'Hier bist du noch bei keiner Idee dabei.' : 'Keine Ideen für diesen Filter.') + '</div>'; return; }
  var moving = list.filter(function(i){ return (i.status||'idea') !== 'idea'; });
  var ideas = list.filter(function(i){ return (i.status||'idea') === 'idea'; });
  [['🚀 Läuft schon', moving], ['💡 Ideen – suchen Mitstreiter:innen', ideas]].forEach(function(g){
    if (!g[1].length) return;
    var h = document.createElement('h3'); h.className = 'group-title'; h.textContent = g[0] + ' (' + g[1].length + ')';
    var wrap = document.createElement('div'); wrap.className = 'cards';
    g[1].forEach(function(i){ wrap.appendChild(mkcard(i)); });
    container.appendChild(h); container.appendChild(wrap);
  });
}

// Ungespeicherte Texte (Kommentar-Entwürfe, offene „Nächste Schritte“-Bearbeitung) überleben das Neuzeichnen
function keepDrafts(){
  var d = [];
  document.querySelectorAll('.card').forEach(function(c){
    var t = c.querySelector('[data-cform] textarea'), e = c.querySelector('.sform textarea');
    if ((t && t.value) || e) d.push({id:c.id, c:t ? t.value : '', e:e ? e.value : null});
  });
  return function(){
    d.forEach(function(x){
      var c = document.getElementById(x.id); if (!c) return;
      var t = c.querySelector('[data-cform] textarea'); if (t && x.c) t.value = x.c;
      var eb = c.querySelector('[data-edit]');
      if (x.e !== null && eb) { eb.click(); var e = c.querySelector('.sform textarea'); if (e) e.value = x.e; }
    });
  };
}
function unsaved(){
  if (document.querySelector('dialog[open], .sform')) return true;
  if (!document.getElementById('suggest').hidden || !document.getElementById('profile').hidden) return true;
  return Array.prototype.some.call(document.querySelectorAll('.card textarea'), function(t){ return !!t.value; });
}
// „Zuletzt passiert“: inhaltliche Updates aus UP (data.js), neue Online-Ideen und abgehakte Schritte, die neuesten 3
function newsItems(){
  var r = [], byId = {};
  all().forEach(function(i){ byId[i.id] = i; });
  (typeof UP !== 'undefined' ? UP : []).forEach(function(u){ if (byId[u.id]) r.push({at:new Date(u.d+'T12:00:00'), i:byId[u.id], t:u.t}); });
  ONLINE.forEach(function(i){ r.push({at:new Date(i.online.created_at), i:i, t:'Neue Idee von '+i.online.created_by}); });
  D.forEach(function(i){
    var se = STEPS[i.id] && STEPS[i.id].base === i.x ? STEPS[i.id] : null;
    if (se) stepItems(se.body).forEach(function(s){
      var m = s.done && s.at.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (m) r.push({at:new Date(+m[3], m[2]-1, +m[1], 12), i:byId[i.id], t:'Erledigt: '+s.t+(s.by ? ' ('+s.by+')' : '')});
    });
  });
  return r.filter(function(x){ return x.i && !isNaN(x.at); }).sort(function(a,b){ return b.at - a.at; }).slice(0,3);
}
function renderNews(){
  var n = newsItems(), box = document.getElementById('news');
  box.hidden = !n.length;
  document.getElementById('news-list').innerHTML = n.map(function(x){
    return '<li><span class="news-d">'+esc(x.at.toLocaleDateString('de-DE',{day:'numeric',month:'short'}))+'</span><span><a href="#'+esc(x.i.id)+'">'+esc(x.i.e+' '+x.i.n.replace(/\s*\(.*\)\s*$/,''))+'</a> · '+esc(x.t)+'</span></li>';
  }).join('');
}

function render(){
  var restore = keepDrafts();
  renderNews();
  var v = filtered();
  var hh = v.filter(function(i){ return i.s === 'hh'; });
  var jhv = v.filter(function(i){ return i.s === 'jhv'; });
  document.getElementById('hc').textContent = hh.length + (hh.length === 1 ? ' Idee' : ' Ideen');
  document.getElementById('jc').textContent = jhv.length + (jhv.length === 1 ? ' Idee' : ' Ideen');
  fill(document.getElementById('chh'), hh);
  fill(document.getElementById('cjhv'), jhv);
  Array.prototype.forEach.call(document.querySelectorAll('.card.open'), markScroll);
  syncToggle();
  syncMine();
  restore();
}

// „Alle aufklappen" gilt je Spalte (Sektionen / Gesamtverein)
function colCards(col){ return document.querySelectorAll('#c' + col + ' .card'); }
function colOpen(col){ var c = colCards(col); return c.length > 0 && Array.prototype.every.call(c, function(x){ return x.classList.contains('open'); }); }
function syncToggle(){
  Array.prototype.forEach.call(document.querySelectorAll('.toggle-all'), function(b){
    var c = colCards(b.dataset.col);
    b.hidden = !c.length;
    b.textContent = colOpen(b.dataset.col) ? 'Alle zuklappen' : 'Alle aufklappen';
  });
}

Array.prototype.forEach.call(document.querySelectorAll('.toggle-all'), function(b){
  b.addEventListener('click', function(){
    var col = b.dataset.col, close = colOpen(col);
    filtered().forEach(function(i){ if (i.s !== col) return; if (close) delete openSet[i.id]; else openSet[i.id] = 1; });
    render();
  });
});

document.getElementById('frow').addEventListener('click', function(e){
  var b = e.target.closest('.fb');
  if (!b) return;
  active = b.dataset.t;
  document.querySelectorAll('.fb').forEach(function(x){ x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
  flipRender();
});

document.getElementById('mine-btn').addEventListener('click', function(){
  if (mineOn) { mineOn = false; return flipRender(); }
  whoami(function(){ mineOn = true; flipRender(); });
});

function openFromHash(){
  var id = decodeURIComponent(location.hash.slice(1));
  if (!id || id === 'vorschlag') return;
  openTicket(id);
}
function openTicket(id){
  var t = all().filter(function(i){ return i.id === id; })[0];
  if (!t) { if (/^neu-/.test(id)) pendingOpen = id; return; }
  openSet[id] = 1;
  render();
  var el = document.getElementById(id);
  if (el) setTimeout(function(){ scrollToEl(el); }, 50);
  // Anker wieder aus der URL nehmen, sonst startet das Ticket bei Reload, Lesezeichen oder Homescreen-App immer aufgeklappt
  if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
}

function renderSugg(){
  var sb = document.getElementById('suggest-btn');
  if (SB_ON) sb.textContent = '💡 Neue Idee';
  var w = document.getElementById('whoami');
  w.innerHTML = ME.name ? 'Du schreibst als <b>'+esc(ME.name)+'</b> · <button type="button" id="w-reset">Nicht du?</button>' : '';
  var rb = document.getElementById('w-reset');
  if (rb) rb.addEventListener('click', function(){ ME = {}; saveMe(); renderSugg(); render(); });
}

// Papierkorb: nur mit Mitglieder-Code lesbar, 30 Tage, wiederherstellbar
function trashOpen(){ return !document.getElementById('trash-list').hidden; }
// Footer: Changelog und Papierkorb klappen unter der festen Button-Zeile auf, immer nur eins
function footToggle(which, open){
  [['cl','cl-btn','cl-list'],['trash','trash-btn','trash-list']].forEach(function(x){
    var on = x[0] === which && open;
    document.getElementById(x[2]).hidden = !on;
    document.getElementById(x[1]).setAttribute('aria-expanded', on ? 'true' : 'false');
  });
}
function afterTrash(){ if (trashOpen()) loadTrash(); return load(); }
function loadTrash(){
  var ul = document.getElementById('trash-list');
  ul.innerHTML = '<li>Lade …</li>';
  sbFetch('rpc/get_trash', {method:'POST', body:JSON.stringify({p_code:ME.code})}).then(function(t){
    var names = {}; all().forEach(function(i){ names[i.id] = i.n; });
    var rows = (t.tickets || []).map(function(x){ return {k:'ticket', id:x.id, at:x.deleted_at,
        html:'<b>💡 Idee:</b> '+esc(x.emoji || '')+' '+esc(x.title)+(x.body ? '<p>'+esc(x.body)+'</p>' : '<br>')
           + '<span class="by">Angelegt von '+esc(x.created_by)+' · gelöscht von '+esc(x.deleted_by || 'Unbekannt')+' am '+fmtDate(x.deleted_at)+'</span>'}; })
      .concat((t.comments || []).map(function(x){ return {k:'comment', id:x.id, at:x.deleted_at,
        html:'<b>💬 Kommentar</b> von '+esc(x.name)+' zu „'+esc(names[x.ticket] || x.ticket)+'“<p>'+esc(x.body)+'</p>'
           + '<span class="by">Gelöscht von '+esc(x.deleted_by || 'Unbekannt')+' am '+fmtDate(x.deleted_at)+'</span>'}; }))
      .sort(function(a,b){ return a.at < b.at ? 1 : -1; });
    ul.innerHTML = rows.length ? rows.map(function(r){
      return '<li>'+r.html+' · <button class="linkbtn" data-restore="'+r.k+':'+(+r.id)+'">↩︎ Wiederherstellen</button></li>';
    }).join('') + '<li class="by" style="background:none;padding:0 2px">Gelöschtes wird nach 30 Tagen endgültig entfernt.</li>'
      : '<li>Der Papierkorb ist leer. Gelöschte Ideen und Kommentare bleiben hier 30 Tage.</li>';
    Array.prototype.forEach.call(ul.querySelectorAll('[data-restore]'), function(b){
      b.addEventListener('click', function(){
        var p = b.dataset.restore.split(':'); b.disabled = true;
        api(p[0] === 'ticket' ? 'restore_ticket' : 'restore_comment', {p_id:+p[1]}).then(afterTrash, function(err){ b.disabled = false; alertErr(err); });
      });
    });
  }, function(err){
    if (/Mitglieder-Code/.test(err.message)) { delete ME.code; saveMe(); }
    ul.innerHTML = '<li class="msg err">'+esc(err.message)+'</li>';
  });
}

// Formular für neues bzw. bestehendes Online-Ticket öffnen
var editing = null;
function openForm(t){
  editing = t;
  var f = document.getElementById('sform'), p = document.getElementById('suggest');
  f.reset();
  document.getElementById('s-head').textContent = t ? '✏️ Idee bearbeiten' : '💡 Neue Idee';
  document.getElementById('s-del').hidden = !t;
  document.getElementById('s-anon-row').hidden = !!t;
  document.getElementById('s-msg').textContent = '';
  document.getElementById('s-emoji').value = t ? t.e : '💡';
  document.getElementById('s-title').value = t ? t.n : '';
  document.getElementById('s-body').value = t && t.body || '';
  document.getElementById('s-x').value = t && t.x || '';
  f.querySelector('[name=s-s][value="'+(t ? t.s : 'hh')+'"]').checked = true;
  f.querySelector('[name=s-sek][value="'+(t && t.sektion || '')+'"]').checked = true;
  Array.prototype.forEach.call(f.querySelectorAll('[name=s-t]'), function(c){ c.checked = !!t && t.t.indexOf(c.value) >= 0; });
  p.hidden = false;
  scrollToEl(p);
  document.getElementById('s-title').focus({preventScroll:true});
}

function initStore(){
  document.getElementById('mrow').hidden = false;
  var tb = document.getElementById('trash-btn');
  tb.hidden = false;
  tb.addEventListener('click', function(){
    if (trashOpen()) return footToggle('trash', false);
    whoami(function(){ footToggle('trash', true); loadTrash(); }, true);
  });
  var sbtn = document.getElementById('suggest-btn');
  sbtn.removeAttribute('target'); sbtn.href = '#vorschlag';
  sbtn.addEventListener('click', function(e){
    e.preventDefault();
    var p = document.getElementById('suggest');
    if (!p.hidden && !editing) { p.hidden = true; return; }
    openForm(null);
  });
  document.getElementById('s-cancel').addEventListener('click', function(){ document.getElementById('suggest').hidden = true; editing = null; });
  document.getElementById('sform').addEventListener('submit', function(e){
    e.preventDefault();
    var f = document.getElementById('sform'), m = document.getElementById('s-msg');
    var title = document.getElementById('s-title').value.trim();
    if (title.length < 3) { m.className = 'msg err'; m.textContent = 'Bitte einen Titel mit mindestens 3 Zeichen.'; return; }
    var args = {
      p_s: f.querySelector('[name=s-s]:checked').value,
      p_sektion: f.querySelector('[name=s-sek]:checked').value,
      p_emoji: document.getElementById('s-emoji').value,
      p_title: title,
      p_body: document.getElementById('s-body').value,
      p_x: document.getElementById('s-x').value.split('\n').map(function(l){ return l.trim(); }).filter(Boolean).join('\n'),
      p_tags: Array.prototype.map.call(f.querySelectorAll('[name=s-t]:checked'), function(c){ return c.value; })
    };
    var anon = !editing && document.getElementById('s-anon').checked;
    whoami(function(){
      args.p_name = anon ? 'Anonym' : ME.name;
      m.className = 'msg'; m.textContent = 'Speichere …';
      var isEdit = !!editing, sbm = document.getElementById('s-submit');
      if (sbm.disabled) return;
      sbm.disabled = true;
      if (isEdit) args.p_id = editing.online.id;
      api(isEdit ? 'update_ticket' : 'create_ticket', args).then(function(newId){
        var id = isEdit ? editing.id : 'neu-' + newId;
        editing = null; sbm.disabled = false;
        document.getElementById('suggest').hidden = true;
        m.textContent = '';
        return load().then(function(){ openTicket(id); });
      }, function(err){ sbm.disabled = false; m.className = 'msg err'; m.textContent = err.message; });
    }, anon);
  });
  document.getElementById('s-del').addEventListener('click', function(){
    if (!editing || !confirm('Idee „'+editing.n+'“ löschen? Sie bleibt 30 Tage im Papierkorb (unten auf der Seite) und lässt sich dort wiederherstellen.')) return;
    var t = editing;
    whoami(function(){
      api('delete_ticket', {p_name:ME.name, p_id:t.online.id}).then(function(){
        editing = null; document.getElementById('suggest').hidden = true; afterTrash();
      }, alertErr);
    });
  });
  var pb = document.getElementById('profile-btn');
  pb.hidden = false;
  pb.addEventListener('click', function(){
    whoami(function(){
      var p = document.getElementById('profile');
      p.hidden = !p.hidden;
      if (p.hidden) return;
      var c = CONTACTS && (CONTACTS.filter(function(x){ return norm(x.name) === norm(ME.name); })[0]
                        || (ME.oldName && CONTACTS.filter(function(x){ return norm(x.name) === norm(ME.oldName); })[0]));
      document.getElementById('p-email').value = c && c.email || '';
      document.getElementById('p-phone').value = c && c.phone || '';
      document.getElementById('p-del').hidden = !c;
      document.getElementById('p-msg').textContent = 'Gespeichert unter: ' + ME.name;
      document.getElementById('p-msg').className = 'msg';
    });
  });
  document.getElementById('pform').addEventListener('submit', function(e){
    e.preventDefault();
    var m = document.getElementById('p-msg');
    var em = document.getElementById('p-email').value.trim(), ph = document.getElementById('p-phone').value.trim();
    if (!em && !ph) { m.className = 'msg err'; m.textContent = 'Bitte E-Mail oder WhatsApp-Nummer angeben.'; return; }
    if (!ME.token) { ME.token = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)), function(b){ return ('0'+b.toString(16)).slice(-2); }).join(''); saveMe(); }
    m.className = 'msg'; m.textContent = 'Speichere …';
    api('save_contact', {p_name:ME.name, p_email:em, p_phone:ph, p_token:ME.token}).then(function(){
      return ME.oldName ? api('delete_contact', {p_name:ME.oldName, p_token:ME.token}).catch(function(){}) : null;
    }).then(function(){
      if (ME.oldName) { delete ME.oldName; saveMe(); }
      m.className = 'msg ok'; m.textContent = '✓ Gespeichert'; document.getElementById('p-del').hidden = false; load();
    }, function(err){ m.className = 'msg err'; m.textContent = err.message; });
  });
  document.getElementById('p-del').addEventListener('click', function(){
    if (!confirm('Deine Kontaktdaten löschen?')) return;
    api('delete_contact', {p_name:ME.name, p_token:ME.token || ''}).then(function(){
      document.getElementById('p-email').value = ''; document.getElementById('p-phone').value = '';
      var m = document.getElementById('p-msg'); m.className = 'msg ok'; m.textContent = '✓ Gelöscht'; document.getElementById('p-del').hidden = true; load();
    }, alertErr);
  });
  document.getElementById('wform').addEventListener('submit', function(e){
    e.preventDefault();
    var n = document.getElementById('w-name').value.trim(), c = document.getElementById('w-code').value.trim(), m = document.getElementById('w-msg');
    if (!whoCodeOnly && n.split(/\s+/).length < 2) { m.className = 'msg err'; m.textContent = 'Bitte Vor- und Nachnamen eingeben.'; return; }
    m.className = 'msg'; m.textContent = 'Prüfe …';
    sbFetch('rpc/verify_code', {method:'POST', body:JSON.stringify({p_code:c})}).then(function(){
      if (whoCodeOnly) { ME.code = c; saveMe(); document.getElementById('who').close(); var cb0 = whoCb; whoCb = null; load().then(function(){ if (cb0) cb0(); }); return; }
      // Token behalten; alten Namen merken, damit Kontaktdaten beim nächsten Speichern umziehen
      var old = ME.name && norm(ME.name) !== norm(n) ? ME.name : ME.oldName;
      ME = {name:n, code:c, token:ME.token, oldName:old}; saveMe();
      document.getElementById('who').close();
      renderSugg(); render();
      var cb = whoCb; whoCb = null;
      load().then(function(){ if (cb) cb(); });
    }, function(err){ m.className = 'msg err'; m.textContent = err.message; });
  });
  document.getElementById('w-cancel').addEventListener('click', function(){ whoCb = null; document.getElementById('who').close(); });
  if (location.hash === '#vorschlag') openForm(null);
}

document.getElementById('cl-btn').textContent = 'Version ' + CL[0][0] + ' · Changelog';
document.getElementById('cl-btn').addEventListener('click', function(){ footToggle('cl', document.getElementById('cl-list').hidden); });
document.getElementById('cl-list').innerHTML = CL.map(function(c){ return '<li><b>v'+c[0]+'</b> · '+c[1]+'<br>'+esc(c[2])+'</li>'; }).join('');

render();
openFromHash();
(SB_URL && SB_KEY ? Promise.resolve() : fetch('/api/config').then(function(r){ return r.ok ? r.json() : {}; }).then(function(c){
  if (c && c.url && c.key) { SB_URL = c.url; SB_KEY = c.key; }
}).catch(function(){})).then(load);
window.addEventListener('hashchange', openFromHash);

// Hilfe-Modal
(function(){
  var d = document.getElementById('help');
  document.getElementById('help-btn').addEventListener('click', function(){ d.showModal(); document.getElementById('help-body').scrollTop = 0; });
  document.getElementById('help-close').addEventListener('click', function(){ d.close(); });
  document.getElementById('help-x').addEventListener('click', function(){ d.close(); });
  d.addEventListener('click', function(e){ if (e.target === d) d.close(); });
})();

// Hinweis: auf den Homescreen legen / Lesezeichen setzen. Nur beim ersten Besuch;
// nicht in der installierten App. "Später" fragt nach 14 Tagen erneut.
(function(){
  var KEY = 'adc-install', st;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e) { return; }
  function save(v){ try { localStorage.setItem(KEY, JSON.stringify(v)); } catch(e) {} }
  if (standalone) { if (!st || st.s !== 'installed') save({s:'installed'}); return; }
  window.addEventListener('appinstalled', function(){ save({s:'installed'}); var d = document.getElementById('install'); if (d.open) d.close(); });
  if (st && (st.s === 'installed' || st.s === 'done' || (st.s === 'later' && Date.now() - st.t < 14*864e5))) return;

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferred = e; });

  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var mac = /Mac/.test(navigator.platform);
  var dlg = document.getElementById('install');

  function show(){
    if (document.querySelector('dialog[open]')) return setTimeout(show, 5000);
    var t;
    if (deferred) t = 'Installiere das Dashboard als App: ein Tipp auf dem Homescreen, und du siehst sofort, was im ADC läuft.';
    else if (ios && /CriOS/.test(ua)) t = 'Leg das Dashboard auf deinen Homescreen: Tippe in Chrome oben rechts in der Adressleiste auf <b>Teilen</b> (□↑) und dann auf <b>„Zum Home-Bildschirm“</b>. Falls das fehlt: Seite in Safari öffnen und dort über Teilen hinzufügen.';
    else if (ios && /FxiOS|EdgiOS/.test(ua)) t = 'Leg das Dashboard auf deinen Homescreen: Öffne das Menü (☰ bzw. …), tippe auf <b>Teilen</b> und dann auf <b>„Zum Home-Bildschirm“</b>.';
    else if (ios) t = 'Leg das Dashboard auf deinen Homescreen: Tippe in Safari unten auf <b>Teilen</b> (□↑) und dann auf <b>„Zum Home-Bildschirm“</b>.';
    else if (android) t = 'Leg das Dashboard auf deinen Startbildschirm: Tippe oben rechts auf <b>⋮</b> und dann auf <b>„Zum Startbildschirm hinzufügen“</b>.';
    else t = 'Setz dir ein Lesezeichen, damit du schnell wieder hier bist: <b>' + (mac ? '⌘ + D' : 'Strg + D') + '</b>.';
    document.getElementById('inst-txt').innerHTML = t;
    document.getElementById('inst-go').hidden = !deferred;
    dlg.showModal();
  }
  document.getElementById('inst-go').addEventListener('click', function(){
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function(c){ save({s: c.outcome === 'accepted' ? 'installed' : 'later', t: Date.now()}); deferred = null; dlg.close(); });
  });
  document.getElementById('inst-done').addEventListener('click', function(){ save({s:'done'}); dlg.close(); });
  document.getElementById('inst-later').addEventListener('click', function(){ save({s:'later', t:Date.now()}); dlg.close(); });
  dlg.addEventListener('cancel', function(){ save({s:'later', t:Date.now()}); });
  setTimeout(show, 4000);
})();

// Homescreen-App: beim Zurückkehren nach >2 Min automatisch neu laden
var hiddenAt = Date.now();
document.addEventListener('visibilitychange', function(){
  if (document.visibilityState === 'hidden') hiddenAt = Date.now();
  else if (Date.now() - hiddenAt > 120000 && !unsaved()) location.reload();
  else load();
});
})();
