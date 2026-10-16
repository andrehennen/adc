// Hamburg ADC Jury Map (/jury): Orte für die Jurys 2027 auf einer selbst gehosteten Hamburg-Karte.
// Speicher wie im Dashboard (Supabase, Tabelle jury_locations, Schreiben nur mit Mitglieder-Code).
var SB_URL = '', SB_KEY = '';
var MAP_STAND = '2026-10';   // Stand der Kartendatei map/hamburg-<stand>.pmtiles und map/style-<stand>.json

// Abend-Treffpunkt: eintragen, sobald er feststeht, z. B.
// {name:'Get Together der Sektion Hamburg', adresse:'Musterstraße 1, 20457 Hamburg', lat:53.55, lng:9.99, info:'Am Vorabend ab 19 Uhr'}
var TREFF = null;

var fitted = false;
var LOCS = [], CONTACTS = null, ME = {}, map = null, markers = {}, draft = null, editing = null, selId = null, popup = null, SB_ON = false;
try { ME = JSON.parse(localStorage.getItem('adc-me') || '{}') || {}; } catch(e) {}
function saveMe(){ try { localStorage.setItem('adc-me', JSON.stringify(ME)); } catch(e) {} }
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function linkify(h){ return h.replace(/(https?:\/\/[^\s<)]+[^\s<).,;:])/g,'<a href="$1" target="_blank" rel="noopener">$1</a>'); }
var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Speicher ---
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
function load(){
  if (!SB_URL || !SB_KEY) { renderList('Der Speicher ist gerade nicht erreichbar. Bitte versuch es später nochmal.'); return Promise.resolve(false); }
  return Promise.all([
    sbFetch('jury_locations?select=id,ort,firma,adresse,lat,lng,raeume,plaetze,internet,catering,tage,jury,notiz,created_by,created_at,deleted&deleted=is.false&order=created_at'),
    ME.code ? sbFetch('rpc/get_contacts', {method:'POST', body:JSON.stringify({p_code:ME.code})}).catch(function(){ return null; }) : Promise.resolve(null)
  ]).then(function(r){
    LOCS = r[0].filter(function(l){ return !l.deleted; });
    LOCS.forEach(function(l, i){ l.nr = i + 1; });
    CONTACTS = r[1];
    SB_ON = true;
    renderList(); renderPins();
    return true;
  }).catch(function(e){
    console.warn('Speicher nicht erreichbar', e);
    renderList('Der Speicher ist gerade nicht erreichbar. Bitte versuch es später nochmal.');
    return false;
  });
}

// --- Kontakte (wie im Dashboard: voller Name, akzent- und großschreibungsunabhängig) ---
function norm(n){ return String(n||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim(); }
function contactFor(name){
  if (!CONTACTS) return null;
  var k = norm(name);
  var hit = CONTACTS.filter(function(c){ return norm(c.name) === k; });
  return hit.length === 1 ? hit[0] : null;
}
function waLink(p){
  var d = p.replace(/[^0-9+]/g,'');
  d = d.indexOf('+') === 0 ? d.slice(1) : d.indexOf('00') === 0 ? d.slice(2) : d.indexOf('0') === 0 ? '49' + d.slice(1) : d;
  return 'https://wa.me/' + d.replace(/\D/g,'');
}
function who(name){
  var c = contactFor(name), h = esc(name);
  if (c && c.email) h += '<a class="ci" href="mailto:'+esc(c.email)+'" aria-label="Mail an '+esc(name)+'">✉️</a>';
  if (c && c.phone) h += '<a class="ci" href="'+esc(waLink(c.phone))+'" target="_blank" rel="noopener" aria-label="WhatsApp an '+esc(name)+'">💬</a>';
  return h;
}

// --- Entfernungen ---
function km(a, b){
  var R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  var x = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(a.lat*r) * Math.cos(b.lat*r) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return 2 * R * Math.asin(Math.sqrt(x));
}
// Fußweg grob geschätzt: Luftlinie × 1,3 bei 5 km/h
function walk(d){ var m = Math.max(1, Math.round(d * 1.3 / 5 * 60)); return m <= 45 ? 'ca. ' + m + ' Min. zu Fuß' : 'ca. ' + (Math.round(d * 10) / 10).toString().replace('.', ',') + ' km'; }
function nearest(l){
  var best = null;
  LOCS.forEach(function(o){ if (o.id !== l.id) { var d = km(l, o); if (!best || d < best.d) best = {o:o, d:d}; } });
  return best;
}
function routeLinks(l){
  var ll = l.lat + ',' + l.lng;
  return '<a href="https://www.google.com/maps/dir/?api=1&amp;destination=' + ll + '" target="_blank" rel="noopener">Route in Google Maps</a>'
       + '<a href="https://maps.apple.com/?daddr=' + ll + '&amp;q=' + encodeURIComponent(l.ort || l.name || '') + '" target="_blank" rel="noopener">Apple Karten</a>';
}

// --- Liste ---
function tags(l){
  var t = [];
  if (l.raeume != null) t.push('<span class="tag">🚪 ' + l.raeume + (l.raeume === 1 ? ' Raum' : ' Räume') + '</span>');
  if (l.plaetze != null) t.push('<span class="tag">👥 ' + l.plaetze + ' Plätze pro Raum</span>');
  if (l.internet === true) t.push('<span class="tag ok">📶 Internet</span>');
  if (l.internet === false) t.push('<span class="tag warn">📶 Kein stabiles Internet</span>');
  if (l.catering === 'ja') t.push('<span class="tag ok">🍽️ Catering</span>');
  if (l.catering === 'teilweise') t.push('<span class="tag warn">🍽️ Catering teilweise</span>');
  if (l.catering === 'nein') t.push('<span class="tag warn">🍽️ Kein Catering</span>');
  return t.length ? '<div class="tags">' + t.join('') + '</div>' : '';
}
function card(l){
  var n = nearest(l), dTreff = TREFF ? km(l, TREFF) : null;
  var near = [];
  if (n) near.push('Nächster Jury-Ort: <b>' + esc(n.o.ort) + '</b>, ' + walk(n.d));
  if (TREFF) near.push('Zum Abend-Treffpunkt: ' + walk(dTreff));
  return '<li class="loc" id="ort-' + l.id + '" data-id="' + l.id + '">'
    + '<button class="lhead" type="button" data-fly="' + l.id + '" aria-label="' + esc(l.ort) + ' auf der Karte zeigen"><span class="num">' + l.nr + '</span><span><span class="lname">' + esc(l.ort) + '</span>'
    + '<span class="sub" style="display:block">' + (l.firma ? esc(l.firma) + ' · ' : '') + esc(l.adresse) + '</span></span></button>'
    + '<div class="lbody">' + tags(l)
    + (l.tage ? '<div>📅 ' + esc(l.tage) + '</div>' : '')
    + (l.jury ? '<div>⚖️ Jury: <b>' + esc(l.jury) + '</b></div>' : '')
    + (l.notiz ? '<div>' + linkify(esc(l.notiz)) + '</div>' : '')
    + (near.length ? '<div class="near">' + near.join('<br>') + '</div>' : '')
    + '<div class="lfoot">' + routeLinks(l) + (SB_ON ? '<button class="linkbtn" type="button" data-edit="' + l.id + '">✏️ Bearbeiten</button>' : '') + '</div>'
    + '<div class="by">Eingetragen von ' + who(l.created_by) + '</div>'
    + '</div></li>';
}
function treffCard(){
  if (!TREFF) return '<li class="loc empty">🌙 <b>Abend-Treffpunkt:</b> steht noch nicht fest. Sobald es ihn gibt, erscheint er hier und auf der Karte.</li>';
  return '<li class="loc treff" id="ort-treff"><button class="lhead" type="button" data-fly="treff" aria-label="Abend-Treffpunkt auf der Karte zeigen"><span class="num">★</span><span><span class="lname">🌙 ' + esc(TREFF.name) + '</span>'
    + '<span class="sub" style="display:block">' + esc(TREFF.adresse) + '</span></span></button>'
    + '<div class="lbody">' + (TREFF.info ? '<div>' + esc(TREFF.info) + '</div>' : '') + '<div class="lfoot">' + routeLinks(TREFF) + '</div></div></li>';
}
function renderList(err){
  var ul = $('locs');
  var r = LOCS.reduce(function(s, l){ return s + (l.raeume || 0); }, 0);
  $('count').textContent = LOCS.length ? LOCS.length + (LOCS.length === 1 ? ' Ort' : ' Orte') + (r ? ' · ' + r + ' Räume' : '') : '';
  var h = treffCard();
  if (err) h += '<li class="loc empty">' + esc(err) + '</li>';
  else if (!LOCS.length) h += '<li class="loc empty">Noch keine Orte eingetragen. Biete den ersten an: <b>📍 Ort anbieten</b> oben.</li>';
  h += LOCS.map(card).join('');
  ul.innerHTML = h;
  if (selId) select(selId, false);
}
$('locs').addEventListener('click', function(e){
  var f = e.target.closest('[data-fly]'), ed = e.target.closest('[data-edit]');
  if (f) { var id = f.getAttribute('data-fly'); fly(id === 'treff' ? 'treff' : +id); }
  if (ed) { var l = LOCS.filter(function(x){ return x.id === +ed.getAttribute('data-edit'); })[0]; if (l) openForm(l); }
});

// --- Karte ---
function initMap(){
  if (!window.maplibregl || !window.pmtiles) return mapFail();
  try {
    var protocol = new pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    maplibregl.setWorkerUrl('/vendor/maplibre-gl-csp-worker-5.24.0.js');
  } catch(e) { return mapFail(); }
  fetch('/map/style-' + MAP_STAND + '.json').then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); }).then(function(style){
    var o = location.origin;
    style.glyphs = o + style.glyphs;
    style.sprite = o + style.sprite;
    style.sources.protomaps.url = 'pmtiles://' + o + '/map/hamburg-' + MAP_STAND + '.pmtiles';
    var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    map = new maplibregl.Map({
      container: 'map', style: style, center: [9.985, 53.556], zoom: 12.3, minZoom: 10.5, maxZoom: 17.5,
      maxBounds: [[9.80, 53.47], [10.16, 53.66]], attributionControl: {compact: true},
      cooperativeGestures: touch, dragRotate: false, pitchWithRotate: false, fadeDuration: REDUCED ? 0 : 300,
      locale: {
        'CooperativeGesturesHandler.MobileHelpText': 'Mit zwei Fingern verschieben und zoomen',
        'CooperativeGesturesHandler.WindowsHelpText': 'Strg + Scrollen zum Zoomen',
        'CooperativeGesturesHandler.MacHelpText': '⌘ + Scrollen zum Zoomen',
        'NavigationControl.ZoomIn': 'Hineinzoomen', 'NavigationControl.ZoomOut': 'Herauszoomen',
        'AttributionControl.ToggleAttribution': 'Quellen anzeigen'
      }
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
    map.on('error', function(e){ console.warn('Karte', e && e.error ? e.error.message : e); });
    map.on('click', function(e){ if (editing) setDraft(e.lngLat.lat, e.lngLat.lng); });
    map.on('load', renderPins);
  }).catch(mapFail);
}
function mapFail(){ $('mapbox').insertAdjacentHTML('beforeend', '<div class="mapfail">Die Karte lässt sich gerade nicht laden. Die Orte stehen in der Liste.</div>'); }
function pinEl(label, cls){
  var el = document.createElement('div');
  el.className = 'pin' + (cls ? ' ' + cls : '');
  el.innerHTML = '<i>' + esc(label) + '</i>';
  return el;
}
function renderPins(){
  if (!map) return;
  Object.keys(markers).forEach(function(k){ markers[k].remove(); });
  markers = {};
  LOCS.forEach(function(l){
    var el = pinEl(l.nr, l.id === selId ? 'sel' : '');
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', l.nr + ': ' + l.ort);
    function go(e){ e.stopPropagation(); select(l.id, true); showPopup(l); }
    el.addEventListener('click', go);
    el.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
    markers[l.id] = new maplibregl.Marker({element: el, anchor: 'bottom'}).setLngLat([l.lng, l.lat]).addTo(map);
  });
  if (TREFF) {
    var t = pinEl('★', 'treff');
    t.setAttribute('role', 'button'); t.setAttribute('tabindex', '0'); t.setAttribute('aria-label', 'Abend-Treffpunkt: ' + TREFF.name);
    t.addEventListener('click', function(e){ e.stopPropagation(); select('treff', true); showPopup(TREFF, true); });
    markers.treff = new maplibregl.Marker({element: t, anchor: 'bottom'}).setLngLat([TREFF.lng, TREFF.lat]).addTo(map);
  }
  // Beim ersten Laden alle Orte ins Bild holen
  if (!fitted && SB_ON && !editing) {
    fitted = true;
    var pts = LOCS.map(function(l){ return [l.lng, l.lat]; });
    if (TREFF) pts.push([TREFF.lng, TREFF.lat]);
    if (pts.length === 1) map.jumpTo({center: pts[0], zoom: 14});
    else if (pts.length > 1) map.fitBounds(pts.reduce(function(b, p){ return b.extend(p); }, new maplibregl.LngLatBounds(pts[0], pts[0])), {padding: 70, maxZoom: 15, duration: 0});
  }
}
function showPopup(l, isTreff){
  if (popup) popup.remove();
  var n = isTreff ? null : nearest(l);
  popup = new maplibregl.Popup({offset: [0, -40], closeButton: false, maxWidth: '260px'})
    .setLngLat([l.lng, l.lat])
    .setHTML('<b>' + esc(isTreff ? '🌙 ' + l.name : l.nr + '. ' + l.ort) + '</b>' + (l.firma ? '<div>' + esc(l.firma) + '</div>' : '')
      + (n ? '<div class="by">Nächster Jury-Ort: ' + esc(n.o.ort) + ', ' + walk(n.d) + '</div>' : ''))
    .addTo(map);
}
function select(id, scroll){
  selId = id;
  Array.prototype.forEach.call(document.querySelectorAll('.loc.sel'), function(x){ x.classList.remove('sel'); });
  Object.keys(markers).forEach(function(k){ markers[k].getElement().classList.toggle('sel', String(k) === String(id) && k !== 'treff'); });
  var c = $('ort-' + id);
  if (!c) return;
  c.classList.add('sel');
  if (scroll && window.matchMedia('(min-width: 901px)').matches) c.scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest'});
}
function fly(id){
  var l = id === 'treff' ? TREFF : LOCS.filter(function(x){ return x.id === id; })[0];
  if (!l) return;
  select(id, false);
  if (!map) return;
  if (!window.matchMedia('(min-width: 901px)').matches) $('mapbox').scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: 'start'});
  map.flyTo({center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 15), duration: REDUCED ? 0 : 900});
  showPopup(l, id === 'treff');
}

// --- Formular ---
function setDraft(lat, lng, fly){
  if (lat < 53.3 || lat > 53.8 || lng < 9.6 || lng > 10.4) { pinMsg('Der Pin muss in Hamburg liegen.', false); return; }
  editing.lat = lat; editing.lng = lng;
  if (map) {
    if (!draft) {
      draft = new maplibregl.Marker({element: pinEl('+', 'draft'), anchor: 'bottom', draggable: true}).setLngLat([lng, lat]).addTo(map);
      draft.on('dragend', function(){ var p = draft.getLngLat(); editing.lat = p.lat; editing.lng = p.lng; pinMsg('Pin gesetzt. Du kannst ihn auf der Karte verschieben.', true); });
    } else draft.setLngLat([lng, lat]);
    if (fly) map.flyTo({center: [lng, lat], zoom: 16, duration: REDUCED ? 0 : 900});
  }
  $('maphint').hidden = true;
  pinMsg('Pin gesetzt. Du kannst ihn auf der Karte verschieben.', true);
}
function pinMsg(t, ok){ var p = $('f-pin'); p.textContent = t; p.className = 'pinstate' + (ok ? ' ok' : ''); }
function radio(name, v){ Array.prototype.forEach.call(document.querySelectorAll('[name=' + name + ']'), function(r){ r.checked = r.value === v; }); }
function radioVal(name){ var r = document.querySelector('[name=' + name + ']:checked'); return r ? r.value : ''; }
function openForm(l){
  whoami(function(){
    editing = l ? {id: l.id, lat: l.lat, lng: l.lng} : {id: null, lat: null, lng: null};
    $('f-head').textContent = l ? '✏️ Ort bearbeiten' : '📍 Ort anbieten';
    $('f-ort').value = l ? l.ort : ''; $('f-firma').value = l ? l.firma || '' : ''; $('f-adresse').value = l ? l.adresse : '';
    $('f-raeume').value = l && l.raeume != null ? l.raeume : ''; $('f-plaetze').value = l && l.plaetze != null ? l.plaetze : '';
    radio('f-net', l && l.internet != null ? (l.internet ? '1' : '0') : ''); radio('f-cat', l && l.catering || '');
    $('f-tage').value = l ? l.tage || '' : ''; $('f-jury').value = l ? l.jury || '' : ''; $('f-notiz').value = l ? l.notiz || '' : '';
    $('f-del').hidden = !l; $('f-msg').textContent = ''; $('f-hits').hidden = true;
    if (draft) { draft.remove(); draft = null; }
    if (l) { setDraft(l.lat, l.lng, false); if (markers[l.id]) markers[l.id].getElement().hidden = true; }
    else { pinMsg('Noch kein Pin. Such die Adresse oder tippe auf die Karte.', false); $('maphint').hidden = !map; }
    $('form-panel').hidden = false;
    $('f-ort').focus();
    $('form-panel').scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: 'start'});
  });
}
function closeForm(){
  editing = null; $('form-panel').hidden = true; $('maphint').hidden = true;
  if (draft) { draft.remove(); draft = null; }
  Object.keys(markers).forEach(function(k){ markers[k].getElement().hidden = false; });
}
$('add-btn').addEventListener('click', function(){
  if (!SB_ON) return alert('Der Speicher ist gerade nicht erreichbar. Bitte versuch es später nochmal.');
  if (!$('form-panel').hidden && editing && !editing.id) return closeForm();
  openForm(null);
});
$('f-cancel').addEventListener('click', closeForm);
$('f-find').addEventListener('click', function(){
  var q = $('f-adresse').value.trim(), btn = this, hits = $('f-hits');
  if (q.length < 3) { pinMsg('Bitte zuerst eine Adresse eingeben.', false); return; }
  if (!/hamburg/i.test(q)) q += ', Hamburg';
  btn.disabled = true; pinMsg('Suche …', false);
  fetch('/api/geocode?q=' + encodeURIComponent(q)).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; }).then(function(list){
    btn.disabled = false;
    if (!list.length) { hits.hidden = true; pinMsg('Nichts gefunden. Prüf die Schreibweise oder tippe auf die Karte, um den Pin selbst zu setzen.', false); return; }
    if (list.length === 1) { hits.hidden = true; setDraft(list[0].lat, list[0].lng, true); return; }
    hits.innerHTML = list.map(function(h, i){ return '<li><button type="button" data-i="' + i + '">📍 ' + esc(h.name) + '</button></li>'; }).join('');
    hits.hidden = false; pinMsg('Mehrere Treffer, bitte wählen:', false);
    hits.onclick = function(e){ var b = e.target.closest('[data-i]'); if (!b) return; var h = list[+b.getAttribute('data-i')]; hits.hidden = true; setDraft(h.lat, h.lng, true); };
  });
});
$('f-adresse').addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); $('f-find').click(); } });
function num(id){ var v = $(id).value.trim(); return v === '' ? null : Math.max(0, parseInt(v, 10) || 0); }
$('lform').addEventListener('submit', function(e){
  e.preventDefault();
  var m = $('f-msg'), sb = $('f-submit');
  var ort = $('f-ort').value.trim(), adr = $('f-adresse').value.trim();
  m.className = 'msg err';
  if (ort.length < 2) { m.textContent = 'Bitte einen Namen für den Ort.'; $('f-ort').focus(); return; }
  if (adr.length < 3) { m.textContent = 'Bitte die Adresse eintragen.'; $('f-adresse').focus(); return; }
  if (editing.lat == null) { m.textContent = 'Bitte noch den Pin setzen: Adresse suchen oder auf die Karte tippen.'; return; }
  if (sb.disabled) return;
  var net = radioVal('f-net');
  var args = {
    p_name: ME.name, p_id: editing.id, p_ort: ort, p_firma: $('f-firma').value, p_adresse: adr, p_lat: editing.lat, p_lng: editing.lng,
    p_raeume: num('f-raeume'), p_plaetze: num('f-plaetze'), p_internet: net === '' ? null : net === '1', p_catering: radioVal('f-cat'),
    p_tage: $('f-tage').value, p_jury: $('f-jury').value, p_notiz: $('f-notiz').value
  };
  whoami(function(){
    args.p_name = ME.name;
    sb.disabled = true; m.className = 'msg'; m.textContent = 'Speichere …';
    api('save_jury_location', args).then(function(id){
      sb.disabled = false; m.textContent = '';
      closeForm();
      return load().then(function(){ fly(+id); });
    }, function(err){ sb.disabled = false; m.className = 'msg err'; m.textContent = err.message; });
  });
});
$('f-del').addEventListener('click', function(){
  var l = editing && LOCS.filter(function(x){ return x.id === editing.id; })[0];
  if (!l || !confirm('Ort „' + l.ort + '“ löschen? André kann ihn bei Bedarf wiederherstellen.')) return;
  whoami(function(){
    api('delete_jury_location', {p_name: ME.name, p_id: l.id}).then(function(){ closeForm(); selId = null; if (popup) popup.remove(); load(); }, function(err){ alert('Das hat nicht geklappt: ' + err.message); });
  });
});

// --- Name + Mitglieder-Code (gleicher Speicher wie im Dashboard) ---
var whoCb = null;
function fullName(n){ return String(n||'').trim().split(/\s+/).length >= 2; }
function whoami(cb){
  if (ME.code && fullName(ME.name)) return cb();
  whoCb = cb;
  $('w-name').value = ME.name || ''; $('w-code').value = ME.code || '';
  var wm = $('w-msg');
  wm.className = 'msg' + (ME.name ? ' err' : ''); wm.textContent = ME.name ? 'Bitte ergänze deinen Nachnamen.' : '';
  $('who').showModal();
}
$('wform').addEventListener('submit', function(e){
  e.preventDefault();
  var n = $('w-name').value.trim(), c = $('w-code').value.trim(), wm = $('w-msg');
  if (!fullName(n)) { wm.className = 'msg err'; wm.textContent = 'Bitte Vor- und Nachnamen eingeben.'; return; }
  if (!c) { wm.className = 'msg err'; wm.textContent = 'Bitte den Mitglieder-Code eingeben.'; return; }
  wm.className = 'msg'; wm.textContent = 'Prüfe …';
  sbFetch('rpc/verify_code', {method:'POST', body:JSON.stringify({p_code:c})}).then(function(){
    // Token behalten; alten Namen merken, damit Kontaktdaten im Dashboard beim nächsten Speichern umziehen
    var old = ME.name && norm(ME.name) !== norm(n) ? ME.name : ME.oldName;
    ME = {name:n, code:c, token:ME.token, oldName:old}; saveMe();
    $('who').close();
    var cb = whoCb; whoCb = null;
    load().then(function(){ if (cb) cb(); });
  }, function(err){ wm.className = 'msg err'; wm.textContent = err.message; });
});
$('w-cancel').addEventListener('click', function(){ whoCb = null; $('who').close(); });

// --- Start ---
initMap();
renderList();
$('locs').innerHTML = treffCard() + '<li class="loc empty">Lade Orte …</li>';
(SB_URL && SB_KEY ? Promise.resolve() : fetch('/api/config').then(function(r){ return r.ok ? r.json() : {}; }).then(function(c){
  if (c && c.url && c.key) { SB_URL = c.url; SB_KEY = c.key; }
}).catch(function(){})).then(load);
